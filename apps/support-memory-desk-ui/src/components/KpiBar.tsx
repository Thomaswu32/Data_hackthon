import React from 'react';
import type { KpiSnapshot } from '@support-desk/core';
import { colorBorder, colorSubtext, colorText } from '../ui/theme';

/** Low-visual-weight stat strip — a thin line of numbers, not four large cards. */
export const KpiBar: React.FC<{ kpis: KpiSnapshot }> = ({ kpis }) => (
	<div style={{ display: 'flex', gap: 20, padding: '8px 16px', borderBottom: `1px solid ${colorBorder}`, flexWrap: 'wrap' }}>
		<Stat label="Tickets" value={kpis.total_tickets} />
		<Stat label="Open" value={kpis.open_tickets} />
		<Stat label="SLA breaches" value={kpis.sla_breaches} tone={kpis.sla_breaches > 0 ? 'warn' : 'normal'} />
		<Stat label="Verified playbooks" value={kpis.verified_playbooks} />
	</div>
);

const Stat: React.FC<{ label: string; value: number; tone?: 'normal' | 'warn' }> = ({ label, value, tone = 'normal' }) => (
	<div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
		<span style={{ fontSize: 13, fontWeight: 700, color: tone === 'warn' ? '#b45309' : colorText }}>{value}</span>
		<span style={{ fontSize: 11, color: colorSubtext }}>{label}</span>
	</div>
);
