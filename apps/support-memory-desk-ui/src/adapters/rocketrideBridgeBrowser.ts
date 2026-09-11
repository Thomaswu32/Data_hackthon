// =============================================================================
// Browser-side RocketRide bridge.
//
// STATUS: intentionally returns the unconfigured bridge (all adapters run
// their labeled mock/local path) rather than a real one, for two reasons:
//
// 1. This app depends on the `shell` package, which is vendored by the
//    RocketRide VS Code extension into .rocketride/shell/shell.tgz when the
//    App Builder is opened. That vendoring has not happened in this
//    workspace, so `shell`'s real, authenticated client-access surface is
//    not inspectable here (a guess could compile against the placeholder
//    stub used for local typechecking and still be wrong against the real
//    package).
// 2. Even once `shell` is real, embedding a raw ROCKETRIDE_APIKEY in
//    client-side bundle code would expose a production credential to every
//    viewer of the page — the right integration is whatever authenticated
//    proxy `shell` exposes to apps (identity-scoped, never a bare key),
//    not `new RocketRideClient({ auth: '...' })` in the browser.
//
// TODO (once `shell` is real, inside the RocketRide VS Code extension):
// replace UNCONFIGURED_BRIDGE below with a bridge that calls whatever
// authenticated pipeline-invocation surface `shell` exposes via
// ShellAppProps (inspect its real .d.ts once vendored), targeting the
// pipelines in /pipelines (cognee_recall.pipe, hydradb_persist.pipe,
// suggest.pipe). Until then, the exact same UNCONFIGURED_BRIDGE fallback
// this app uses is also what scripts/check-loop uses whenever no LLM key
// is configured — so behavior is consistent between the two.
// =============================================================================

import { UNCONFIGURED_BRIDGE, type RocketRideBridge } from '@support-desk/core';

export function getBrowserBridge(): RocketRideBridge {
	return UNCONFIGURED_BRIDGE;
}
