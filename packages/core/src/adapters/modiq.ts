import type { Playbook, Ticket } from '../types.js';
import type { RunLog } from '../core/runLog.js';
import type { TicketStore } from '../core/ticketStore.js';

/**
 * Modiq.ai's role per the project brief is "save a verified resolution
 * procedure and let later qualifying tickets reuse it." No such product's
 * API is documented anywhere in this workspace, so per instructions this
 * does not invent one. It implements the described capability for real —
 * genuine persistence and genuine eligibility matching against the ticket
 * store — behind an adapter-shaped interface so a real Modiq API could be
 * dropped in later without changing callers. See README.md's tool status
 * table.
 */

export async function findReusablePlaybook(store: TicketStore, ticket: Ticket, runLog: RunLog): Promise<Playbook | null> {
	return runLog.record({ service: 'Modiq', action: 'find_reusable_playbook', ticket_id: ticket.ticket_id }, async () => {
		const match = store.findMatchingPlaybook(ticket);
		return {
			mode: 'real' as const,
			summary: match ? `Matched verified playbook ${match.playbook_id} (system+symptom+prerequisites all satisfied)` : 'No verified playbook satisfies this ticket’s system, symptom, and prerequisites yet',
			value: match,
		};
	});
}

export async function saveVerifiedPlaybook(store: TicketStore, ticketId: string, title: string, requiredPrerequisites: string[], runLog: RunLog): Promise<{ playbook: Playbook; already_existed: boolean }> {
	return runLog.record({ service: 'Modiq', action: 'save_verified_playbook', ticket_id: ticketId }, async () => {
		const result = store.promoteToPlaybook(ticketId, title, requiredPrerequisites);
		return {
			mode: 'real' as const,
			summary: result.already_existed ? `Playbook ${result.playbook.playbook_id} already existed for this ticket (no duplicate saved)` : `Saved new verified playbook ${result.playbook.playbook_id}`,
			value: result,
		};
	});
}

export async function markPlaybookReused(store: TicketStore, playbookId: string, runLog: RunLog, ticketId?: string): Promise<void> {
	await runLog.record({ service: 'Modiq', action: 'mark_playbook_reused', ticket_id: ticketId }, async () => {
		store.incrementPlaybookReuse(playbookId);
		return { mode: 'real' as const, summary: `Incremented reuse_count for ${playbookId}`, value: undefined };
	});
}
