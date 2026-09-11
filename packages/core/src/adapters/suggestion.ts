import { z } from 'zod';
import type { HistoryMatch, HotdataStats, Playbook, Suggestion, Ticket } from '../types.js';
import type { RunLog } from '../core/runLog.js';
import type { RocketRideBridge } from './rocketrideBridge.js';

/**
 * Generates the suggested next steps shown to the agent, citing sources.
 * Real path: a RocketRide chat -> llm_* -> response_answers pipeline
 * (pipelines/suggest.pipe) fed the retrieved history + Hotdata stats +
 * any matched playbook as context, asked for strict JSON, and validated
 * with zod before use — an LLM answer is data, not a contract (see
 * ROCKETRIDE_COMMON_MISTAKES.md Mistake 6). Needs an LLM provider key,
 * which is not configured in this workspace, so this falls back to a
 * deterministic, clearly-labeled rule-based generator that encodes the
 * SAME policy an LLM prompt would be given: never propose reusing a
 * procedure whose system/symptom/prerequisites don't match, and never
 * claim the issue is solved — only a human "mark resolved" action does.
 */

const suggestionSchema = z.object({
	summary: z.string(),
	steps: z.array(z.object({ text: z.string(), kind: z.enum(['diagnostic', 'action']) })),
	cited_ticket_ids: z.array(z.string()),
	cited_playbook_id: z.string().nullable(),
	confidence: z.enum(['low', 'medium', 'high']),
	is_playbook_reuse: z.boolean(),
	caveat: z.string().nullable(),
});

function massIncidentCaveat(hotdata: HotdataStats): string | null {
	if (!hotdata.is_potential_mass_incident) return null;
	return `${hotdata.similar_recent_count} similar "${hotdata.symptom_code}" tickets on ${hotdata.system} in the last ${hotdata.lookback_hours}h — consider a mass-incident/outage response instead of one-off fixes.`;
}

function localSuggestion(ticket: Ticket, history: HistoryMatch[], hotdata: HotdataStats, matchedPlaybook: Playbook | null): Suggestion {
	const massCaveat = massIncidentCaveat(hotdata);

	if (matchedPlaybook) {
		return {
			summary: `Reuse verified playbook ${matchedPlaybook.playbook_id} — system, symptom, and all required prerequisites match this ticket.`,
			steps: matchedPlaybook.steps.map((text) => ({ text, kind: 'action' as const })),
			cited_ticket_ids: [matchedPlaybook.source_ticket_id],
			cited_playbook_id: matchedPlaybook.playbook_id,
			confidence: 'high',
			is_playbook_reuse: true,
			caveat: massCaveat,
		};
	}

	const unchecked = ticket.prerequisite_checks.filter((c) => c.value === undefined);
	if (unchecked.length > 0) {
		const sameSystemVerified = history.filter((h) => h.system === ticket.system && h.symptom_code === ticket.symptom_code && h.verified);
		return {
			summary: `No verified playbook applies yet — ${unchecked.length} prerequisite check(s) still need confirming before any fix should be reused.`,
			steps: unchecked.map((c) => ({ text: `Check: ${c.label}`, kind: 'diagnostic' as const })),
			cited_ticket_ids: sameSystemVerified.map((h) => h.ticket_id),
			cited_playbook_id: null,
			confidence: sameSystemVerified.length > 0 ? 'medium' : 'low',
			is_playbook_reuse: false,
			caveat: [massCaveat, sameSystemVerified.length > 0 ? `${sameSystemVerified.length} similar verified historical ticket(s) found — root cause likely among them, but confirm prerequisites before acting.` : 'No similar verified precedent found — this may need first-time diagnosis or escalation.'].filter(Boolean).join(' '),
		};
	}

	const closestVerified = history.find((h) => h.system === ticket.system && h.symptom_code === ticket.symptom_code && h.verified && h.resolution_steps);
	if (closestVerified?.resolution_steps) {
		return {
			summary: `Prerequisites checked; no promoted playbook yet, but ticket ${closestVerified.ticket_id} is a verified precedent with the same system and symptom.`,
			steps: closestVerified.resolution_steps.map((text) => ({ text, kind: 'action' as const })),
			cited_ticket_ids: [closestVerified.ticket_id],
			cited_playbook_id: null,
			confidence: 'medium',
			is_playbook_reuse: false,
			caveat: [massCaveat, 'This is a precedent, not a verified playbook for this exact ticket — confirm before executing, then save the outcome so it becomes reusable.'].filter(Boolean).join(' '),
		};
	}

	return {
		summary: 'No matching playbook or verified precedent found for this system/symptom/prerequisite combination.',
		steps: [{ text: 'Escalate to a human specialist for first-time diagnosis', kind: 'diagnostic' }],
		cited_ticket_ids: history.map((h) => h.ticket_id),
		cited_playbook_id: null,
		confidence: 'low',
		is_playbook_reuse: false,
		caveat: massCaveat,
	};
}

export async function generateSuggestion(ticket: Ticket, history: HistoryMatch[], hotdata: HotdataStats, matchedPlaybook: Playbook | null, bridge: RocketRideBridge, runLog: RunLog): Promise<Suggestion> {
	return runLog.record({ service: 'RocketRide', action: 'generate_suggestion', ticket_id: ticket.ticket_id }, async () => {
		if (bridge.isConfigured('suggestion') && bridge.isConnected()) {
			try {
				const answer = await bridge.askAgent(
					'suggestion',
					'Suggest next steps for this IT support ticket. Never propose reusing a matched playbook unless matched_playbook is non-null. Never claim the issue is resolved. Return ONLY JSON matching the given schema.',
					{ ticket, history, hotdata, matched_playbook: matchedPlaybook }
				);
				const parsed = suggestionSchema.safeParse(JSON.parse(answer.raw));
				if (parsed.success) {
					return { mode: 'real' as const, summary: `LLM suggestion generated (confidence: ${parsed.data.confidence})`, value: parsed.data };
				}
				// Fall through to the local generator — the model answered, but not in the contracted shape.
			} catch {
				// Fall through — transport/parse failure degrades to the deterministic generator rather than crashing the flow.
			}
		}
		const suggestion = localSuggestion(ticket, history, hotdata, matchedPlaybook);
		return { mode: 'mock' as const, summary: `No LLM key configured — used rule-based suggestion generator (confidence: ${suggestion.confidence})`, value: suggestion };
	});
}
