import type { HistoryMatch, HotdataStats, Playbook, Suggestion, Ticket } from '../types.js';
import { recallRelatedHistory, rememberResolution } from '../adapters/cognee.js';
import { persistResolutionToHydraDb } from '../adapters/hydradb.js';
import { queryHotdataStats } from '../adapters/hotdata.js';
import { findReusablePlaybook, markPlaybookReused, saveVerifiedPlaybook } from '../adapters/modiq.js';
import { generateSuggestion } from '../adapters/suggestion.js';
import { UNCONFIGURED_BRIDGE, type RocketRideBridge } from '../adapters/rocketrideBridge.js';
import type { RunLog } from './runLog.js';
import type { TicketStore } from './ticketStore.js';
import { getSymptomDefinition } from '../data/symptomCatalog.js';

export interface DiagnosisResult {
	ticket: Ticket;
	history: HistoryMatch[];
	hotdata: HotdataStats;
	matchedPlaybook: Playbook | null;
	suggestion: Suggestion;
}

/**
 * Steps 3–5 of the minimal business scenario: pull related history +
 * verified-playbook eligibility + current-ticket stats, then generate a
 * suggestion grounded in all three. Never marks anything resolved.
 */
export async function diagnoseTicket(store: TicketStore, ticketId: string, runLog: RunLog, bridge: RocketRideBridge = UNCONFIGURED_BRIDGE): Promise<DiagnosisResult> {
	const ticket = store.getTicket(ticketId);
	if (!ticket) throw new Error(`Unknown ticket_id: ${ticketId}`);
	if (ticket.status === 'open') store.transitionStatus(ticketId, 'diagnosing');

	const [history, hotdata, matchedPlaybook] = await Promise.all([recallRelatedHistory(store, ticket, bridge, runLog), queryHotdataStats(store, ticket, runLog, ticketId), findReusablePlaybook(store, ticket, runLog)]);

	const suggestion = await generateSuggestion(ticket, history, hotdata, matchedPlaybook, bridge, runLog);

	store.transitionStatus(ticketId, 'pending_confirmation');
	return { ticket: store.getTicket(ticketId)!, history, hotdata, matchedPlaybook, suggestion };
}

/**
 * Step 6: the human confirms the suggested steps, and the app runs them
 * against the DEMO environment only (never a real company system) — this
 * is always recorded as a simulated action, regardless of which adapters
 * are live, per the "no real company accounts" requirement.
 */
export async function confirmAndExecute(store: TicketStore, ticketId: string, steps: string[], reusedPlaybookId: string | null, runLog: RunLog): Promise<Ticket> {
	const start = performance.now();
	store.transitionStatus(ticketId, 'executing');
	// Simulated demo-environment action — intentionally not a real system call.
	await new Promise((resolve) => setTimeout(resolve, 250));
	const ticket = store.recordExecution(ticketId, steps, reusedPlaybookId);
	runLog.append({
		service: 'App',
		action: 'execute_demo_environment_action',
		mode: 'mock',
		duration_ms: Math.round(performance.now() - start),
		summary: `Simulated ${steps.length} step(s) in the demo environment (no real company system touched)`,
		ticket_id: ticketId,
	});
	return ticket;
}

export interface ResolutionResult {
	ticket: Ticket;
	already_saved: boolean;
	playbook: Playbook | null;
	playbook_already_existed: boolean;
}

/**
 * Step 7: human confirms the issue is actually solved. Only this action
 * sets `verified`. Idempotent — calling it twice for the same ticket does
 * not double-write or double-promote a playbook.
 */
export async function markResolved(store: TicketStore, ticketId: string, runLog: RunLog, bridge: RocketRideBridge = UNCONFIGURED_BRIDGE): Promise<ResolutionResult> {
	const before = store.getTicket(ticketId);
	if (!before) throw new Error(`Unknown ticket_id: ${ticketId}`);
	if (!before.resolution_steps) throw new Error(`Ticket ${ticketId} has no executed steps to verify yet`);

	const { ticket, already_saved } = store.saveResolution(ticketId, before.resolution_steps);

	if (!already_saved) {
		await Promise.all([rememberResolution(ticket, bridge, runLog), persistResolutionToHydraDb(ticket, bridge, runLog)]);
	}

	if (ticket.reused_playbook_id) {
		if (!already_saved) await markPlaybookReused(store, ticket.reused_playbook_id, runLog, ticketId);
		return { ticket, already_saved, playbook: store.getPlaybook(ticket.reused_playbook_id) ?? null, playbook_already_existed: true };
	}

	const symptomDef = getSymptomDefinition(ticket.symptom_code);
	const requiredPrereqs = (symptomDef?.prerequisites ?? []).map((p) => p.key).filter((key) => ticket.prerequisite_checks.find((c) => c.key === key)?.value === true);
	const { playbook, already_existed } = await saveVerifiedPlaybook(store, ticketId, `${symptomDef?.label ?? ticket.symptom_code} — ${ticket.system}`, requiredPrereqs, runLog);

	return { ticket: store.getTicket(ticketId)!, already_saved, playbook, playbook_already_existed: already_existed };
}
