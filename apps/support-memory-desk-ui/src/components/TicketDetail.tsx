import React, { useState } from 'react';
import type { Customer, CreateTicketInput, Ticket } from '@support-desk/core';
import type { DiagnosisState, DeskPhase } from '../hooks/useSupportDesk';
import { cardStyle, colorBorder, colorPrimary, colorPrimaryDark, colorPrimarySoft, colorSubtext, colorText, timeAgo } from '../ui/theme';
import { QuickChecks } from './QuickChecks';
import { NewTicketForm } from './NewTicketForm';

const CONFIRM_QUESTION: Record<string, string> = {
	post_reset_login_fail: 'Can you sign in now?',
	mfa_device_lost: 'Can you complete MFA now?',
	account_locked_out: 'Can you log in now?',
	vpn_cert_expired: 'Can you connect to the VPN now?',
	email_forwarding_spam: 'Is the forwarding rule gone?',
	sso_token_expired: 'Are you staying signed in now?',
	permission_denied_shared_drive: 'Can you access the shared drive now?',
	password_expired_prompt_loop: 'Has the prompt loop stopped?',
};

function confirmationQuestion(symptomCode: string): string {
	return CONFIRM_QUESTION[symptomCode] ?? 'Is it working now?';
}

const primaryButton = (enabled: boolean): React.CSSProperties => ({
	padding: '10px 16px',
	borderRadius: 10,
	border: 'none',
	fontSize: 13,
	fontWeight: 700,
	color: enabled ? '#fff' : '#94a3b8',
	background: enabled ? colorPrimaryDark : '#e2e8f0',
	cursor: enabled ? 'pointer' : 'not-allowed',
});
const secondaryButton: React.CSSProperties = { padding: '10px 16px', borderRadius: 10, border: `1px solid ${colorBorder}`, fontSize: 13, fontWeight: 600, color: colorText, background: '#fff', cursor: 'pointer' };

export const TicketDetail: React.FC<{
	ticket?: Ticket;
	customer?: Customer;
	diagnosis: DiagnosisState | null;
	phase: DeskPhase;
	busy: boolean;
	error: string | null;
	onCreateTicket: (input: CreateTicketInput) => void;
	onUpdatePrerequisite: (key: string, value: boolean) => void;
	onConfirmExecute: () => void;
	onResolve: () => void;
	onEscalate: () => void;
}> = ({ ticket, customer, diagnosis, phase, busy, error, onCreateTicket, onUpdatePrerequisite, onConfirmExecute, onResolve, onEscalate }) => {
	if (!ticket) {
		return (
			<div style={{ height: '100%', overflowY: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
				<div style={{ maxWidth: 440, width: '100%', paddingTop: 24 }}>
					<div style={{ fontSize: 18, fontWeight: 700, color: colorText, marginBottom: 4 }}>What can we help with?</div>
					<div style={{ fontSize: 12, color: colorSubtext, marginBottom: 16 }}>Describe the problem — we'll check past cases and current trends before suggesting a fix.</div>
					<div style={{ ...cardStyle, padding: 18 }}>
						<NewTicketForm onSubmit={onCreateTicket} />
					</div>
				</div>
			</div>
		);
	}

	return (
		// keyed by ticket_id so each ticket's local UI state (expanded sections, quick-check position) starts fresh — never bleeds from a previously viewed ticket
		<div key={ticket.ticket_id} style={{ height: '100%', overflowY: 'auto', padding: '18px 24px 32px' }}>
			<StageRow number={1} title="Describe" state={phase === 'describe' ? 'current' : 'done'}>
				<DescribeSummary ticket={ticket} customer={customer} />
			</StageRow>

			<StageRow number={2} title="Diagnose" state={stageState(phase, 'diagnose')}>
				{stageState(phase, 'diagnose') === 'current' && <DiagnoseStage ticket={ticket} diagnosis={diagnosis} busy={busy} onUpdatePrerequisite={onUpdatePrerequisite} onConfirmExecute={onConfirmExecute} />}
				{stageState(phase, 'diagnose') === 'done' && diagnosis && <DiagnoseSummary diagnosis={diagnosis} />}
			</StageRow>

			<StageRow number={3} title="Take action" state={stageState(phase, 'act')}>
				{stageState(phase, 'act') === 'current' && <ActStage ticket={ticket} busy={busy} onResolve={onResolve} onEscalate={onEscalate} />}
				{stageState(phase, 'act') === 'done' && <ActSummary ticket={ticket} />}
			</StageRow>

			<StageRow number={4} title="Confirm" state={stageState(phase, 'confirm')}>
				{phase === 'resolved' && <ResolvedCard ticket={ticket} error={error} onResolve={onResolve} />}
				{phase === 'escalated' && <EscalatedCard />}
			</StageRow>

			{error && phase !== 'resolved' && <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b', fontSize: 12, padding: 12, marginTop: 4 }}>{error}</div>}
		</div>
	);
};

// --- stage sequencing --------------------------------------------------------

type StageState = 'current' | 'done' | 'upcoming';

function stageState(phase: DeskPhase, stage: 'diagnose' | 'act' | 'confirm'): StageState {
	const order: DeskPhase[] = ['describe', 'diagnose', 'act', 'resolved'];
	const stagePhase: Record<typeof stage, DeskPhase> = { diagnose: 'diagnose', act: 'act', confirm: 'resolved' } as const;
	if (phase === 'escalated') {
		// escalated short-circuits after "act" — diagnose/act read as done, confirm shows the escalated card.
		if (stage === 'confirm') return 'current';
		return 'done';
	}
	const target = stagePhase[stage];
	const curIdx = order.indexOf(phase);
	const targetIdx = order.indexOf(target);
	if (curIdx === targetIdx) return 'current';
	return curIdx > targetIdx ? 'done' : 'upcoming';
}

const StageRow: React.FC<{ number: number; title: string; state: StageState; children?: React.ReactNode }> = ({ number, title, state, children }) => (
	<div style={{ display: 'flex', gap: 12, marginBottom: state === 'upcoming' ? 4 : 14 }}>
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2 }}>
			<div
				style={{
					width: 22,
					height: 22,
					borderRadius: '50%',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontSize: 11,
					fontWeight: 700,
					background: state === 'upcoming' ? '#f1f5f9' : state === 'current' ? colorPrimaryDark : colorPrimarySoft,
					color: state === 'upcoming' ? '#94a3b8' : state === 'current' ? '#fff' : colorPrimary,
					border: state === 'done' ? `1px solid ${colorPrimary}` : 'none',
				}}
			>
				{state === 'done' ? '✓' : number}
			</div>
			{number < 4 && <div style={{ width: 1, flex: 1, minHeight: 14, background: '#e2e8f0', marginTop: 4 }} />}
		</div>
		<div style={{ flex: 1, minWidth: 0, opacity: state === 'upcoming' ? 0.45 : 1 }}>
			<div style={{ fontSize: 11, fontWeight: 700, color: state === 'current' ? colorText : colorSubtext, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: state === 'upcoming' ? 0 : 6 }}>{title}</div>
			{children}
		</div>
	</div>
);

// --- stage 1: describe --------------------------------------------------------

const DescribeSummary: React.FC<{ ticket: Ticket; customer?: Customer }> = ({ ticket, customer }) => (
	<div style={{ ...cardStyle, padding: '10px 14px' }}>
		<div style={{ fontSize: 13, color: colorText }}>{ticket.description}</div>
		<div style={{ fontSize: 11, color: colorSubtext, marginTop: 4 }}>
			{ticket.system} · {customer ? customer.name : ticket.customer_id} · {timeAgo(ticket.created_at)}
		</div>
	</div>
);

// --- stage 2: diagnose --------------------------------------------------------

const DiagnoseStage: React.FC<{
	ticket: Ticket;
	diagnosis: DiagnosisState | null;
	busy: boolean;
	onUpdatePrerequisite: (key: string, value: boolean) => void;
	onConfirmExecute: () => void;
}> = ({ ticket, diagnosis, busy, onUpdatePrerequisite, onConfirmExecute }) => {
	const [showHistory, setShowHistory] = useState(false);
	const [showAllSteps, setShowAllSteps] = useState(false);

	if (!diagnosis) {
		return (
			<div style={{ ...cardStyle, padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
				<Spinner />
				<span style={{ fontSize: 13, color: colorText }}>Checking similar issues…</span>
			</div>
		);
	}

	const { hotdata, history, suggestion } = diagnosis;
	const visibleSteps = showAllSteps ? suggestion.steps : suggestion.steps.slice(0, 3);
	const readyToAct = ticket.status === 'pending_confirmation';

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			{ticket.prerequisite_checks.length > 0 && <QuickChecks checks={ticket.prerequisite_checks} onAnswer={onUpdatePrerequisite} />}

			{hotdata.is_potential_mass_incident && (
				<div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
					Similar issues reported by {hotdata.similar_recent_count} users recently.
				</div>
			)}

			<div style={{ ...cardStyle, padding: 14 }}>
				<div style={{ fontSize: 13, color: colorText, marginBottom: 8 }}>{suggestion.summary}</div>
				<ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: colorText, display: 'flex', flexDirection: 'column', gap: 4 }}>
					{visibleSteps.map((s, i) => (
						<li key={i}>{s.text}</li>
					))}
				</ol>
				{suggestion.steps.length > 3 && (
					<button onClick={() => setShowAllSteps((s) => !s)} style={linkButtonStyle}>
						{showAllSteps ? 'Show fewer' : `View details (${suggestion.steps.length - 3} more)`}
					</button>
				)}
				{suggestion.caveat && <div style={{ marginTop: 8, fontSize: 11.5, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px' }}>{suggestion.caveat}</div>}
			</div>

			<button onClick={() => setShowHistory((s) => !s)} style={linkButtonStyle}>
				{history.length} similar case{history.length === 1 ? '' : 's'} found · {showHistory ? 'Hide' : 'View'}
			</button>
			{showHistory && (
				<div style={{ ...cardStyle, padding: 10 }}>
					{history.length === 0 && <div style={{ fontSize: 12, color: colorSubtext }}>No related history for this system/symptom yet.</div>}
					{history.map((h) => (
						<div key={h.ticket_id} style={{ padding: '6px 4px', borderBottom: `1px solid ${colorBorder}`, fontSize: 12 }}>
							<div style={{ color: colorText }}>{h.description}</div>
							<div style={{ color: colorSubtext, marginTop: 2, fontSize: 11 }}>
								{h.verified ? 'Verified fix' : 'Unverified'} · {h.match_reason}
							</div>
						</div>
					))}
				</div>
			)}

			<button disabled={busy || !readyToAct} onClick={onConfirmExecute} style={{ ...primaryButton(readyToAct && !busy), alignSelf: 'flex-start' }}>
				{busy ? 'Working…' : 'Run approved steps'}
			</button>
		</div>
	);
};

const DiagnoseSummary: React.FC<{ diagnosis: DiagnosisState }> = ({ diagnosis }) => (
	<div style={{ ...cardStyle, padding: '10px 14px', fontSize: 12.5, color: colorSubtext }}>{diagnosis.suggestion.summary}</div>
);

// --- stage 3: take action -----------------------------------------------------

const ActStage: React.FC<{ ticket: Ticket; busy: boolean; onResolve: () => void; onEscalate: () => void }> = ({ ticket, busy, onResolve, onEscalate }) => (
	<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
		<div style={{ ...cardStyle, padding: 14 }}>
			<div style={{ fontSize: 11, fontWeight: 700, color: colorSubtext, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 }}>Steps applied (demo environment)</div>
			<ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: colorText, display: 'flex', flexDirection: 'column', gap: 4 }}>
				{(ticket.resolution_steps ?? []).map((s, i) => (
					<li key={i}>{s}</li>
				))}
			</ol>
		</div>
		<div style={{ ...cardStyle, padding: 14 }}>
			<div style={{ fontSize: 14, fontWeight: 700, color: colorText, marginBottom: 10 }}>{confirmationQuestion(ticket.symptom_code)}</div>
			<div style={{ display: 'flex', gap: 8 }}>
				<button disabled={busy} onClick={onResolve} style={primaryButton(!busy)}>
					Yes, it works
				</button>
				<button disabled={busy} onClick={onEscalate} style={secondaryButton}>
					Still having trouble
				</button>
			</div>
		</div>
	</div>
);

const ActSummary: React.FC<{ ticket: Ticket }> = ({ ticket }) => (
	<div style={{ ...cardStyle, padding: '10px 14px', fontSize: 12.5, color: colorSubtext }}>Applied {(ticket.resolution_steps ?? []).length} step(s) in the demo environment.</div>
);

// --- stage 4: confirm ----------------------------------------------------------

const ResolvedCard: React.FC<{ ticket: Ticket; error: string | null; onResolve: () => void }> = ({ ticket, error, onResolve }) => {
	const saved = Boolean(ticket.playbook_id || ticket.reused_playbook_id);
	return (
		<div style={{ ...cardStyle, padding: 16, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
			<div style={{ fontSize: 14, fontWeight: 700, color: '#166534', marginBottom: 4 }}>✓ Resolved</div>
			{saved && (
				<div style={{ fontSize: 12.5, color: '#166534' }}>
					{ticket.reused_playbook_id ? 'Reused a proven fix — thanks for confirming it worked.' : 'Fix saved for similar issues.'}
				</div>
			)}
			{!saved && !error && <div style={{ fontSize: 12.5, color: '#166534' }}>Resolution recorded.</div>}
			{!saved && error && (
				<div style={{ marginTop: 6 }}>
					<div style={{ fontSize: 12.5, color: '#991b1b' }}>Resolved, but saving this for future reuse failed: {error}</div>
					<button onClick={onResolve} style={{ ...linkButtonStyle, color: colorPrimaryDark }}>
						Retry saving
					</button>
				</div>
			)}
		</div>
	);
};

const EscalatedCard: React.FC = () => (
	<div style={{ ...cardStyle, padding: 16, borderColor: '#fde68a', background: '#fffbeb' }}>
		<div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Escalated to a human</div>
		<div style={{ fontSize: 12.5, color: '#92400e' }}>The confirmed steps didn't resolve it — a specialist will take it from here.</div>
	</div>
);

// --- small shared bits ---------------------------------------------------------

const linkButtonStyle: React.CSSProperties = { alignSelf: 'flex-start', background: 'transparent', border: 'none', color: colorSubtext, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginTop: 4 };

const Spinner: React.FC = () => (
	<span
		style={{
			display: 'inline-block',
			width: 14,
			height: 14,
			borderRadius: '50%',
			border: `2px solid ${colorPrimarySoft}`,
			borderTopColor: colorPrimaryDark,
			animation: 'rr-spin 0.8s linear infinite',
		}}
	/>
);
