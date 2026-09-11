// =============================================================================
// Persistence abstraction.
//
// The Compounding Support Desk's single source of truth for tickets,
// customers, and verified playbooks lives behind this interface. In the
// browser app it is backed by localStorage (so data survives a page
// refresh / reopening the app — "cross-session" within one browser
// profile). In Node (the check/demo scripts) it is backed by a JSON file
// on disk, so a second script run can prove reuse of what the first run
// saved. Either way it is the SAME persistence contract, so the domain
// logic in ticketStore.ts never has to know which one it's talking to.
//
// Real HydraDB write-through (see adapters/hydradb.ts) happens IN ADDITION
// to this store, not instead of it — HydraDB's actual interface is a
// natural-language memory store/recall, not an exact-match structured
// database, so it cannot alone guarantee the idempotency and exact-field
// queries this app requires. See README.md "Data & storage" section.
// =============================================================================

export interface KeyValueStore {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export function createMemoryStore(): KeyValueStore {
	const map = new Map<string, string>();
	return {
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => {
			map.set(key, value);
		},
	};
}

/** Uses window.localStorage when available (browser); throws if called elsewhere. */
export function createLocalStorageStore(): KeyValueStore {
	const g = globalThis as unknown as { localStorage?: KeyValueStore };
	if (!g.localStorage) {
		throw new Error('localStorage is not available in this environment');
	}
	return g.localStorage;
}

/** Picks localStorage when present, otherwise an in-memory store (safe default for SSR/tests). */
export function createDefaultStore(): KeyValueStore {
	const g = globalThis as unknown as { localStorage?: KeyValueStore };
	if (g.localStorage) return g.localStorage;
	return createMemoryStore();
}
