import type { Customer, KpiSnapshot, Playbook, PrerequisiteCheck, Ticket, TicketPriority, TicketStatus } from '../types.js';
import { DEMO_TICKET_1, DEMO_TICKET_2, SEED_CUSTOMERS, SEED_PLAYBOOKS, SEED_TICKETS } from '../data/seed.js';
import { freshPrerequisiteChecks } from '../data/symptomCatalog.js';
import type { KeyValueStore } from './storage.js';
import { createDefaultStore } from './storage.js';

const STORAGE_KEY = 'support_desk_v1';

interface PersistedState {
	tickets: Ticket[];
	customers: Customer[];
	playbooks: Playbook[];
	next_ticket_seq: number;
	next_playbook_seq: number;
}

function slaHoursFor(priority: TicketPriority): number {
	switch (priority) {
		case 'urgent':
			return 4;
		case 'high':
			return 8;
		case 'medium':
			return 24;
		case 'low':
			return 72;
	}
}

function seedState(): PersistedState {
	return {
		tickets: [...SEED_TICKETS],
		customers: [...SEED_CUSTOMERS],
		playbooks: [...SEED_PLAYBOOKS],
		next_ticket_seq: 2001,
		next_playbook_seq: 3001,
	};
}

export interface CreateTicketInput {
	customer_id: string;
	system: string;
	symptom_code: string;
	description: string;
	priority: TicketPriority;
}

/**
 * The app's structured system of record for tickets, customers, and
 * verified playbooks. See storage.ts for why this — rather than HydraDB's
 * raw NL memory interface — is the source of truth for exact-match state
 * and idempotency.
 */
export class TicketStore {
	private state: PersistedState;
	private backend: KeyValueStore;

	constructor(backend?: KeyValueStore) {
		this.backend = backend ?? createDefaultStore();
		this.state = this.load();
	}

	private load(): PersistedState {
		const raw = this.backend.getItem(STORAGE_KEY);
		if (!raw) return seedState();
		try {
			const parsed = JSON.parse(raw) as PersistedState;
			if (!Array.isArray(parsed.tickets) || !Array.isArray(parsed.playbooks)) return seedState();
			return parsed;
		} catch {
			return seedState();
		}
	}

	private persist(): void {
		this.backend.setItem(STORAGE_KEY, JSON.stringify(this.state));
	}

	/** Wipes persisted state back to the fixture seed. Used by check scripts / a "reset demo" action. */
	reset(): void {
		this.state = seedState();
		this.persist();
	}

	// --- reads ------------------------------------------------------------

	listTickets(): Ticket[] {
		return [...this.state.tickets].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
	}

	getTicket(ticketId: string): Ticket | undefined {
		return this.state.tickets.find((t) => t.ticket_id === ticketId);
	}

	getCustomer(customerId: string): Customer | undefined {
		return this.state.customers.find((c) => c.customer_id === customerId);
	}

	listCustomers(): Customer[] {
		return [...this.state.customers];
	}

	listPlaybooks(): Playbook[] {
		return [...this.state.playbooks];
	}

	getPlaybook(playbookId: string): Playbook | undefined {
		return this.state.playbooks.find((p) => p.playbook_id === playbookId);
	}

	kpiSnapshot(): KpiSnapshot {
		const now = Date.now();
		return {
			total_tickets: this.state.tickets.length,
			open_tickets: this.state.tickets.filter((t) => t.status !== 'resolved').length,
			sla_breaches: this.state.tickets.filter((t) => t.status !== 'resolved' && new Date(t.sla_due_at).getTime() < now).length,
			verified_playbooks: this.state.playbooks.length,
		};
	}

	// --- writes -------------------------------------------------------------

	createTicket(input: CreateTicketInput): Ticket {
		const id = `TICK-${this.state.next_ticket_seq++}`;
		const now = Date.now();
		const ticket: Ticket = {
			ticket_id: id,
			customer_id: input.customer_id,
			system: input.system,
			symptom_code: input.symptom_code,
			description: input.description,
			status: 'open',
			priority: input.priority,
			created_at: new Date(now).toISOString(),
			sla_due_at: new Date(now + slaHoursFor(input.priority) * 60 * 60 * 1000).toISOString(),
			prerequisite_checks: freshPrerequisiteChecks(input.symptom_code),
			resolution_steps: null,
			verified: false,
			resolution_saved_at: null,
			playbook_id: null,
			reused_playbook_id: null,
		};
		this.state.tickets.push(ticket);
		this.persist();
		return ticket;
	}

	transitionStatus(ticketId: string, status: TicketStatus): Ticket {
		const ticket = this.requireTicket(ticketId);
		ticket.status = status;
		this.persist();
		return ticket;
	}

	setPrerequisiteChecks(ticketId: string, checks: PrerequisiteCheck[]): Ticket {
		const ticket = this.requireTicket(ticketId);
		ticket.prerequisite_checks = checks;
		this.persist();
		return ticket;
	}

	/** Records the steps that were confirmed and (simulated-)executed for a ticket. Does not mark it verified/resolved by itself. */
	recordExecution(ticketId: string, steps: string[], reusedPlaybookId: string | null): Ticket {
		const ticket = this.requireTicket(ticketId);
		ticket.resolution_steps = steps;
		ticket.reused_playbook_id = reusedPlaybookId;
		ticket.status = 'pending_verification';
		this.persist();
		return ticket;
	}

	/**
	 * Idempotent: saving a resolution twice for the same ticket is a no-op
	 * the second time (returns the already-saved ticket unchanged), per the
	 * "avoid duplicate execution" requirement.
	 */
	saveResolution(ticketId: string, steps: string[]): { ticket: Ticket; already_saved: boolean } {
		const ticket = this.requireTicket(ticketId);
		if (ticket.resolution_saved_at) {
			return { ticket, already_saved: true };
		}
		ticket.resolution_steps = steps;
		ticket.verified = true;
		ticket.status = 'resolved';
		ticket.resolution_saved_at = new Date().toISOString();
		this.persist();
		return { ticket, already_saved: false };
	}

	/**
	 * Idempotent: promoting the same ticket to a playbook twice returns the
	 * existing playbook rather than creating a duplicate.
	 */
	promoteToPlaybook(ticketId: string, title: string, requiredPrerequisites: string[]): { playbook: Playbook; already_existed: boolean } {
		const ticket = this.requireTicket(ticketId);
		if (ticket.playbook_id) {
			const existing = this.getPlaybook(ticket.playbook_id);
			if (existing) return { playbook: existing, already_existed: true };
		}
		if (!ticket.verified || !ticket.resolution_steps) {
			throw new Error(`Cannot promote ticket ${ticketId} to a playbook before it is verified with resolution steps`);
		}
		const playbook: Playbook = {
			playbook_id: `PB-${this.state.next_playbook_seq++}`,
			title,
			system: ticket.system,
			symptom_code: ticket.symptom_code,
			required_prerequisites: requiredPrerequisites,
			steps: ticket.resolution_steps,
			source_ticket_id: ticket.ticket_id,
			verified_at: ticket.resolution_saved_at ?? new Date().toISOString(),
			reuse_count: 0,
		};
		this.state.playbooks.push(playbook);
		ticket.playbook_id = playbook.playbook_id;
		this.persist();
		return { playbook, already_existed: false };
	}

	incrementPlaybookReuse(playbookId: string): void {
		const pb = this.getPlaybook(playbookId);
		if (!pb) return;
		pb.reuse_count += 1;
		this.persist();
	}

	/**
	 * Finds a verified playbook that matches on system + symptom_code AND
	 * whose required prerequisites are all satisfied by the ticket's own
	 * checklist — never on description text alone.
	 */
	findMatchingPlaybook(ticket: Ticket): Playbook | null {
		const checksByKey = new Map(ticket.prerequisite_checks.map((c) => [c.key, c.value]));
		const candidates = this.state.playbooks.filter((pb) => pb.system === ticket.system && pb.symptom_code === ticket.symptom_code);
		for (const pb of candidates) {
			const allSatisfied = pb.required_prerequisites.every((key) => checksByKey.get(key) === true);
			if (allSatisfied) return pb;
		}
		return null;
	}

	private requireTicket(ticketId: string): Ticket {
		const ticket = this.getTicket(ticketId);
		if (!ticket) throw new Error(`Unknown ticket_id: ${ticketId}`);
		return ticket;
	}
}

export function demoTicketInput(which: 1 | 2): CreateTicketInput {
	const base = which === 1 ? DEMO_TICKET_1 : DEMO_TICKET_2;
	return { customer_id: base.customer_id, system: base.system, symptom_code: base.symptom_code, description: base.description, priority: base.priority };
}
