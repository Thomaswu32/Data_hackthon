// =============================================================================
// Domain types for the Compounding Support Desk.
// =============================================================================

export type TicketStatus = 'open' | 'diagnosing' | 'pending_confirmation' | 'executing' | 'pending_verification' | 'resolved' | 'escalated';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/** A named yes/no precondition that gates whether a playbook applies. */
export interface PrerequisiteCheck {
	key: string;
	label: string;
	/** undefined = not yet checked during diagnosis. */
	value?: boolean;
}

export interface Ticket {
	ticket_id: string;
	customer_id: string;
	/** The system the issue is about, e.g. "Corporate SSO". Used for playbook matching — never inferred from free text alone. */
	system: string;
	description: string;
	/** Coarse symptom classification used for retrieval + matching (set at creation from a picklist, not guessed from text). */
	symptom_code: string;
	status: TicketStatus;
	priority: TicketPriority;
	created_at: string; // ISO timestamp
	sla_due_at: string; // ISO timestamp
	/** Prerequisite checklist relevant to this symptom; filled in during diagnosis. */
	prerequisite_checks: PrerequisiteCheck[];
	/** Steps that were actually executed/confirmed for this ticket (once known). */
	resolution_steps: string[] | null;
	/** True only after a human explicitly confirms the issue is solved. An AI suggestion alone never sets this. */
	verified: boolean;
	/** Set once a resolution has been persisted, to make save-resolution idempotent. */
	resolution_saved_at: string | null;
	/** Set once this resolution has been promoted to a reusable Modiq playbook, to make promotion idempotent. */
	playbook_id: string | null;
	/** If this ticket was resolved by reusing an existing playbook, its id. */
	reused_playbook_id: string | null;
}

export interface Customer {
	customer_id: string;
	name: string;
	department: string;
}

/** A verified, reusable resolution procedure (Modiq's domain object). */
export interface Playbook {
	playbook_id: string;
	title: string;
	system: string;
	symptom_code: string;
	/** Prerequisite keys that MUST be true for this playbook to be a valid match — not just text similarity. */
	required_prerequisites: string[];
	steps: string[];
	source_ticket_id: string;
	verified_at: string;
	reuse_count: number;
}

export interface HistoryMatch {
	ticket_id: string;
	system: string;
	symptom_code: string;
	description: string;
	status: TicketStatus;
	verified: boolean;
	resolution_steps: string[] | null;
	/** Why this was retrieved — helps the UI show "why" a case was surfaced. */
	match_reason: string;
	relevance: number; // 0..1
}

export interface HotdataStats {
	system: string;
	symptom_code: string;
	/** Tickets with the same system+symptom created within the lookback window. */
	similar_recent_count: number;
	lookback_hours: number;
	/** Whether this count crosses the configured mass-incident threshold. */
	is_potential_mass_incident: boolean;
	total_open: number;
	total_backlog_over_sla: number;
	by_category: Record<string, number>;
	sla_breaches: number;
	computed_at: string;
}

export interface SuggestionStep {
	text: string;
	kind: 'diagnostic' | 'action';
}

export interface Suggestion {
	summary: string;
	steps: SuggestionStep[];
	cited_ticket_ids: string[];
	cited_playbook_id: string | null;
	confidence: 'low' | 'medium' | 'high';
	/** True when this suggestion is a direct reuse of an existing verified playbook (all prerequisites already satisfied). */
	is_playbook_reuse: boolean;
	/** Human-readable caveat, e.g. missing prerequisite checks, or mass-incident warning. */
	caveat: string | null;
}

export type RunLogService = 'RocketRide' | 'Cognee' | 'HydraDB' | 'Hotdata' | 'Modiq' | 'Snyk' | 'App';
export type RunLogMode = 'real' | 'mock' | 'error';

export interface RunLogEntry {
	id: string;
	ts: string;
	service: RunLogService;
	action: string;
	mode: RunLogMode;
	duration_ms: number;
	summary: string;
	ticket_id?: string;
}

export interface KpiSnapshot {
	total_tickets: number;
	open_tickets: number;
	sla_breaches: number;
	verified_playbooks: number;
}
