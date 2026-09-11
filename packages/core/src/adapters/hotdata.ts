import type { HotdataStats, Ticket } from '../types.js';
import type { RunLog } from '../core/runLog.js';
import type { TicketStore } from '../core/ticketStore.js';
import { HOTDATA_LOOKBACK_HOURS, MASS_INCIDENT_THRESHOLD } from '../data/seed.js';

/**
 * Hotdata's role per the project brief is "query current ticket data: count
 * of same-symptom tickets, backlog, product category breakdown, SLA
 * breaches." There is no third-party product named "Hotdata" documented
 * anywhere in this workspace (.rocketride/services-catalog.json has no such
 * entry, and no separate API docs were provided) — so rather than inventing
 * one, this module implements that analytics capability for real, directly
 * over the ticket system of record. It is a genuine, working computation
 * (never mocked/fabricated), just not a third-party integration. See
 * README.md's tool status table.
 */
export async function queryHotdataStats(store: TicketStore, ticket: Pick<Ticket, 'system' | 'symptom_code'>, runLog: RunLog, ticketId?: string): Promise<HotdataStats> {
	return runLog.record({ service: 'Hotdata', action: 'query_current_ticket_stats', ticket_id: ticketId }, async () => {
		const now = Date.now();
		const lookbackMs = HOTDATA_LOOKBACK_HOURS * 60 * 60 * 1000;
		const all = store.listTickets();

		const similarRecent = all.filter((t) => t.system === ticket.system && t.symptom_code === ticket.symptom_code && now - new Date(t.created_at).getTime() <= lookbackMs);

		const byCategory: Record<string, number> = {};
		for (const t of all) {
			byCategory[t.system] = (byCategory[t.system] ?? 0) + 1;
		}

		const openTickets = all.filter((t) => t.status !== 'resolved');
		const slaBreaches = openTickets.filter((t) => new Date(t.sla_due_at).getTime() < now);

		const stats: HotdataStats = {
			system: ticket.system,
			symptom_code: ticket.symptom_code,
			similar_recent_count: similarRecent.length,
			lookback_hours: HOTDATA_LOOKBACK_HOURS,
			is_potential_mass_incident: similarRecent.length >= MASS_INCIDENT_THRESHOLD,
			total_open: openTickets.length,
			total_backlog_over_sla: slaBreaches.length,
			by_category: byCategory,
			sla_breaches: slaBreaches.length,
			computed_at: new Date().toISOString(),
		};

		return {
			mode: 'real' as const,
			summary: `${stats.similar_recent_count} similar tickets in last ${HOTDATA_LOOKBACK_HOURS}h, ${stats.total_open} open, ${stats.sla_breaches} SLA breaches`,
			value: stats,
		};
	});
}
