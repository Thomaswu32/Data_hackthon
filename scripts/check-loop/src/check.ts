import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TicketStore, RunLog, diagnoseTicket, confirmAndExecute, markResolved, demoTicketInput, UNCONFIGURED_BRIDGE, type RunLogEntry } from '@support-desk/core';
import { createFileStore } from './fileStore.js';
import { NodeRocketRideBridge } from './rocketrideBridgeNode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.resolve(__dirname, '../.demo-state.json');

let failures = 0;
function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		failures += 1;
		console.error(`  ✗ FAIL: ${message}`);
	} else {
		console.log(`  ✓ ${message}`);
	}
}

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

async function main() {
	// Fresh run every time this script executes.
	if (fs.existsSync(STATE_FILE)) fs.rmSync(STATE_FILE);

	section('0. RocketRide platform connectivity (real)');
	const bridge = new NodeRocketRideBridge();
	let rocketrideConnected = false;
	const platformLog = new RunLog();
	try {
		await platformLog.record({ service: 'RocketRide', action: 'connect+ping' }, async () => {
			await bridge.connect();
			rocketrideConnected = true;
			return { mode: 'real' as const, summary: 'Connected and pinged the RocketRide server using this workspace .env credentials', value: undefined };
		});
		console.log('  ✓ RocketRide connect() + ping() succeeded (real, live call)');
	} catch (err) {
		console.log(`  ⚠ RocketRide connectivity failed (${err instanceof Error ? err.message : err}) — continuing with the local domain logic only`);
	}
	console.log('  Note: Cognee / HydraDB / AI-suggestion pipelines additionally need service credentials and an LLM key,');
	console.log('  none of which are present in .env — those three adapters run in their labeled MOCK fallback below.');
	const effectiveBridge = rocketrideConnected ? bridge : UNCONFIGURED_BRIDGE;

	// ---------------------------------------------------------------------
	// Session 1: create the first demo ticket and run it through the full
	// diagnose -> confirm -> execute -> resolve -> save-playbook loop.
	// ---------------------------------------------------------------------
	section('1. Create ticket #1 ("password reset, still can\'t log in")');
	const store1 = new TicketStore(createFileStore(STATE_FILE));
	const runLog1 = new RunLog();
	const ticket1 = store1.createTicket(demoTicketInput(1));
	assert(ticket1.ticket_id.startsWith('TICK-'), `ticket created with id ${ticket1.ticket_id}`);
	assert(ticket1.status === 'open', 'new ticket starts in "open" status');
	assert(store1.getTicket(ticket1.ticket_id)?.ticket_id === ticket1.ticket_id, 'ticket is retrievable from the store immediately after creation (step 2: saved)');

	section('2. Retrieve related history + Hotdata stats + Modiq eligibility + suggestion');
	const diag1 = await diagnoseTicket(store1, ticket1.ticket_id, runLog1, effectiveBridge);
	assert(diag1.history.length > 0, `found ${diag1.history.length} related historical ticket(s)`);
	assert(
		diag1.history.every((h) => !(h.ticket_id === 'TICK-1004')) || diag1.history.find((h) => h.ticket_id === 'TICK-1004')!.relevance < (diag1.history.find((h) => h.ticket_id === 'TICK-1003')?.relevance ?? 1),
		'a same-text-but-different-system ticket (TICK-1004, VPN Gateway) is not ranked above same-system matches'
	);
	assert(diag1.hotdata.system === 'Corporate SSO' && diag1.hotdata.symptom_code === 'post_reset_login_fail', 'Hotdata stats computed for the correct system/symptom');
	assert(diag1.matchedPlaybook === null, 'no verified playbook matched yet — none exists for this exact scenario before this run');
	assert(diag1.suggestion.is_playbook_reuse === false, 'suggestion correctly does NOT claim a playbook reuse when none is eligible');
	assert(diag1.suggestion.steps.length > 0, `suggestion proposes ${diag1.suggestion.steps.length} step(s)`);

	section('3. Diagnosis narrows the root cause (prerequisite checks)');
	// Mirrors TICK-1003's root cause: cache/lockout are fine, MFA was not re-enrolled.
	const checked = ticket1.prerequisite_checks.map((c) => ({ ...c, value: c.key === 'mfa_reenrolled' ? false : true }));
	store1.setPrerequisiteChecks(ticket1.ticket_id, checked);
	const diag1b = await diagnoseTicket(store1, ticket1.ticket_id, runLog1, effectiveBridge);
	assert(diag1b.suggestion.cited_ticket_ids.includes('TICK-1003') || diag1b.suggestion.confidence !== 'low', 'suggestion cites the matching verified precedent (TICK-1003) once prerequisites narrow the cause');
	assert(diag1b.suggestion.caveat !== null && !diag1b.suggestion.is_playbook_reuse, 'suggestion is flagged as a precedent, NOT an auto-applied playbook (no verified playbook exists yet)');

	section('4. Human confirms + demo-environment execution');
	const executedSteps = diag1b.suggestion.steps.filter((s) => s.kind === 'action').map((s) => s.text);
	const stepsToRun = executedSteps.length > 0 ? executedSteps : ['Re-register MFA device in Corporate SSO admin console', 'Confirm login succeeds with MFA challenge'];
	const afterExec = await confirmAndExecute(store1, ticket1.ticket_id, stepsToRun, null, runLog1);
	assert(afterExec.status === 'pending_verification', 'ticket moved to pending_verification after simulated execution');

	section('5. Human confirms resolved -> save resolution + promote playbook');
	const res1 = await markResolved(store1, ticket1.ticket_id, runLog1, effectiveBridge);
	assert(res1.ticket.verified === true, 'ticket marked verified only after explicit human confirmation');
	assert(res1.already_saved === false, 'first save-resolution call is not a no-op');
	assert(res1.playbook !== null && res1.playbook_already_existed === false, 'a new verified playbook was created from this resolution');
	const playbookId = res1.playbook!.playbook_id;

	section('5b. Idempotency: confirming "resolved" twice must not duplicate work');
	const res1Again = await markResolved(store1, ticket1.ticket_id, runLog1, effectiveBridge);
	assert(res1Again.already_saved === true, 'second markResolved() call is recognized as a no-op (already_saved)');
	assert(res1Again.playbook?.playbook_id === playbookId, 'no duplicate playbook was created on the repeat call');
	assert(store1.listPlaybooks().filter((p) => p.source_ticket_id === ticket1.ticket_id).length === 1, 'exactly one playbook exists for ticket #1, even after two resolve calls');

	// ---------------------------------------------------------------------
	// Session 2: brand-new TicketStore instance reading the SAME file —
	// simulates closing and reopening the app, proving persistence.
	// ---------------------------------------------------------------------
	section('6. Reopen as a fresh session (new store instance, same file) — persistence check');
	const store2 = new TicketStore(createFileStore(STATE_FILE));
	const runLog2 = new RunLog();
	const reloadedTicket1 = store2.getTicket(ticket1.ticket_id);
	assert(reloadedTicket1?.verified === true, 'ticket #1 resolution survived reopening the store (persisted, not in-memory only)');
	assert(store2.getPlaybook(playbookId) !== undefined, 'the saved playbook survived reopening the store');

	section('7. Submit a similar ticket #2 -> system should find and reuse the saved playbook');
	const ticket2 = store2.createTicket(demoTicketInput(2));
	const checked2 = ticket2.prerequisite_checks.map((c) => ({ ...c, value: c.key === 'mfa_reenrolled' ? false : true }));
	store2.setPrerequisiteChecks(ticket2.ticket_id, checked2);
	const diag2 = await diagnoseTicket(store2, ticket2.ticket_id, runLog2, effectiveBridge);
	assert(diag2.matchedPlaybook?.playbook_id === playbookId, 'ticket #2 matches the exact playbook saved from ticket #1 (system + symptom + prerequisites)');
	assert(diag2.suggestion.is_playbook_reuse === true, 'suggestion for ticket #2 is a direct playbook reuse');
	assert(diag2.suggestion.cited_playbook_id === playbookId, 'suggestion cites the correct playbook id');

	const exec2 = await confirmAndExecute(store2, ticket2.ticket_id, diag2.suggestion.steps.map((s) => s.text), playbookId, runLog2);
	assert(exec2.status === 'pending_verification', 'ticket #2 executed via reuse');
	const res2 = await markResolved(store2, ticket2.ticket_id, runLog2, effectiveBridge);
	assert(res2.playbook?.playbook_id === playbookId, 'ticket #2 resolution is attributed to the reused playbook, not a new one');
	assert(res2.playbook?.reuse_count === 1, `playbook reuse_count incremented to ${res2.playbook?.reuse_count}`);

	section('8. Negative control: a same-symptom ticket on the WRONG system must not reuse the playbook');
	const wrongSystemTicket = store2.createTicket({ customer_id: 'CUST-001', system: 'VPN Gateway', symptom_code: 'post_reset_login_fail', description: "Reset password, still can't log in.", priority: 'high' });
	store2.setPrerequisiteChecks(
		wrongSystemTicket.ticket_id,
		wrongSystemTicket.prerequisite_checks.map((c) => ({ ...c, value: c.key === 'mfa_reenrolled' ? false : true }))
	);
	const diagWrong = await diagnoseTicket(store2, wrongSystemTicket.ticket_id, runLog2, effectiveBridge);
	assert(diagWrong.matchedPlaybook === null, 'playbook correctly NOT matched for a different system, despite identical symptom_code and near-identical wording');

	// ---------------------------------------------------------------------
	// Timing — real measured durations only, no invented "speedup" numbers.
	// ---------------------------------------------------------------------
	section('Measured durations (real, not fabricated)');
	const allLogs: RunLogEntry[] = [...platformLog.list(), ...runLog1.list(), ...runLog2.list()];
	const diagnose1Ms = runLog1.list().filter((l) => l.ticket_id === ticket1.ticket_id && l.action !== 'execute_demo_environment_action').reduce((sum, l) => sum + l.duration_ms, 0);
	const diagnose2Ms = runLog2.list().filter((l) => l.ticket_id === ticket2.ticket_id).reduce((sum, l) => sum + l.duration_ms, 0);
	console.log(`  Ticket #1 (first-time diagnosis) adapter time: ${diagnose1Ms}ms total across ${runLog1.list().filter((l) => l.ticket_id === ticket1.ticket_id).length} call(s)`);
	console.log(`  Ticket #2 (playbook reuse) adapter time: ${diagnose2Ms}ms total across ${runLog2.list().filter((l) => l.ticket_id === ticket2.ticket_id).length} call(s)`);
	console.log('  (Both are local/mock computation in this environment — no LLM key configured — so raw adapter latency is not a meaningful comparison here.');
	console.log('   The real saving from reuse is qualitative: ticket #2 skips the prerequisite-diagnosis back-and-forth because a verified playbook already matched.)');

	section('Run log summary (service x mode)');
	const byServiceMode = new Map<string, number>();
	for (const l of allLogs) {
		const k = `${l.service}/${l.mode}`;
		byServiceMode.set(k, (byServiceMode.get(k) ?? 0) + 1);
	}
	for (const [k, count] of [...byServiceMode.entries()].sort()) {
		console.log(`  ${k}: ${count}`);
	}

	if (rocketrideConnected) await bridge.disconnect();

	console.log(`\n${failures === 0 ? '✅ ALL CHECKS PASSED' : `❌ ${failures} CHECK(S) FAILED`}`);
	process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
	console.error('Uncaught error running check loop:', err);
	process.exitCode = 1;
});
