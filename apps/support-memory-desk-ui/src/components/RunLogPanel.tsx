import React from 'react';
import type { RunLogEntry } from '@support-desk/core';
import { badgeStyle, colorBorder, colorSubtext, colorSurfaceMuted, colorText, modeColors } from '../ui/theme';

export const RunLogPanel: React.FC<{ entries: RunLogEntry[] }> = ({ entries }) => (
	<div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: `1px solid ${colorBorder}`, background: colorSurfaceMuted }}>
		<div style={{ padding: '12px 14px', borderBottom: `1px solid ${colorBorder}` }}>
			<strong style={{ color: colorText, fontSize: 14 }}>Run log</strong>
			<div style={{ fontSize: 11, color: colorSubtext, marginTop: 2 }}>Every call this app made — real, mock, or failed — with measured duration.</div>
		</div>
		<div style={{ overflowY: 'auto', flex: 1 }}>
			{entries.length === 0 && <div style={{ padding: 14, fontSize: 12, color: colorSubtext }}>No activity yet — select or create a ticket to see calls appear here.</div>}
			{entries.map((e) => {
				const mc = modeColors[e.mode];
				return (
					<div key={e.id} style={{ padding: '9px 14px', borderBottom: `1px solid ${colorBorder}` }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span style={{ fontSize: 12, fontWeight: 600, color: colorText }}>
								{e.service} · {e.action}
							</span>
							<span style={badgeStyle(mc.bg, mc.fg)}>{mc.label}</span>
						</div>
						<div style={{ fontSize: 11, color: colorSubtext, marginTop: 2 }}>{e.summary}</div>
						<div style={{ fontSize: 10, color: colorSubtext, marginTop: 2 }}>
							{e.duration_ms}ms {e.ticket_id ? `· ${e.ticket_id}` : ''} · {new Date(e.ts).toLocaleTimeString()}
						</div>
					</div>
				);
			})}
		</div>
	</div>
);
