// =============================================================================
// The one seam between framework-agnostic domain logic (this package) and an
// actual RocketRide pipeline connection.
//
// packages/core never imports the 'rocketride' SDK or the app's 'shell'
// package directly — those are wired up at the call site (the RocketRide
// app's src/rocketrideBridge.ts, or scripts/check-loop's Node harness) and
// injected here as a plain interface. That keeps this package runnable
// under a bare `tsx` with no platform packages installed, and keeps every
// external call swappable/mockable per adapter, per the "each external
// service gets its own adapter, independently debuggable" requirement.
// =============================================================================

export type PipelineKey = 'cognee' | 'hydradb' | 'suggestion';

export interface AgentAnswer {
	/** Raw text returned by the pipeline's response_answers lane. Callers must validate/parse defensively — an LLM answer is data, not a contract. */
	raw: string;
}

export interface RocketRideBridge {
	/** Whether the required env vars / credentials for this pipeline are present (does not itself prove connectivity). */
	isConfigured(pipelineKey: PipelineKey): boolean;
	/** Whether a live, authenticated RocketRide connection is currently established. */
	isConnected(): boolean;
	/** Runs the given pipeline's chat source with a question + optional structured context, returning its raw answer text. Throws on transport/pipeline failure — callers decide whether to fall back to mock mode. */
	askAgent(pipelineKey: PipelineKey, question: string, context?: Record<string, unknown>): Promise<AgentAnswer>;
}

/** A bridge that reports nothing configured/connected — used whenever no real client was wired up, so every adapter deterministically falls back to its labeled mock path. */
export const UNCONFIGURED_BRIDGE: RocketRideBridge = {
	isConfigured: () => false,
	isConnected: () => false,
	askAgent: async () => {
		throw new Error('RocketRide bridge not configured');
	},
};
