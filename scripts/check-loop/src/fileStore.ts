import fs from 'node:fs';
import type { KeyValueStore } from '@support-desk/core';

/**
 * File-backed KeyValueStore for Node — lets the check script simulate a
 * fresh session (a new TicketStore instance re-reading from disk) to prove
 * data survives "closing and reopening" the app, mirroring what
 * localStorage gives the browser build.
 */
export function createFileStore(filePath: string): KeyValueStore {
	return {
		getItem: (key) => {
			if (!fs.existsSync(filePath)) return null;
			const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, string>;
			return raw[key] ?? null;
		},
		setItem: (key, value) => {
			const raw = fs.existsSync(filePath) ? (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, string>) : {};
			raw[key] = value;
			fs.writeFileSync(filePath, JSON.stringify(raw, null, 2));
		},
	};
}
