import type { RunLogEntry, RunLogMode, RunLogService } from '../types.js';

const MAX_ENTRIES = 200;

/** A call that has started but not yet finished — the real, observable in-flight state (not a fabricated timer). */
export interface RunLogActiveCall {
	id: string;
	service: RunLogService;
	action: string;
	ticket_id?: string;
	started_at: string;
}

/**
 * Records what the app actually did — every external call it made (or would
 * have made in mock mode), tagged real / mock / error, with a real measured
 * duration. This is what powers the "run log" panel; nothing here is
 * fabricated after the fact.
 *
 * Also tracks which calls are CURRENTLY in flight (`listActive`/`subscribeActive`)
 * so a UI can show a genuine "running" state for the exact duration of the real
 * async call, instead of inferring activity from a fixed timer.
 */
export class RunLog {
	private entries: RunLogEntry[] = [];
	private listeners = new Set<(entries: RunLogEntry[]) => void>();
	private active: RunLogActiveCall[] = [];
	private activeListeners = new Set<(active: RunLogActiveCall[]) => void>();

	list(): RunLogEntry[] {
		return this.entries;
	}

	subscribe(fn: (entries: RunLogEntry[]) => void): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	private emit() {
		for (const fn of this.listeners) fn(this.entries);
	}

	listActive(): RunLogActiveCall[] {
		return this.active;
	}

	subscribeActive(fn: (active: RunLogActiveCall[]) => void): () => void {
		this.activeListeners.add(fn);
		return () => this.activeListeners.delete(fn);
	}

	private emitActive() {
		for (const fn of this.activeListeners) fn(this.active);
	}

	append(entry: Omit<RunLogEntry, 'id' | 'ts'>): RunLogEntry {
		const full: RunLogEntry = {
			...entry,
			id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			ts: new Date().toISOString(),
		};
		this.entries = [full, ...this.entries].slice(0, MAX_ENTRIES);
		this.emit();
		return full;
	}

	/** Wraps an async call, measuring real elapsed time and recording the outcome. Marks the call "active" for its real duration. */
	async record<T>(meta: { service: RunLogService; action: string; ticket_id?: string }, fn: () => Promise<{ mode: RunLogMode; summary: string; value: T }>): Promise<T> {
		const start = performance.now();
		const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		this.active = [...this.active, { id: callId, ...meta, started_at: new Date().toISOString() }];
		this.emitActive();
		try {
			const { mode, summary, value } = await fn();
			this.append({ ...meta, mode, summary, duration_ms: Math.round(performance.now() - start) });
			return value;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.append({ ...meta, mode: 'error', summary: message, duration_ms: Math.round(performance.now() - start) });
			throw err;
		} finally {
			this.active = this.active.filter((c) => c.id !== callId);
			this.emitActive();
		}
	}
}
