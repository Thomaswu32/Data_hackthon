import React, { useEffect, useState } from 'react';
import { useSupportDesk } from './hooks/useSupportDesk';
import { KpiBar } from './components/KpiBar';
import { TicketList } from './components/TicketList';
import { TicketDetail } from './components/TicketDetail';
import { LiveWorkflow } from './components/LiveWorkflow';
import { colorBorder, colorPageBg, colorSubtext, colorSurface, colorText, fontStack } from './ui/theme';

const GLOBAL_STYLE = `
@keyframes rr-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
}
`;

function useNarrowViewport(breakpoint: number): boolean {
	const [narrow, setNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onResize = () => setNarrow(window.innerWidth < breakpoint);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [breakpoint]);
	return narrow;
}

export const Dashboard: React.FC<{ connected: boolean; displayName?: string }> = ({ connected, displayName }) => {
	const desk = useSupportDesk();
	const stackList = useNarrowViewport(680);
	const hideWorkflow = useNarrowViewport(960);
	const [workflowOpen, setWorkflowOpen] = useState(false);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: fontStack, color: colorText, background: colorPageBg }}>
			<style>{GLOBAL_STYLE}</style>

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colorBorder}`, background: colorSurface }}>
				<div style={{ padding: '10px 16px' }}>
					<div style={{ fontSize: 15, fontWeight: 700 }}>Compounding Support Desk</div>
				</div>
				<div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
					{hideWorkflow && (
						<button onClick={() => setWorkflowOpen((s) => !s)} style={{ fontSize: 11, fontWeight: 600, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>
							{workflowOpen ? 'Hide workflow' : 'Live workflow'}
						</button>
					)}
					<span style={{ fontSize: 11, color: colorSubtext }}>{connected ? `Connected · ${displayName ?? 'signed in'}` : 'Preview mode (local data only)'}</span>
				</div>
			</div>

			<KpiBar kpis={desk.kpis} />

			<div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: stackList ? 'column' : 'row' }}>
				<div style={{ width: stackList ? '100%' : 240, height: stackList ? 260 : 'auto', flexShrink: 0 }}>
					<TicketList tickets={desk.tickets} selectedTicketId={desk.selectedTicket?.ticket_id} onSelect={desk.selectTicket} onCreate={desk.createTicket} onCreateDemo={desk.createDemoTicket} onReset={desk.resetDemo} />
				</div>

				<div style={{ flex: 1, minWidth: 0, borderRight: !stackList && !hideWorkflow ? `1px solid ${colorBorder}` : undefined }}>
					<TicketDetail
						ticket={desk.selectedTicket}
						customer={desk.selectedTicket ? desk.customers.find((c) => c.customer_id === desk.selectedTicket!.customer_id) : undefined}
						diagnosis={desk.diagnosis}
						phase={desk.phase}
						busy={desk.busy}
						error={desk.error}
						onCreateTicket={desk.createTicket}
						onUpdatePrerequisite={(key, value) => desk.selectedTicket && desk.updatePrerequisite(desk.selectedTicket.ticket_id, key, value)}
						onConfirmExecute={() => desk.selectedTicket && desk.confirmExecute(desk.selectedTicket.ticket_id)}
						onResolve={() => desk.selectedTicket && desk.resolveTicket(desk.selectedTicket.ticket_id)}
						onEscalate={() => desk.selectedTicket && desk.escalateTicket(desk.selectedTicket.ticket_id)}
					/>
				</div>

				{(!hideWorkflow || workflowOpen) && (
					<div style={{ width: hideWorkflow ? '100%' : 320, flexShrink: 0, borderTop: hideWorkflow ? `1px solid ${colorBorder}` : undefined, maxHeight: hideWorkflow ? 420 : undefined }}>
						<LiveWorkflow
							activeCalls={desk.activeCalls}
							entries={desk.logEntries}
							ticketId={desk.selectedTicket?.ticket_id}
							ticketStatus={desk.selectedTicket?.status}
							rocketrideConnected={connected}
						/>
					</div>
				)}
			</div>
		</div>
	);
};
