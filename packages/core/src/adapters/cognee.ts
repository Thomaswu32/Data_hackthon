import { z } from 'zod';
import type { HistoryMatch, Ticket } from '../types.js';
import type { RunLog } from '../core/runLog.js';
import type { TicketStore } from '../core/ticketStore.js';
import type { RocketRideBridge } from './rocketrideBridge.js';

/**
 * Cognee's job per the project brief: ingest historical tickets/replies/
 * resolutions, extract relationships, and recall relevant history for a new
 * ticket. RocketRide only exposes Cognee as an agent-invoked tool
 * (tool_cognee — remember / recall-with-references / check-background-job),
 * so the real path here runs a RocketRide pipeline whose agent has that tool
 * wired up (see pipelines/cognee_recall.pipe). That pipeline needs BOTH a
 * Cognee server (COGNEE base_url/api_key) AND an LLM provider key, neither
 * of which is configured in this workspace — see README.md's tool status
 * table. Until then this falls back to a clearly-labeled local recall that
 * searches the ticket store itself, deliberately NOT ranking by text
 * similarity alone: system + symptom match come first.
 */

const cogneeRecallSchema = z.object({
	matches: z.array(
		z.object({
			ticket_id: z.string(),
			relevance: z.number().min(0).max(1),
			reason: z.string(),
		})
	),
});

function localRecall(store: TicketStore, ticket: Pick<Ticket, 'ticket_id' | 'system' | 'symptom_code' | 'description'>, limit: number): HistoryMatch[] {
	const descTokens = new Set(
		ticket.description
			.toLowerCase()
			.split(/\W+/)
			.filter((w) => w.length > 3)
	);

	const scored = store
		.listTickets()
		.filter((t) => t.ticket_id !== ticket.ticket_id)
		.map((t) => {
			const sameSystem = t.system === ticket.system;
			const sameSymptom = t.symptom_code === ticket.symptom_code;
			const tTokens = t.description
				.toLowerCase()
				.split(/\W+/)
				.filter((w) => w.length > 3);
			const overlap = tTokens.filter((w) => descTokens.has(w)).length;
			const textScore = Math.min(overlap / 6, 1);

			let score = 0;
			const reasons: string[] = [];
			if (sameSystem) {
				score += 0.5;
				reasons.push(`same system (${t.system})`);
			}
			if (sameSymptom) {
				score += 0.35;
				reasons.push(`same symptom category (${t.symptom_code})`);
			}
			score += textScore * 0.15;
			if (!sameSystem && !sameSymptom && textScore > 0) {
				reasons.push('similar wording only — different system/symptom, treat as low-confidence');
			}

			return { ticket: t, score, reason: reasons.join('; ') || 'weak text overlap only' };
		})
		.filter((s) => s.score > 0.1)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);

	return scored.map((s) => ({
		ticket_id: s.ticket.ticket_id,
		system: s.ticket.system,
		symptom_code: s.ticket.symptom_code,
		description: s.ticket.description,
		status: s.ticket.status,
		verified: s.ticket.verified,
		resolution_steps: s.ticket.resolution_steps,
		match_reason: s.reason,
		relevance: Math.round(s.score * 100) / 100,
	}));
}

export async function recallRelatedHistory(store: TicketStore, ticket: Ticket, bridge: RocketRideBridge, runLog: RunLog, limit = 5): Promise<HistoryMatch[]> {
	return runLog.record({ service: 'Cognee', action: 'recall_related_history', ticket_id: ticket.ticket_id }, async () => {
		if (bridge.isConfigured('cognee') && bridge.isConnected()) {
			try {
				const answer = await bridge.askAgent(
					'cognee',
					`Recall the tickets most relevant to this new support ticket. Return ONLY JSON: {"matches":[{"ticket_id":"...","relevance":0..1,"reason":"..."}]}. New ticket: system=${ticket.system}, symptom=${ticket.symptom_code}, description=${JSON.stringify(ticket.description)}.`
				);
				const parsed = cogneeRecallSchema.safeParse(JSON.parse(answer.raw));
				if (parsed.success) {
					const matches: HistoryMatch[] = parsed.data.matches
						.map((m) => {
							const t = store.getTicket(m.ticket_id);
							if (!t) return null;
							return {
								ticket_id: t.ticket_id,
								system: t.system,
								symptom_code: t.symptom_code,
								description: t.description,
								status: t.status,
								verified: t.verified,
								resolution_steps: t.resolution_steps,
								match_reason: m.reason,
								relevance: m.relevance,
							} satisfies HistoryMatch;
						})
						.filter((m): m is HistoryMatch => m !== null)
						.slice(0, limit);
					return { mode: 'real' as const, summary: `Cognee recalled ${matches.length} related ticket(s)`, value: matches };
				}
				// Model answered but not in the expected shape — never trust it blindly.
			} catch {
				// Fall through to mock below; the failure itself is recorded by runLog.record's caller on throw,
				// but here we choose to degrade gracefully instead of failing the whole suggestion flow.
			}
		}
		const matches = localRecall(store, ticket, limit);
		return { mode: 'mock' as const, summary: `Cognee not configured/connected — used local system+symptom recall (${matches.length} match(es))`, value: matches };
	});
}

export async function rememberResolution(ticket: Ticket, bridge: RocketRideBridge, runLog: RunLog): Promise<void> {
	await runLog.record({ service: 'Cognee', action: 'remember_resolution', ticket_id: ticket.ticket_id }, async () => {
		if (bridge.isConfigured('cognee') && bridge.isConnected()) {
			try {
				await bridge.askAgent('cognee', `Remember this verified resolution for future recall. ticket_id=${ticket.ticket_id}, system=${ticket.system}, symptom=${ticket.symptom_code}, steps=${JSON.stringify(ticket.resolution_steps)}.`);
				return { mode: 'real' as const, summary: `Remembered resolution for ${ticket.ticket_id} in Cognee`, value: undefined };
			} catch (err) {
				return { mode: 'error' as const, summary: err instanceof Error ? err.message : String(err), value: undefined };
			}
		}
		return { mode: 'mock' as const, summary: 'Cognee not configured — resolution kept only in the local ticket store', value: undefined };
	});
}
