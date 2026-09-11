import React, { useState } from 'react';
import type { PrerequisiteCheck } from '@support-desk/core';
import { colorBorder, colorPrimary, colorPrimarySoft, colorSubtext, colorSurface, colorText } from '../ui/theme';

/**
 * "A few quick checks" — one prerequisite at a time instead of a long technical
 * checklist. Answers are real ticket state (PrerequisiteCheck.value); "Not sure"
 * is a real, distinct outcome (undefined) — it is never silently treated as
 * satisfied, so the suggestion logic still asks the diagnosing branch for it.
 */
export const QuickChecks: React.FC<{
	checks: PrerequisiteCheck[];
	onAnswer: (key: string, value: boolean) => void;
}> = ({ checks, onAnswer }) => {
	const firstUnanswered = checks.findIndex((c) => c.value === undefined);
	const [index, setIndex] = useState(firstUnanswered === -1 ? 0 : firstUnanswered);

	if (checks.length === 0) return null;
	const safeIndex = Math.min(index, checks.length - 1);
	const current = checks[safeIndex];
	const answeredCount = checks.filter((c) => c.value !== undefined).length;

	const choose = (value: boolean) => {
		onAnswer(current.key, value);
		if (safeIndex < checks.length - 1) setIndex(safeIndex + 1);
	};

	return (
		<div>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
				<span style={{ fontSize: 12, fontWeight: 700, color: colorText }}>A few quick checks</span>
				<span style={{ fontSize: 11, color: colorSubtext }}>
					{safeIndex + 1} of {checks.length} · {answeredCount} answered
				</span>
			</div>
			<div style={{ border: `1px solid ${colorBorder}`, borderRadius: 10, background: colorSurface, padding: 14 }}>
				<div style={{ fontSize: 13, color: colorText, marginBottom: 12 }}>{current.label}</div>
				<div style={{ display: 'flex', gap: 8 }}>
					<AnswerButton label="Yes" active={current.value === true} onClick={() => choose(true)} />
					<AnswerButton label="No" active={current.value === false} onClick={() => choose(false)} />
					<AnswerButton label="Not sure" active={false} muted onClick={() => setIndex(Math.min(safeIndex + 1, checks.length - 1))} />
				</div>
				<div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
					<button
						onClick={() => setIndex(Math.max(0, safeIndex - 1))}
						disabled={safeIndex === 0}
						style={{ background: 'transparent', border: 'none', color: safeIndex === 0 ? '#cbd5e1' : colorSubtext, fontSize: 12, cursor: safeIndex === 0 ? 'default' : 'pointer', padding: 0 }}
					>
						← Back
					</button>
					<div style={{ display: 'flex', gap: 4 }}>
						{checks.map((c, i) => (
							<span
								key={c.key}
								onClick={() => setIndex(i)}
								style={{
									width: 6,
									height: 6,
									borderRadius: 999,
									cursor: 'pointer',
									background: i === safeIndex ? colorPrimary : c.value !== undefined ? '#99f6e4' : '#e2e8f0',
								}}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

const AnswerButton: React.FC<{ label: string; active: boolean; muted?: boolean; onClick: () => void }> = ({ label, active, muted, onClick }) => (
	<button
		onClick={onClick}
		style={{
			flex: 1,
			padding: '8px 10px',
			borderRadius: 8,
			fontSize: 12,
			fontWeight: 600,
			cursor: 'pointer',
			border: `1px solid ${active ? colorPrimary : colorBorder}`,
			background: active ? colorPrimarySoft : '#fff',
			color: active ? colorPrimary : muted ? colorSubtext : colorText,
		}}
	>
		{label}
	</button>
);
