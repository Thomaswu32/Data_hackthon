import React, { useState } from 'react';
import { SYMPTOM_CATALOG, SYSTEMS, type CreateTicketInput, type TicketPriority } from '@support-desk/core';
import { colorBorder, colorPrimaryDark, colorSubtext, colorSurface, colorText } from '../ui/theme';

const selectStyle: React.CSSProperties = { padding: '7px 8px', borderRadius: 8, border: `1px solid ${colorBorder}`, fontSize: 12, color: colorText, background: colorSurface };
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: colorSubtext, display: 'block', marginBottom: 3 };

/**
 * The primary "describe" step: one prominent free-text question drives the
 * flow. System + symptom stay structured pickers (never guessed from text —
 * that is what makes playbook matching trustworthy), but are visually
 * secondary. Customer/priority default sensibly and hide behind "More options".
 */
export const NewTicketForm: React.FC<{ onSubmit: (input: CreateTicketInput) => void }> = ({ onSubmit }) => {
	const [customerId, setCustomerId] = useState('CUST-001');
	const [system, setSystem] = useState(SYSTEMS[0]);
	const [symptomCode, setSymptomCode] = useState(SYMPTOM_CATALOG[0].code);
	const [description, setDescription] = useState('');
	const [priority, setPriority] = useState<TicketPriority>('medium');
	const [showMore, setShowMore] = useState(false);

	const canSubmit = description.trim().length > 0;

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				if (!canSubmit) return;
				onSubmit({ customer_id: customerId, system, symptom_code: symptomCode, description: description.trim(), priority });
			}}
			style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
		>
			<div>
				<label style={{ fontSize: 14, fontWeight: 700, color: colorText, display: 'block', marginBottom: 6 }}>What's going wrong?</label>
				<textarea
					autoFocus
					value={description}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="I reset my password but still can't sign in."
					style={{ width: '100%', minHeight: 68, padding: '10px 12px', borderRadius: 10, border: `1px solid ${colorBorder}`, fontSize: 13, color: colorText, resize: 'vertical', boxSizing: 'border-box' }}
				/>
			</div>

			<div style={{ display: 'flex', gap: 8 }}>
				<div style={{ flex: 1 }}>
					<label style={labelStyle}>System</label>
					<select style={{ ...selectStyle, width: '100%' }} value={system} onChange={(e) => setSystem(e.target.value)}>
						{SYSTEMS.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				</div>
				<div style={{ flex: 1 }}>
					<label style={labelStyle}>Symptom</label>
					<select style={{ ...selectStyle, width: '100%' }} value={symptomCode} onChange={(e) => setSymptomCode(e.target.value)}>
						{SYMPTOM_CATALOG.map((s) => (
							<option key={s.code} value={s.code}>
								{s.label}
							</option>
						))}
					</select>
				</div>
			</div>

			<button type="button" onClick={() => setShowMore((s) => !s)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: colorSubtext, fontSize: 11, cursor: 'pointer', padding: 0 }}>
				{showMore ? '▾' : '▸'} More options
			</button>
			{showMore && (
				<div style={{ display: 'flex', gap: 8 }}>
					<div style={{ flex: 1 }}>
						<label style={labelStyle}>Customer ID</label>
						<input style={{ ...selectStyle, width: '100%', boxSizing: 'border-box' }} value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="CUST-001" />
					</div>
					<div style={{ flex: 1 }}>
						<label style={labelStyle}>Priority</label>
						<select style={{ ...selectStyle, width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
							<option value="urgent">Urgent</option>
						</select>
					</div>
				</div>
			)}

			<button
				type="submit"
				disabled={!canSubmit}
				style={{
					background: canSubmit ? colorPrimaryDark : '#cbd5e1',
					color: '#fff',
					border: 'none',
					borderRadius: 10,
					padding: '10px 14px',
					fontSize: 13,
					fontWeight: 700,
					cursor: canSubmit ? 'pointer' : 'not-allowed',
				}}
			>
				Find a fix
			</button>
		</form>
	);
};
