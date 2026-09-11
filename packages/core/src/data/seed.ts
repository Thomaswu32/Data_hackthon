import type { Customer, Playbook, Ticket, TicketPriority } from '../types.js';
import { freshPrerequisiteChecks } from './symptomCatalog.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function iso(offsetMs: number): string {
	return new Date(Date.now() + offsetMs).toISOString();
}

function slaHours(priority: TicketPriority): number {
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

/** Builds a fully-resolved historical ticket, created `agoHours` ago. */
function resolvedTicket(opts: {
	id: string;
	customer_id: string;
	system: string;
	symptom_code: string;
	description: string;
	priority: TicketPriority;
	agoHours: number;
	resolvedAfterHours: number;
	resolution_steps: string[];
	prerequisiteOverrides?: Record<string, boolean>;
}): Ticket {
	const created = -opts.agoHours * HOUR;
	const checks = freshPrerequisiteChecks(opts.symptom_code).map((c) => ({
		...c,
		value: opts.prerequisiteOverrides?.[c.key] ?? true,
	}));
	return {
		ticket_id: opts.id,
		customer_id: opts.customer_id,
		system: opts.system,
		symptom_code: opts.symptom_code,
		description: opts.description,
		status: 'resolved',
		priority: opts.priority,
		created_at: iso(created),
		sla_due_at: iso(created + slaHours(opts.priority) * HOUR),
		prerequisite_checks: checks,
		resolution_steps: opts.resolution_steps,
		verified: true,
		resolution_saved_at: iso(created + opts.resolvedAfterHours * HOUR),
		playbook_id: null,
		reused_playbook_id: null,
	};
}

/** Builds a still-open historical ticket (feeds Hotdata backlog/SLA stats). */
function openTicket(opts: {
	id: string;
	customer_id: string;
	system: string;
	symptom_code: string;
	description: string;
	priority: TicketPriority;
	agoHours: number;
	status?: Ticket['status'];
}): Ticket {
	const created = -opts.agoHours * HOUR;
	return {
		ticket_id: opts.id,
		customer_id: opts.customer_id,
		system: opts.system,
		symptom_code: opts.symptom_code,
		description: opts.description,
		status: opts.status ?? 'open',
		priority: opts.priority,
		created_at: iso(created),
		sla_due_at: iso(created + slaHours(opts.priority) * HOUR),
		prerequisite_checks: freshPrerequisiteChecks(opts.symptom_code),
		resolution_steps: null,
		verified: false,
		resolution_saved_at: null,
		playbook_id: null,
		reused_playbook_id: null,
	};
}

export const SEED_CUSTOMERS: Customer[] = [
	{ customer_id: 'CUST-001', name: 'Alex Rivera', department: 'Finance' },
	{ customer_id: 'CUST-002', name: 'Jordan Lee', department: 'Sales' },
	{ customer_id: 'CUST-003', name: 'Priya Nair', department: 'Engineering' },
	{ customer_id: 'CUST-004', name: 'Sam Okafor', department: 'HR' },
	{ customer_id: 'CUST-005', name: 'Mei Tanaka', department: 'Legal' },
	{ customer_id: 'CUST-006', name: 'Diego Fernandez', department: 'Marketing' },
	{ customer_id: 'CUST-007', name: 'Grace Kim', department: 'Operations' },
	{ customer_id: 'CUST-008', name: 'Noah Whitfield', department: 'Engineering' },
	{ customer_id: 'CUST-009', name: 'Layla Haddad', department: 'Finance' },
	{ customer_id: 'CUST-010', name: 'Ivan Petrov', department: 'Support' },
	{ customer_id: 'CUST-011', name: 'Chidi Obi', department: 'Sales' },
];

// ---------------------------------------------------------------------------
// 20 historical tickets.
//
// Five of them (TICK-1001..1005) look almost identical in free text ("can't
// log in after resetting my password") but differ in system and/or root
// cause/prerequisites — this is the fixture that proves the app is not
// reusing playbooks off text similarity alone.
// ---------------------------------------------------------------------------
export const SEED_TICKETS: Ticket[] = [
	resolvedTicket({
		id: 'TICK-1001',
		customer_id: 'CUST-001',
		system: 'Corporate SSO',
		symptom_code: 'post_reset_login_fail',
		description: "I reset my password this morning but I still can't log in to the company portal. Password is definitely correct.",
		priority: 'high',
		agoHours: 24 * 40,
		resolvedAfterHours: 3,
		resolution_steps: ['Cleared cached Windows Credential Manager entry for the SSO portal', 'Had the user do a full browser sign-out and clear autofill', 'Confirmed login succeeded with the new password'],
		prerequisiteOverrides: { account_unlock_confirmed: true, mfa_reenrolled: true, browser_cache_cleared: true },
	}),
	resolvedTicket({
		id: 'TICK-1002',
		customer_id: 'CUST-002',
		system: 'Corporate SSO',
		symptom_code: 'post_reset_login_fail',
		description: "Password reset went through but login still fails with 'invalid credentials'.",
		priority: 'high',
		agoHours: 24 * 33,
		resolvedAfterHours: 5,
		resolution_steps: ['Checked AD lockout flag — account was still locked from failed attempts before the reset', 'Manually cleared the lockout in Active Directory', 'Verified login succeeded'],
		prerequisiteOverrides: { account_unlock_confirmed: true, mfa_reenrolled: true, browser_cache_cleared: true },
	}),
	// TICK-1003: the root cause behind the two live demo tickets — kept
	// verified (a strong precedent) but deliberately NOT pre-promoted to a
	// Modiq playbook, so the demo shows the first live ticket doing the
	// full diagnose -> confirm -> execute -> save-playbook loop for real.
	resolvedTicket({
		id: 'TICK-1003',
		customer_id: 'CUST-003',
		system: 'Corporate SSO',
		symptom_code: 'post_reset_login_fail',
		description: "Reset my password from the self-service portal, now I can't log in at all — just spins and fails.",
		priority: 'urgent',
		agoHours: 24 * 18,
		resolvedAfterHours: 2,
		resolution_steps: ['Confirmed browser cache and account lockout were not the cause', 'Found MFA device was not re-enrolled after the self-service reset', 'Walked user through MFA re-enrollment in the SSO admin console', 'Verified login succeeded with MFA challenge'],
		prerequisiteOverrides: { account_unlock_confirmed: true, browser_cache_cleared: true, mfa_reenrolled: false },
	}),
	resolvedTicket({
		id: 'TICK-1004',
		customer_id: 'CUST-004',
		system: 'VPN Gateway',
		symptom_code: 'post_reset_login_fail',
		description: "Can't log in after my password reset — same as always, get an auth error immediately.",
		priority: 'medium',
		agoHours: 24 * 12,
		resolvedAfterHours: 6,
		resolution_steps: ['Confirmed this was VPN Gateway, not SSO — different client cert chain', 'Reissued the VPN client certificate tied to the new credentials', 'Reconnected and verified tunnel established'],
	}),
	openTicket({
		id: 'TICK-1005',
		customer_id: 'CUST-005',
		system: 'Corporate SSO',
		symptom_code: 'post_reset_login_fail',
		description: "Reset password yesterday, login is still failing. Haven't had a chance to dig in yet.",
		priority: 'high',
		agoHours: 30,
		status: 'diagnosing',
	}),
	resolvedTicket({
		id: 'TICK-1006',
		customer_id: 'CUST-006',
		system: 'VPN Gateway',
		symptom_code: 'vpn_cert_expired',
		description: 'VPN client refuses to connect, certificate error shown on screen.',
		priority: 'medium',
		agoHours: 24 * 50,
		resolvedAfterHours: 4,
		resolution_steps: ['Confirmed client certificate expiry date had passed', 'Reissued certificate from the internal CA', 'Verified successful VPN connection'],
	}),
	resolvedTicket({
		id: 'TICK-1007',
		customer_id: 'CUST-007',
		system: 'VPN Gateway',
		symptom_code: 'vpn_cert_expired',
		description: 'Getting a certificate expired warning when connecting to VPN from home.',
		priority: 'low',
		agoHours: 24 * 45,
		resolvedAfterHours: 8,
		resolution_steps: ['Verified certificate expiry', 'Reissued certificate', 'Confirmed connection restored'],
	}),
	resolvedTicket({
		id: 'TICK-1008',
		customer_id: 'CUST-008',
		system: 'Email (Exchange)',
		symptom_code: 'email_forwarding_spam',
		description: 'Noticed my sent items has emails being auto-forwarded to an address I do not recognize.',
		priority: 'urgent',
		agoHours: 24 * 20,
		resolvedAfterHours: 1,
		resolution_steps: ['Identified a malicious inbox rule forwarding to an external address', 'Removed the rule and reset the mailbox credentials', 'Confirmed no further forwarding and notified security team'],
	}),
	openTicket({
		id: 'TICK-1009',
		customer_id: 'CUST-009',
		system: 'Email (Exchange)',
		symptom_code: 'email_forwarding_spam',
		description: 'A colleague says replies to my emails are going to a strange external address.',
		priority: 'urgent',
		agoHours: 2,
		status: 'diagnosing',
	}),
	resolvedTicket({
		id: 'TICK-1010',
		customer_id: 'CUST-010',
		system: 'Corporate SSO',
		symptom_code: 'sso_token_expired',
		description: 'Getting logged out every few minutes even though I just signed in.',
		priority: 'medium',
		agoHours: 24 * 60,
		resolvedAfterHours: 3,
		resolution_steps: ['Checked client system clock — found it was 6 minutes fast', 'Corrected clock sync (NTP)', 'Confirmed session persisted normally'],
	}),
	resolvedTicket({
		id: 'TICK-1011',
		customer_id: 'CUST-011',
		system: 'Shared Drive (SharePoint)',
		symptom_code: 'permission_denied_shared_drive',
		description: 'Access denied opening the Finance shared folder that I used to have access to.',
		priority: 'medium',
		agoHours: 24 * 15,
		resolvedAfterHours: 5,
		resolution_steps: ['Checked AD group membership — user had been dropped from Finance-ReadWrite group during a recent audit', 'Re-added user to the group', 'Confirmed access restored'],
	}),
	openTicket({
		id: 'TICK-1012',
		customer_id: 'CUST-001',
		system: 'Shared Drive (SharePoint)',
		symptom_code: 'permission_denied_shared_drive',
		description: "Can't open the shared Marketing folder, says I don't have permission.",
		priority: 'low',
		agoHours: 5,
	}),
	resolvedTicket({
		id: 'TICK-1013',
		customer_id: 'CUST-002',
		system: 'HR Portal',
		symptom_code: 'password_expired_prompt_loop',
		description: 'HR portal keeps asking me to change my password even right after I change it.',
		priority: 'medium',
		agoHours: 24 * 28,
		resolvedAfterHours: 10,
		resolution_steps: ['Found the password policy had not synced to the secondary directory replica', 'Forced a directory replication', 'Confirmed the prompt loop stopped'],
	}),
	resolvedTicket({
		id: 'TICK-1014',
		customer_id: 'CUST-003',
		system: 'Corporate SSO',
		symptom_code: 'mfa_device_lost',
		description: 'Lost my phone, cannot get my MFA push notifications for SSO anymore.',
		priority: 'high',
		agoHours: 24 * 10,
		resolvedAfterHours: 2,
		resolution_steps: ['Verified identity via manager confirmation + badge lookup', 'Revoked old MFA device registration', 'Enrolled temporary MFA on a loaner device'],
	}),
	openTicket({
		id: 'TICK-1015',
		customer_id: 'CUST-004',
		system: 'Corporate SSO',
		symptom_code: 'mfa_device_lost',
		description: 'My MFA device was stolen over the weekend, need it revoked and a new one set up.',
		priority: 'urgent',
		agoHours: 1,
	}),
	resolvedTicket({
		id: 'TICK-1016',
		customer_id: 'CUST-005',
		system: 'Corporate SSO',
		symptom_code: 'account_locked_out',
		description: 'Account got locked after I mistyped my password a few times.',
		priority: 'low',
		agoHours: 24 * 22,
		resolvedAfterHours: 1,
		resolution_steps: ['Confirmed the 30-minute lockout window had elapsed', 'Advised the user to retry, account unlocked automatically', 'Verified login succeeded'],
	}),
	resolvedTicket({
		id: 'TICK-1017',
		customer_id: 'CUST-006',
		system: 'Payroll System',
		symptom_code: 'permission_denied_shared_drive',
		description: 'Payroll export folder access denied for a new team member.',
		priority: 'medium',
		agoHours: 24 * 8,
		resolvedAfterHours: 4,
		resolution_steps: ['Confirmed new hire had not yet been added to the Payroll-View group', 'Added user to group per manager approval', 'Confirmed access'],
	}),
	openTicket({
		id: 'TICK-1018',
		customer_id: 'CUST-007',
		system: 'VPN Gateway',
		symptom_code: 'vpn_cert_expired',
		description: 'VPN certificate expired warning again, same as last month.',
		priority: 'high',
		agoHours: 40,
		status: 'escalated',
	}),
	openTicket({
		id: 'TICK-1019',
		customer_id: 'CUST-008',
		system: 'Corporate SSO',
		symptom_code: 'post_reset_login_fail',
		description: "Reset my password 20 minutes ago and I still can't get into anything.",
		priority: 'high',
		agoHours: 0.5,
	}),
	resolvedTicket({
		id: 'TICK-1020',
		customer_id: 'CUST-009',
		system: 'Email (Exchange)',
		symptom_code: 'sso_token_expired',
		description: 'Outlook keeps prompting for credentials every hour.',
		priority: 'low',
		agoHours: 24 * 25,
		resolvedAfterHours: 6,
		resolution_steps: ['Checked client clock sync — found a large skew', 'Corrected NTP configuration', 'Confirmed prompts stopped'],
	}),
];

// ---------------------------------------------------------------------------
// Two new, similar demo tickets ("employee still can't log in after a
// password reset"). Only the FIRST goes through full diagnosis; the SECOND
// is what proves reuse of the freshly-saved playbook.
// ---------------------------------------------------------------------------
export const DEMO_TICKET_1: Omit<Ticket, 'ticket_id' | 'created_at' | 'sla_due_at' | 'prerequisite_checks' | 'status' | 'resolution_steps' | 'verified' | 'resolution_saved_at' | 'playbook_id' | 'reused_playbook_id'> = {
	customer_id: 'CUST-010',
	system: 'Corporate SSO',
	symptom_code: 'post_reset_login_fail',
	description: "I reset my password from the self-service portal about 15 minutes ago and I still can't log in to any company system. It just says the sign-in failed.",
	priority: 'urgent',
};

export const DEMO_TICKET_2: typeof DEMO_TICKET_1 = {
	customer_id: 'CUST-011',
	system: 'Corporate SSO',
	symptom_code: 'post_reset_login_fail',
	description: "Same issue as a lot of people apparently — reset my password this morning and now nothing will let me log in.",
	priority: 'high',
};

// ---------------------------------------------------------------------------
// Two pre-existing verified playbooks (Modiq), for symptom/system combos
// UNRELATED to the live demo scenario — they exist purely to make the
// "verified playbooks" KPI and Modiq lookups feel populated from history,
// and to give the matching logic real negative cases (system/symptom
// mismatch) to reject.
// ---------------------------------------------------------------------------
export const SEED_PLAYBOOKS: Playbook[] = [
	{
		playbook_id: 'PB-VPN-CERT-001',
		title: 'Reissue expired VPN client certificate',
		system: 'VPN Gateway',
		symptom_code: 'vpn_cert_expired',
		required_prerequisites: ['cert_reissued'],
		steps: ['Confirm certificate expiry in the VPN console', 'Reissue client certificate from the internal CA', 'Have the user reconnect and confirm tunnel established'],
		source_ticket_id: 'TICK-1006',
		verified_at: iso(-24 * 50 * HOUR + 4 * HOUR),
		reuse_count: 1,
	},
	{
		playbook_id: 'PB-EMAIL-FWD-001',
		title: 'Remove malicious auto-forwarding rule',
		system: 'Email (Exchange)',
		symptom_code: 'email_forwarding_spam',
		required_prerequisites: ['rule_source_identified'],
		steps: ['Identify the malicious inbox rule', 'Remove the rule', 'Reset mailbox credentials', 'Notify the security team'],
		source_ticket_id: 'TICK-1008',
		verified_at: iso(-24 * 20 * HOUR + HOUR),
		reuse_count: 0,
	},
];

export const MASS_INCIDENT_THRESHOLD = 3;
export const HOTDATA_LOOKBACK_HOURS = 48;

/** Fixed system picklist used by the "new ticket" form — kept in sync with the systems used across the seed tickets/playbooks above, since matching depends on exact string equality. */
export const SYSTEMS: string[] = ['Corporate SSO', 'VPN Gateway', 'Email (Exchange)', 'HR Portal', 'Shared Drive (SharePoint)', 'Payroll System'];
