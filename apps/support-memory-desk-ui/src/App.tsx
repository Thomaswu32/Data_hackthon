// =============================================================================
// MIT License
// Copyright (c) 2026 Aparavi Software AG
// =============================================================================

/**
 * Compounding Support Desk — root component rendered by the RocketRide shell.
 *
 * This app owns its own three-pane + KPI-bar layout (Dashboard.tsx), so it
 * uses AppLayout as a plain full-screen frame with no shell sidebar/status
 * chrome — those would duplicate what the Dashboard already provides.
 */

import React from 'react';
import type { ShellAppProps } from 'shell';
import { AppLayout } from 'shell';
import { Dashboard } from './Dashboard';

const Content: React.FC<ShellAppProps> = ({ isConnected, identity }) => <Dashboard connected={Boolean(isConnected)} displayName={identity?.displayName} />;

const App: React.FC<ShellAppProps> = (props) => (
	<AppLayout>
		<Content {...props} />
	</AppLayout>
);

export default App;
