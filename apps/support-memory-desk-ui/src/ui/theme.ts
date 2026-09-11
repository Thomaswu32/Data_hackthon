import type { CSSProperties } from 'react';
import type { RunLogMode, TicketPriority, TicketStatus } from '@support-desk/core';

export const fontStack = 'var(--rr-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)';
export const colorText = 'var(--rr-text-primary, #0f172a)';
export const colorSubtext = 'var(--rr-text-secondary, #64748b)';
export const colorBorder = 'var(--rr-border, #e2e8f0)';
export const colorSurface = 'var(--rr-surface, #ffffff)';
export const colorSurfaceMuted = 'var(--rr-surface-muted, #f8fafc)';
/** Page ground — light gray, so white cards read as distinct surfaces. */
export const colorPageBg = 'var(--rr-page-bg, #f5f7fa)';
/** Teal/cyan brand accent — the one saturated color in an otherwise quiet, white-card UI. */
export const colorPrimary = '#0d9488';
export const colorPrimaryDark = '#0f766e';
export const colorPrimarySoft = '#f0fdfa';
export const colorPrimaryBorder = '#99f6e4';

export const cardStyle: CSSProperties = { background: colorSurface, border: `1px solid ${colorBorder}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' };

/** Visual states for a Live workflow node — distinct from RunLogMode (real/mock/error), which only describes a *finished* call. */
export type NodeState = 'idle' | 'running' | 'success' | 'error' | 'waiting' | 'simulated';

export const nodeStateColors: Record<NodeState, { ring: string; fill: string; fg: string }> = {
	idle: { ring: '#cbd5e1', fill: '#f1f5f9', fg: '#94a3b8' },
	running: { ring: colorPrimary, fill: colorPrimarySoft, fg: colorPrimaryDark },
	success: { ring: '#22c55e', fill: '#f0fdf4', fg: '#166534' },
	error: { ring: '#ef4444', fill: '#fef2f2', fg: '#991b1b' },
	waiting: { ring: '#f59e0b', fill: '#fffbeb', fg: '#92400e' },
	simulated: { ring: '#94a3b8', fill: '#f8fafc', fg: '#64748b' },
};

export const statusColors: Record<TicketStatus, { bg: string; fg: string }> = {
	open: { bg: '#e0f2fe', fg: '#075985' },
	diagnosing: { bg: '#fef9c3', fg: '#854d0e' },
	pending_confirmation: { bg: '#ede9fe', fg: '#5b21b6' },
	executing: { bg: '#ffedd5', fg: '#9a3412' },
	pending_verification: { bg: '#fce7f3', fg: '#9d174d' },
	resolved: { bg: '#dcfce7', fg: '#166534' },
	escalated: { bg: '#fee2e2', fg: '#991b1b' },
};

export const priorityColors: Record<TicketPriority, { bg: string; fg: string }> = {
	low: { bg: '#f1f5f9', fg: '#475569' },
	medium: { bg: '#e0f2fe', fg: '#075985' },
	high: { bg: '#ffedd5', fg: '#9a3412' },
	urgent: { bg: '#fee2e2', fg: '#991b1b' },
};

export const modeColors: Record<RunLogMode, { bg: string; fg: string; label: string }> = {
	real: { bg: '#dcfce7', fg: '#166534', label: 'REAL' },
	mock: { bg: '#f1f5f9', fg: '#475569', label: 'MOCK' },
	error: { bg: '#fee2e2', fg: '#991b1b', label: 'ERROR' },
};

export function badgeStyle(bg: string, fg: string): CSSProperties {
	return {
		display: 'inline-block',
		padding: '2px 8px',
		borderRadius: 999,
		fontSize: 11,
		fontWeight: 600,
		letterSpacing: 0.3,
		textTransform: 'uppercase',
		background: bg,
		color: fg,
		whiteSpace: 'nowrap',
	};
}

export function timeAgo(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const abs = Math.abs(diffMs);
	const mins = Math.round(abs / 60000);
	const label = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
	let text: string;
	if (mins < 60) text = label(mins, 'min');
	else if (mins < 60 * 24) text = label(Math.round(mins / 60), 'hour');
	else text = label(Math.round(mins / (60 * 24)), 'day');
	return diffMs >= 0 ? `${text} ago` : `in ${text}`;
}
