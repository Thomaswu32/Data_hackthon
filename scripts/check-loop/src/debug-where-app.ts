import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RocketRideClient } from 'rocketride';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
function loadEnv(): void {
	const envPath = path.join(REPO_ROOT, '.env');
	for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
		const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
		if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
	}
}
loadEnv();

const appId = 'thomaswu.support-memory-desk';

const deploy = new RocketRideClient({ uri: process.env.ROCKETRIDE_DEPLOY_URI, auth: process.env.ROCKETRIDE_DEPLOY_APIKEY });

try {
	await deploy.connect(undefined, { timeout: 15000 });
	console.log('connected to', process.env.ROCKETRIDE_DEPLOY_URI);
} catch (err) {
	console.log('connect() failed (continuing anyway, REST calls may not need it):', err instanceof Error ? err.message : err);
}

try {
	const deployments = await deploy.listDeployments(appId);
	console.log('listDeployments:', JSON.stringify(deployments, null, 2));
} catch (err) {
	console.log('listDeployments ERROR:', err instanceof Error ? err.message : err);
}

try {
	const where = await deploy.whereApp(appId);
	console.log('whereApp:', JSON.stringify(where, null, 2));
} catch (err) {
	console.log('whereApp ERROR:', err instanceof Error ? err.message : err);
}

await deploy.disconnect().catch(() => {});
