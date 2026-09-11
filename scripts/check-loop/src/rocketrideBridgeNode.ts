import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RocketRideClient, Question } from 'rocketride';
import type { AgentAnswer, PipelineKey, RocketRideBridge } from '@support-desk/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const PIPELINES_DIR = path.join(REPO_ROOT, 'pipelines');

/**
 * The RocketRide SDK's automatic .env loading resolves relative to
 * process.cwd(), which is scripts/check-loop when run via `pnpm --filter`
 * — not the repo root where .env actually lives. Load it explicitly here
 * instead of relying on that lookup.
 */
function loadRepoRootEnv(): void {
	const envPath = path.join(REPO_ROOT, '.env');
	if (!fs.existsSync(envPath)) return;
	for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
	}
}
loadRepoRootEnv();

const PIPELINE_FILE: Record<PipelineKey, string> = {
	cognee: path.join(PIPELINES_DIR, 'cognee_recall.pipe'),
	hydradb: path.join(PIPELINES_DIR, 'hydradb_persist.pipe'),
	suggestion: path.join(PIPELINES_DIR, 'suggest.pipe'),
};

function hasAnyLlmKey(): boolean {
	return Boolean(process.env.ROCKETRIDE_ANTHROPIC_KEY || process.env.ROCKETRIDE_OPENAI_KEY || process.env.ROCKETRIDE_GEMINI_KEY || process.env.ROCKETRIDE_MISTRAL_KEY);
}

function pipelineIsConfigured(key: PipelineKey): boolean {
	if (!hasAnyLlmKey()) return false;
	if (key === 'cognee') return Boolean(process.env.ROCKETRIDE_COGNEE_BASE_URL && process.env.ROCKETRIDE_COGNEE_API_KEY);
	if (key === 'hydradb') return Boolean(process.env.ROCKETRIDE_HYDRADB_API_KEY && process.env.ROCKETRIDE_HYDRADB_DATABASE);
	return true; // 'suggestion' only needs an LLM key
}

/**
 * Real RocketRide bridge for Node-side scripts, backed by the public
 * `rocketride` npm SDK (confirmed reachable against this workspace's
 * .env credentials). Each pipeline is started lazily and reused
 * (useExisting: true) per ROCKETRIDE_COMMON_MISTAKES.md guidance.
 */
export class NodeRocketRideBridge implements RocketRideBridge {
	private client: InstanceType<typeof RocketRideClient> | null = null;
	private connected = false;
	private tokens = new Map<PipelineKey, string>();

	async connect(): Promise<void> {
		this.client = new RocketRideClient();
		await this.client.connect(undefined, { timeout: 15000 });
		this.connected = true;
	}

	async disconnect(): Promise<void> {
		if (this.client) await this.client.disconnect();
		this.connected = false;
	}

	isConnected(): boolean {
		return this.connected;
	}

	isConfigured(pipelineKey: PipelineKey): boolean {
		return pipelineIsConfigured(pipelineKey);
	}

	private async tokenFor(pipelineKey: PipelineKey): Promise<string> {
		const existing = this.tokens.get(pipelineKey);
		if (existing) return existing;
		if (!this.client) throw new Error('RocketRide client not connected');
		const result = await this.client.use({ filepath: PIPELINE_FILE[pipelineKey], useExisting: true });
		this.tokens.set(pipelineKey, result.token);
		return result.token;
	}

	async askAgent(pipelineKey: PipelineKey, question: string, context?: Record<string, unknown>): Promise<AgentAnswer> {
		const token = await this.tokenFor(pipelineKey);
		const q = new Question();
		q.addQuestion(question);
		if (context) q.addContext(context);
		const response = await this.client!.chat({ token, question: q });
		const answers = (response as { answers?: string[] }).answers;
		if (!answers || answers.length === 0) throw new Error(`Pipeline ${pipelineKey} returned no answer`);
		return { raw: answers[0] };
	}
}
