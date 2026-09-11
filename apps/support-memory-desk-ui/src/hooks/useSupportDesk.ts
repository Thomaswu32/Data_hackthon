import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
	TicketStore,
	RunLog,
	diagnoseTicket,
	confirmAndExecute,
	markResolved,
	demoTicketInput,
	getSymptomDefinition,
	type Ticket,
	type RunLogEntry,
	type RunLogActiveCall,
	type Suggestion,
	type HistoryMatch,
	type HotdataStats,
	type Playbook,
	type PrerequisiteCheck,
	type CreateTicketInput,
} from '@support-desk/core';
import { getBrowserBridge } from '../adapters/rocketrideBridgeBrowser';

export interface DiagnosisState {
	history: HistoryMatch[];
	hotdata: HotdataStats;
	matchedPlaybook: Playbook | null;
	suggestion: Suggestion;
}

/** The four user-facing stages the middle panel walks through. Derived from real ticket status — never set directly by the UI. */
export type DeskPhase = 'describe' | 'diagnose' | 'act' | 'confirm' | 'resolved' | 'escalated';

export function phaseForTicket(ticket: Ticket | undefined): DeskPhase {
	if (!ticket) return 'describe';
	switch (ticket.status) {
		case 'open':
		case 'diagnosing':
		case 'pending_confirmation':
			return 'diagnose';
		case 'executing':
		case 'pending_verification':
			return 'act';
		case 'resolved':
			return 'resolved';
		case 'escalated':
			return 'escalated';
		default:
			return 'diagnose';
	}
}

export function useSupportDesk() {
	const storeRef = useRef<TicketStore>();
	const runLogRef = useRef<RunLog>();
	if (!storeRef.current) storeRef.current = new TicketStore();
	if (!runLogRef.current) runLogRef.current = new RunLog();
	const store = storeRef.current;
	const runLog = runLogRef.current;
	const bridge = useMemo(() => getBrowserBridge(), []);

	const [version, setVersion] = useState(0);
	const bump = useCallback(() => setVersion((v) => v + 1), []);

	const [logEntries, setLogEntries] = useState<RunLogEntry[]>(runLog.list());
	useEffect(() => runLog.subscribe(setLogEntries), [runLog]);

	const [activeCalls, setActiveCalls] = useState<RunLogActiveCall[]>(runLog.listActive());
	useEffect(() => runLog.subscribeActive(setActiveCalls), [runLog]);

	const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
	const [diagnosis, setDiagnosis] = useState<DiagnosisState | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const tickets = useMemo(() => store.listTickets(), [store, version]);
	const kpis = useMemo(() => store.kpiSnapshot(), [store, version]);
	const playbooks = useMemo(() => store.listPlaybooks(), [store, version]);
	const customers = useMemo(() => store.listCustomers(), [store, version]);
	const selectedTicket: Ticket | undefined = useMemo(() => (selectedTicketId ? store.getTicket(selectedTicketId) : undefined), [store, selectedTicketId, version]);

	const runDiagnosis = useCallback(
		async (ticketId: string) => {
			setBusy(true);
			setError(null);
			try {
				const result = await diagnoseTicket(store, ticketId, runLog, bridge);
				setDiagnosis({ history: result.history, hotdata: result.hotdata, matchedPlaybook: result.matchedPlaybook, suggestion: result.suggestion });
				bump();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[store, runLog, bridge, bump]
	);

	const selectTicket = useCallback(
		(ticketId: string) => {
			setSelectedTicketId(ticketId);
			setDiagnosis(null);
			void runDiagnosis(ticketId);
		},
		[runDiagnosis]
	);

	const createTicket = useCallback(
		(input: CreateTicketInput) => {
			const ticket = store.createTicket(input);
			bump();
			selectTicket(ticket.ticket_id);
			return ticket;
		},
		[store, bump, selectTicket]
	);

	const createDemoTicket = useCallback(
		(which: 1 | 2) => {
			return createTicket(demoTicketInput(which));
		},
		[createTicket]
	);

	const updatePrerequisite = useCallback(
		(ticketId: string, key: string, value: boolean) => {
			const ticket = store.getTicket(ticketId);
			if (!ticket) return;
			const next: PrerequisiteCheck[] = ticket.prerequisite_checks.map((c) => (c.key === key ? { ...c, value } : c));
			store.setPrerequisiteChecks(ticketId, next);
			bump();
			void runDiagnosis(ticketId);
		},
		[store, bump, runDiagnosis]
	);

	const confirmExecute = useCallback(
		async (ticketId: string) => {
			if (!diagnosis) return;
			setBusy(true);
			setError(null);
			try {
				const steps = diagnosis.suggestion.steps.map((s) => s.text);
				const reusedId = diagnosis.suggestion.is_playbook_reuse ? diagnosis.matchedPlaybook?.playbook_id ?? null : null;
				await confirmAndExecute(store, ticketId, steps, reusedId, runLog);
				bump();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[store, runLog, diagnosis, bump]
	);

	const resolveTicket = useCallback(
		async (ticketId: string) => {
			setBusy(true);
			setError(null);
			try {
				await markResolved(store, ticketId, runLog, bridge);
				bump();
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setBusy(false);
			}
		},
		[store, runLog, bridge, bump]
	);

	/** Human says the confirmed fix did NOT resolve it — a real status transition (escalated), not a dead end. */
	const escalateTicket = useCallback(
		(ticketId: string) => {
			store.transitionStatus(ticketId, 'escalated');
			runLog.append({ service: 'App', action: 'escalate_to_human', mode: 'mock', duration_ms: 0, summary: 'Human reported the confirmed steps did not resolve the issue', ticket_id: ticketId });
			bump();
		},
		[store, runLog, bump]
	);

	const resetDemo = useCallback(() => {
		store.reset();
		runLog.append({ service: 'App', action: 'reset_demo_data', mode: 'mock', duration_ms: 0, summary: 'Restored the 20 seed tickets + 2 pre-existing playbooks' });
		setSelectedTicketId(null);
		setDiagnosis(null);
		bump();
	}, [store, runLog, bump]);

	const phase = phaseForTicket(selectedTicket);

	return {
		tickets,
		kpis,
		playbooks,
		customers,
		logEntries,
		activeCalls,
		selectedTicket,
		diagnosis,
		phase,
		busy,
		error,
		selectTicket,
		createTicket,
		createDemoTicket,
		updatePrerequisite,
		confirmExecute,
		resolveTicket,
		escalateTicket,
		resetDemo,
		getSymptomDefinition,
	};
}
