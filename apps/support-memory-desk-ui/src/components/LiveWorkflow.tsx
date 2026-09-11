import React, { useEffect, useMemo, useState } from 'react';
import type { RunLogActiveCall, RunLogEntry, RunLogService } from '@support-desk/core';
import { colorBorder, colorSubtext, colorSurface, colorText, nodeStateColors, type NodeState } from '../ui/theme';

/** The five software nodes this app's workflow can light up. Snyk is intentionally excluded — it is a project-level scan, not a per-ticket workflow step. */
const NODE_SERVICES = ['RocketRide', 'Cognee', 'HydraDB', 'Hotdata', 'Modiq'] as const satisfies readonly RunLogService[];
type NodeService = (typeof NODE_SERVICES)[number];

const NODE_META: Record<NodeService, { label: string; blurb: string; monogram: string }> = {
	RocketRide: { label: 'RocketRide', blurb: 'Coordinates', monogram: 'RR' },
	Cognee: { label: 'Cognee', blurb: 'Finds past cases', monogram: 'Cg' },
	HydraDB: { label: 'HydraDB', blurb: 'Saves records', monogram: 'Hy' },
	Hotdata: { label: 'Hotdata', blurb: 'Checks live trends', monogram: 'Ho' },
	Modiq: { label: 'Modiq', blurb: 'Reuses proven fixes', monogram: 'Mq' },
};

const ACTIVITY_SENTENCE: Record<NodeService, string> = {
	RocketRide: 'RocketRide is drafting a suggestion.',
	Cognee: 'Cognee is finding similar cases.',
	HydraDB: 'HydraDB is saving the resolution.',
	Hotdata: 'Hotdata is checking recent tickets.',
	Modiq: 'Modiq is looking for a proven fix.',
};

// Layout: RocketRide at the center, the other four arranged around it — top, right, bottom, left.
const CENTER = { x: 150, y: 150 };
const SATELLITES: { service: NodeService; angleDeg: number }[] = [
	{ service: 'Cognee', angleDeg: -90 },
	{ service: 'Hotdata', angleDeg: 0 },
	{ service: 'HydraDB', angleDeg: 90 },
	{ service: 'Modiq', angleDeg: 180 },
];
const SAT_RADIUS = 108;
const NODE_R = 30;
const CENTER_R = 34;

function pointFor(angleDeg: number, radius: number) {
	const rad = (angleDeg * Math.PI) / 180;
	return { x: CENTER.x + radius * Math.cos(rad), y: CENTER.y + radius * Math.sin(rad) };
}

function usePrefersReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		if (typeof window === 'undefined' || !window.matchMedia) return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		setReduced(mq.matches);
		const onChange = () => setReduced(mq.matches);
		mq.addEventListener?.('change', onChange);
		return () => mq.removeEventListener?.('change', onChange);
	}, []);
	return reduced;
}

export interface NodeSnapshot {
	service: RunLogService;
	state: NodeState;
	lastEntry?: RunLogEntry;
}

/**
 * Derives each node's visual state from REAL data only:
 * - a matching active (in-flight) call for this ticket -> 'running'
 * - else the most recent completed entry for this ticket -> 'success' (real), 'simulated' (mock), or 'error'
 * - else -> 'idle'
 * No fixed timers, no invented sequencing — this mirrors whatever actually happened for the selected ticket.
 */
function deriveNodeStates(activeCalls: RunLogActiveCall[], entries: RunLogEntry[], ticketId: string | undefined): Map<RunLogService, NodeSnapshot> {
	const map = new Map<RunLogService, NodeSnapshot>();
	for (const service of NODE_SERVICES) {
		const running = ticketId && activeCalls.some((c) => c.service === service && c.ticket_id === ticketId);
		if (running) {
			map.set(service, { service, state: 'running' });
			continue;
		}
		const last = ticketId ? entries.find((e) => e.service === service && e.ticket_id === ticketId) : undefined;
		if (!last) {
			map.set(service, { service, state: 'idle' });
			continue;
		}
		const state: NodeState = last.mode === 'error' ? 'error' : last.mode === 'mock' ? 'simulated' : 'success';
		map.set(service, { service, state, lastEntry: last });
	}
	return map;
}

function overallHeadline(ticketStatus: string | undefined, anyRunning: boolean, anyWaiting: boolean): string {
	if (!ticketStatus) return 'No ticket selected';
	if (anyRunning) return ticketStatus === 'diagnosing' || ticketStatus === 'open' ? 'Analyzing your issue' : ticketStatus === 'resolved' ? 'Saving the solution' : 'Working…';
	if (ticketStatus === 'resolved') return 'Completed';
	if (ticketStatus === 'escalated') return 'Escalated to a human';
	if (anyWaiting) return 'Waiting for your confirmation';
	return 'Ready';
}

export const LiveWorkflow: React.FC<{
	activeCalls: RunLogActiveCall[];
	entries: RunLogEntry[];
	ticketId?: string;
	ticketStatus?: string;
	rocketrideConnected: boolean;
}> = ({ activeCalls, entries, ticketId, ticketStatus, rocketrideConnected }) => {
	const reducedMotion = usePrefersReducedMotion();
	const [showDetails, setShowDetails] = useState(false);

	const states = useMemo(() => deriveNodeStates(activeCalls, entries, ticketId), [activeCalls, entries, ticketId]);
	const runningServices = useMemo(() => NODE_SERVICES.filter((s) => states.get(s)?.state === 'running'), [states]);
	const waitingOnHuman = ticketStatus === 'pending_confirmation' || ticketStatus === 'pending_verification';

	// The coordinator node reflects human-confirmation pauses (amber) when nothing is in flight — everything else stays idle/simulated/success from its own last real call.
	const centerState: NodeState = runningServices.includes('RocketRide') ? 'running' : waitingOnHuman && runningServices.length === 0 ? 'waiting' : (states.get('RocketRide')?.state ?? 'idle');

	const headline = overallHeadline(ticketStatus, runningServices.length > 0, waitingOnHuman);
	const activitySentence =
		runningServices.length === 1
			? ACTIVITY_SENTENCE[runningServices[0]]
			: runningServices.length > 1
				? `${runningServices.map((s) => NODE_META[s].label).join(' and ')} are working on it.`
				: waitingOnHuman
					? 'Waiting on you to confirm the next step.'
					: ticketStatus === 'resolved'
						? 'All done — the resolution is saved.'
						: '';

	const ticketEntries = useMemo(() => (ticketId ? entries.filter((e) => e.ticket_id === ticketId) : []), [entries, ticketId]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colorSurface }}>
			<div style={{ padding: '14px 16px 4px' }}>
				<div style={{ fontSize: 13, fontWeight: 700, color: colorText }}>Live workflow</div>
				<div style={{ fontSize: 12, color: colorSubtext, marginTop: 2 }}>{headline}</div>
			</div>

			<div style={{ padding: '4px 8px 0', display: 'flex', justifyContent: 'center' }}>
				<svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 280 }} role="img" aria-label={`Workflow diagram: ${headline}`}>
					{SATELLITES.map(({ service, angleDeg }) => {
						const p = pointFor(angleDeg, SAT_RADIUS);
						const snap = states.get(service)!;
						const running = snap.state === 'running';
						return <Edge key={`edge-${service}`} x1={CENTER.x} y1={CENTER.y} x2={p.x} y2={p.y} active={running} reducedMotion={reducedMotion} />;
					})}

					<Node cx={CENTER.x} cy={CENTER.y} r={CENTER_R} service="RocketRide" state={centerState} meta={NODE_META.RocketRide} reducedMotion={reducedMotion} subLabel={rocketrideConnected ? undefined : 'not connected'} />

					{SATELLITES.map(({ service, angleDeg }) => {
						const p = pointFor(angleDeg, SAT_RADIUS);
						const snap = states.get(service)!;
						return <Node key={service} cx={p.x} cy={p.y} r={NODE_R} service={service} state={snap.state} meta={NODE_META[service]} reducedMotion={reducedMotion} />;
					})}
				</svg>
			</div>

			<div style={{ padding: '2px 16px 10px', textAlign: 'center', minHeight: 32 }}>
				<span style={{ fontSize: 12, color: colorSubtext }}>{activitySentence}</span>
			</div>

			<div style={{ borderTop: `1px solid ${colorBorder}`, marginTop: 'auto' }}>
				<button
					onClick={() => setShowDetails((s) => !s)}
					style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', fontSize: 12, fontWeight: 600, color: colorSubtext, cursor: 'pointer' }}
					aria-expanded={showDetails}
				>
					{showDetails ? '▾' : '▸'} View technical details
				</button>
				{showDetails && (
					<div style={{ maxHeight: 260, overflowY: 'auto', borderTop: `1px solid ${colorBorder}` }}>
						{ticketEntries.length === 0 && <div style={{ padding: 14, fontSize: 12, color: colorSubtext }}>No calls yet for this ticket.</div>}
						{ticketEntries.map((e) => (
							<div key={e.id} style={{ padding: '8px 16px', borderBottom: `1px solid ${colorBorder}`, fontSize: 11 }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', color: colorText, fontWeight: 600 }}>
									<span>
										{e.service} · {e.action}
									</span>
									<span style={{ color: e.mode === 'error' ? '#991b1b' : e.mode === 'mock' ? '#64748b' : '#166534' }}>{e.mode === 'mock' ? 'DEMO' : e.mode.toUpperCase()}</span>
								</div>
								<div style={{ color: colorSubtext, marginTop: 2 }}>{e.summary}</div>
								<div style={{ color: colorSubtext, marginTop: 2 }}>
									{e.duration_ms}ms · {new Date(e.ts).toLocaleTimeString()}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

const Edge: React.FC<{ x1: number; y1: number; x2: number; y2: number; active: boolean; reducedMotion: boolean }> = ({ x1, y1, x2, y2, active, reducedMotion }) => (
	<g>
		<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={active ? '#0d9488' : '#e2e8f0'} strokeWidth={active ? 2 : 1.5} />
		{active && !reducedMotion && (
			<circle r={3.5} fill="#14b8a6">
				<animateMotion dur="1.1s" repeatCount="indefinite" path={`M ${x1} ${y1} L ${x2} ${y2}`} />
			</circle>
		)}
	</g>
);

const Node: React.FC<{
	cx: number;
	cy: number;
	r: number;
	service: string;
	state: NodeState;
	meta: { label: string; blurb: string; monogram: string };
	reducedMotion: boolean;
	subLabel?: string;
}> = ({ cx, cy, r, state, meta, reducedMotion, subLabel }) => {
	const colors = nodeStateColors[state];
	const pulsing = state === 'running' && !reducedMotion;
	return (
		<g>
			{pulsing && <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.ring} strokeWidth={2} opacity={0.5}>
				<animate attributeName="r" values={`${r};${r + 8};${r}`} dur="1.6s" repeatCount="indefinite" />
				<animate attributeName="opacity" values="0.5;0;0.5" dur="1.6s" repeatCount="indefinite" />
			</circle>}
			<circle cx={cx} cy={cy} r={r} fill={colors.fill} stroke={colors.ring} strokeWidth={state === 'idle' ? 1.5 : 2.5} />
			<text x={cx} y={cy - 2} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.fg} fontFamily="inherit">
				{meta.monogram}
			</text>
			<StateGlyph cx={cx} cy={cy + r + 9} state={state} />
			<text x={cx} y={cy + r + 24} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#334155" fontFamily="inherit">
				{meta.label}
			</text>
			<text x={cx} y={cy + r + 37} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="inherit">
				{subLabel ?? stateLabel(state, meta.blurb)}
			</text>
		</g>
	);
};

function stateLabel(state: NodeState, blurb: string): string {
	switch (state) {
		case 'running':
			return 'Running…';
		case 'success':
			return 'Done';
		case 'error':
			return 'Error';
		case 'waiting':
			return 'Waiting on you';
		case 'simulated':
			return 'Demo';
		default:
			return blurb;
	}
}

const StateGlyph: React.FC<{ cx: number; cy: number; state: NodeState }> = ({ cx, cy, state }) => {
	const colors = nodeStateColors[state];
	if (state === 'success') {
		return (
			<path d={`M ${cx - 4} ${cy} l 2.5 3 l 5 -6`} stroke={colors.ring} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
		);
	}
	if (state === 'error') {
		return (
			<g stroke={colors.ring} strokeWidth={1.8} strokeLinecap="round">
				<line x1={cx - 3.5} y1={cy - 3.5} x2={cx + 3.5} y2={cy + 3.5} />
				<line x1={cx + 3.5} y1={cy - 3.5} x2={cx - 3.5} y2={cy + 3.5} />
			</g>
		);
	}
	if (state === 'waiting') {
		return <circle cx={cx} cy={cy} r={3} fill={colors.ring} />;
	}
	return <circle cx={cx} cy={cy} r={2.5} fill={colors.ring} opacity={state === 'idle' ? 0.6 : 1} />;
};
