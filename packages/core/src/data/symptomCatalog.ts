import type { PrerequisiteCheck } from '../types.js';

/**
 * Structured symptom picklist. New tickets pick a symptom_code from here
 * instead of the AI guessing it from free text — this is what lets matching
 * check "system + symptom + prerequisites", not just text similarity.
 */
export interface SymptomDefinition {
	code: string;
	label: string;
	/** Prerequisite checklist a human/agent must work through before a playbook can be trusted to apply. */
	prerequisites: Array<Pick<PrerequisiteCheck, 'key' | 'label'>>;
}

export const SYMPTOM_CATALOG: SymptomDefinition[] = [
	{
		code: 'post_reset_login_fail',
		label: "Can't log in after password reset",
		prerequisites: [
			{ key: 'browser_cache_cleared', label: 'Cleared cached credentials / browser autofill on the client device' },
			{ key: 'account_unlock_confirmed', label: 'Confirmed the account is not still locked from prior failed attempts' },
			{ key: 'mfa_reenrolled', label: 'MFA device re-enrolled after the reset' },
		],
	},
	{
		code: 'mfa_device_lost',
		label: 'Lost or replaced MFA device',
		prerequisites: [
			{ key: 'identity_verified', label: 'Identity verified via backup channel' },
			{ key: 'old_device_revoked', label: 'Old MFA device revoked' },
		],
	},
	{
		code: 'account_locked_out',
		label: 'Account locked out (too many attempts)',
		prerequisites: [{ key: 'lockout_window_elapsed', label: 'Lockout window elapsed or manually cleared' }],
	},
	{
		code: 'vpn_cert_expired',
		label: 'VPN client certificate expired',
		prerequisites: [{ key: 'cert_reissued', label: 'Client certificate reissued' }],
	},
	{
		code: 'email_forwarding_spam',
		label: 'Unexpected email auto-forwarding rule',
		prerequisites: [{ key: 'rule_source_identified', label: 'Source of the forwarding rule identified (phishing vs. self-created)' }],
	},
	{
		code: 'sso_token_expired',
		label: 'SSO session token expired unexpectedly',
		prerequisites: [{ key: 'clock_skew_checked', label: 'Client clock skew checked' }],
	},
	{
		code: 'permission_denied_shared_drive',
		label: 'Permission denied on shared drive',
		prerequisites: [{ key: 'group_membership_checked', label: 'Group/ACL membership checked' }],
	},
	{
		code: 'password_expired_prompt_loop',
		label: 'Repeated "password expired" prompt loop',
		prerequisites: [{ key: 'policy_sync_confirmed', label: 'Password policy sync confirmed across directory replicas' }],
	},
];

export function getSymptomDefinition(code: string): SymptomDefinition | undefined {
	return SYMPTOM_CATALOG.find((s) => s.code === code);
}

export function freshPrerequisiteChecks(code: string): PrerequisiteCheck[] {
	const def = getSymptomDefinition(code);
	if (!def) return [];
	return def.prerequisites.map((p) => ({ key: p.key, label: p.label, value: undefined }));
}
