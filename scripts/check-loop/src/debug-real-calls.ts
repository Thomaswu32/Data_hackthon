import { NodeRocketRideBridge } from './rocketrideBridgeNode.js';

const bridge = new NodeRocketRideBridge();
await bridge.connect();

for (const key of ['cognee', 'hydradb'] as const) {
	console.log(`\n=== ${key} ===`);
	console.log('isConfigured:', bridge.isConfigured(key));
	try {
		const answer = await bridge.askAgent(key, key === 'cognee' ? 'Recall anything about ticket TICK-9999.' : 'Store this as a memory: debug ping.');
		console.log('OK:', answer.raw.slice(0, 300));
	} catch (err) {
		console.log('ERROR:', err instanceof Error ? err.message : String(err));
		if (err instanceof Error && err.stack) console.log(err.stack.split('\n').slice(0, 5).join('\n'));
	}
}

await bridge.disconnect();
