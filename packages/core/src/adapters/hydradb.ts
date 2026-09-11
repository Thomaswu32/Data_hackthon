import type { Ticket } from '../types.js';
import type { RunLog } from '../core/runLog.js';
import type { RocketRideBridge } from './rocketrideBridge.js';

/**
 * HydraDB's job per the project brief: persist customers/tickets/resolutions
 * and their associations, readable across sessions. RocketRide's actual
 * db_hydradb node is a managed graph + memory store exposed ONLY as
 * agent-callable "store memory (with automatic knowledge-graph extraction) /
 * recall by natural-language query" tools — it is not a structured
 * relational store with exact-field queries. So this app's real source of
 * truth for exact-match reads (ticket_id lookups, idempotent status
 * transitions, SLA computations) is the local structured store
 * (core/ticketStore.ts + storage.ts); see README.md "Data & storage".
 *
 * This adapter's real path pushes a write-through memory of each verified
 * resolution into HydraDB (via a RocketRide agent + db_hydradb pipeline —
 * see pipelines/hydradb_persist.pipe) purely as genuine cross-session,
 * semantic backup/recall, additive to (never a replacement for) the
 * structured store. It needs a HydraDB API key + database AND an LLM
 * provider key, neither configured in this workspace — falls back to a
 * clearly-labeled no-op mock otherwise.
 */
export async function persistResolutionToHydraDb(ticket: Ticket, bridge: RocketRideBridge, runLog: RunLog): Promise<void> {
	await runLog.record({ service: 'HydraDB', action: 'persist_ticket_resolution', ticket_id: ticket.ticket_id }, async () => {
		if (bridge.isConfigured('hydradb') && bridge.isConnected()) {
			try {
				await bridge.askAgent(
					'hydradb',
					`Store this as a memory: ticket ${ticket.ticket_id} for customer ${ticket.customer_id} on system ${ticket.system} was resolved. Symptom: ${ticket.symptom_code}. Verified steps: ${JSON.stringify(ticket.resolution_steps)}.`
				);
				return { mode: 'real' as const, summary: `Wrote ${ticket.ticket_id} resolution to HydraDB`, value: undefined };
			} catch (err) {
				return { mode: 'error' as const, summary: err instanceof Error ? err.message : String(err), value: undefined };
			}
		}
		return { mode: 'mock' as const, summary: 'HydraDB not configured — resolution already durable in the local structured store (system of record)', value: undefined };
	});
}
