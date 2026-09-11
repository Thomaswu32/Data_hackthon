import React, { useEffect, useRef, useState } from 'react';
import type { CreateTicketInput, Ticket } from '@support-desk/core';
import { badgeStyle, colorBorder, colorPrimaryDark, colorSubtext, colorSurface, colorText, statusColors, timeAgo } from '../ui/theme';
import { NewTicketForm } from './NewTicketForm';

export const TicketList: React.FC<{
	tickets: Ticket[];
	selectedTicketId?: string;
	onSelect: (id: string) => void;
	onCreate: (input: CreateTicketInput) => void;
	onCreateDemo: (which: 1 | 2) => void;
	onReset: () => void;
}> = ({ tickets, selectedTicketId, onSelect, onCreate, onCreateDemo, onReset }) => {
	const [showForm, setShowForm] = useState(false);
	const [showDemoMenu, setShowDemoMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!showDemoMenu) return;
		const onClick = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowDemoMenu(false);
		};
		document.addEventListener('mousedown', onClick);
		return () => document.removeEventListener('mousedown', onClick);
	}, [showDemoMenu]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: `1px solid ${colorBorder}`, background: colorSurface }}>
			<div style={{ padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
					<strong style={{ color: colorText, fontSize: 15 }}>Tickets</strong>
					<div ref={menuRef} style={{ position: 'relative' }}>
						<button onClick={() => setShowDemoMenu((s) => !s)} style={ghostIconButtonStyle} aria-label="Demo tools" title="Demo tools">
							⋯
						</button>
						{showDemoMenu && (
							<div style={{ position: 'absolute', right: 0, top: 28, zIndex: 5, background: colorSurface, border: `1px solid ${colorBorder}`, borderRadius: 10, boxShadow: '0 6px 16px rgba(15,23,42,0.12)', minWidth: 176, overflow: 'hidden' }}>
								<div style={{ padding: '6px 12px', fontSize: 10, color: colorSubtext, textTransform: 'uppercase', letterSpacing: 0.4 }}>Demo tools</div>
								<MenuItem
									label="Create demo ticket #1"
									onClick={() => {
										onCreateDemo(1);
										setShowDemoMenu(false);
									}}
								/>
								<MenuItem
									label="Create demo ticket #2"
									onClick={() => {
										onCreateDemo(2);
										setShowDemoMenu(false);
									}}
								/>
								<MenuItem
									label="Reset demo data"
									onClick={() => {
										onReset();
										setShowDemoMenu(false);
									}}
								/>
							</div>
						)}
					</div>
				</div>
				<button onClick={() => setShowForm((s) => !s)} style={primaryButtonStyle}>
					{showForm ? 'Cancel' : '+ New ticket'}
				</button>
				{showForm && (
					<div style={{ paddingTop: 4 }}>
						<NewTicketForm
							onSubmit={(input) => {
								onCreate(input);
								setShowForm(false);
							}}
						/>
					</div>
				)}
			</div>
			<div style={{ overflowY: 'auto', flex: 1 }}>
				{tickets.map((t) => {
					const selected = t.ticket_id === selectedTicketId;
					const st = statusColors[t.status];
					const title = t.description.length > 46 ? `${t.description.slice(0, 46)}…` : t.description;
					return (
						<div
							key={t.ticket_id}
							onClick={() => onSelect(t.ticket_id)}
							style={{
								padding: '10px 14px',
								cursor: 'pointer',
								background: selected ? '#f0fdfa' : 'transparent',
								borderLeft: selected ? `3px solid ${colorPrimaryDark}` : '3px solid transparent',
							}}
						>
							<div style={{ fontSize: 13, color: colorText, lineHeight: 1.35 }}>{title}</div>
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
								<span style={badgeStyle(st.bg, st.fg)}>{t.status.replace(/_/g, ' ')}</span>
								<span style={{ fontSize: 11, color: colorSubtext }}>{timeAgo(t.created_at)}</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

const MenuItem: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
	<button
		onClick={onClick}
		style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: colorText, background: 'transparent', border: 'none', cursor: 'pointer' }}
		onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
		onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
	>
		{label}
	</button>
);

const primaryButtonStyle: React.CSSProperties = { background: colorPrimaryDark, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' };
const ghostIconButtonStyle: React.CSSProperties = { background: 'transparent', color: colorSubtext, border: `1px solid ${colorBorder}`, borderRadius: 8, padding: '3px 8px', fontSize: 13, cursor: 'pointer', lineHeight: 1.4 };
