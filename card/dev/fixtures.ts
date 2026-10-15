import type { AgentRecord, Counts, HassStates, HostConfig, InventorySnapshot, RosterAttributes } from '../src/contracts';

export const FIXTURE_NOW = Date.parse('2026-10-14T12:00:00Z');
export const hostConfigs: HostConfig[] = [
  { name: 'Desktop', roster_entity: 'sensor.ha_tty7_desktop_demo_roster', connectivity_entity: 'binary_sensor.ha_tty7_desktop_demo_connectivity' },
  { name: 'Laptop', roster_entity: 'sensor.ha_tty7_laptop_demo_roster', connectivity_entity: 'binary_sensor.ha_tty7_laptop_demo_connectivity' },
];
export const SCENARIOS = ['healthy', 'empty', 'error', 'stale', 'unconfirmed', 'malformed', 'offline', 'loading', 'disconnected', 'hostile', 'inventory'] as const;
export type Scenario = (typeof SCENARIOS)[number];
export const HOSTILE = '<img src=x onerror="window.__injected=true">';

export function agentFixture(changes: Partial<AgentRecord> = {}): AgentRecord {
  return { pane_id: 1, session_id: 'demo-session-1', agent: 'OhMyPi', status: 'working', activity: 0,
    turns: 2, model: 'demo-model', effort: 'medium', permission_mode: null, ...changes };
}

export function inventoryFixture(): InventorySnapshot {
  return {
    kind: 'snapshot', sample_id: 'synthetic-inventory-1', consistent: true, names_included: true, derived_labels_included: false,
    workspaces: [{ workspace_id: 'synthetic-ws-1', name: 'Demo workspace', tab_count: 2, pane_count: 3 }],
    tabs: [
      { workspace_id: 'synthetic-ws-1', tab_id: 'synthetic-tab-1', ordinal: 1, name: 'Named split tab', label: null,
        detected_agent: 'Representative only', pane_ids: [1, 2], group_id: 'synthetic-group', group_name: 'Demo group', hibernated: false },
      { workspace_id: 'synthetic-ws-1', tab_id: 'synthetic-tab-2', ordinal: 2, name: 'Detected only tab', label: null,
        detected_agent: 'ClaudeCode', pane_ids: [6], group_id: null, group_name: null, hibernated: true },
    ],
    panes: [
      { pane_id: 1, workspace_id: 'synthetic-ws-1', tab_id: 'synthetic-tab-1', live: true, hibernated: false, orphan: false },
      { pane_id: 2, workspace_id: 'synthetic-ws-1', tab_id: 'synthetic-tab-1', live: false, hibernated: false, orphan: false },
      { pane_id: 6, workspace_id: 'synthetic-ws-1', tab_id: 'synthetic-tab-2', live: null, hibernated: true, orphan: false },
      { pane_id: 7, workspace_id: null, tab_id: null, live: true, hibernated: false, orphan: true },
    ],
  };
}

export function fixtureStates(scenario: Scenario, now = FIXTURE_NOW): HassStates {
  if (scenario === 'loading') return {};
  const states: HassStates = {};
  for (const [index, host] of hostConfigs.entries()) {
    const agents = index === 0 ? [
      agentFixture(),
      agentFixture({ pane_id: 2, session_id: 'demo-session-2', agent: 'ClaudeCode', status: 'waiting', model: null, effort: null }),
      agentFixture({ pane_id: 3, session_id: null, agent: 'Codex', status: 'done', turns: 4 }),
      agentFixture({ pane_id: 4, session_id: 'demo-session-4', agent: 'Gemini', status: 'idle', activity: null }),
      agentFixture({ pane_id: 5, session_id: 'demo-session-5', agent: 'OtherAgent', status: 'unknown', model: null }),
    ] : [agentFixture({ pane_id: 1, session_id: 'demo-laptop-session', agent: 'Codex', status: 'idle' })];
    if (scenario === 'empty') agents.length = 0;
    if (scenario === 'inventory' && agents.length) {
      agents[0]!.rich = true; agents[0]!.model = null; agents[0]!.effort = '';
      if (agents[1]) agents[1].rich = false;
      if (agents[2]) agents[2].inferred = true;
    }
    if (scenario === 'hostile') {
      agents[0]!.agent = HOSTILE;
      agents[0]!.session_id = 'long-session-'.padEnd(128, 'x');
      agents[0]!.model = HOSTILE;
      agents[0]!.effort = 'long-effort-'.padEnd(128, 'y');
      agents[0]!.permission_mode = HOSTILE;
    }
    const counts: Counts = { working: 0, waiting: 0, idle: 0, done: 0, unknown: 0 };
    for (const agent of agents) counts[agent.status] += 1;
    const contact = new Date(now - (scenario === 'stale' ? 46_000 : 0)).toISOString();
    const attributes: RosterAttributes = {
      schema_version: 1, agents, counts, collector_ok: scenario !== 'error',
      error_code: scenario === 'error' ? 'cli_timeout' : null,
      last_contact: contact, last_success: contact,
      baseline_ready: !['error', 'unconfirmed', 'stale'].includes(scenario),
    };
    if (scenario === 'inventory') {
      attributes.inventory = inventoryFixture();
      attributes.inventory_state = 'healthy';
      attributes.inventory_last_contact = contact;
      attributes.inventory_last_success = contact;
    }
    const state = ['error', 'stale', 'unconfirmed'].includes(scenario) ? scenario : String(agents.length);
    states[host.roster_entity] = { state, attributes: { ...attributes } };
    if (scenario === 'inventory') states[host.roster_entity]!.attributes.source = {
      state: 'available', collector_version: '0.4.1', tty7_build: 'synthetic-stock-build',
      control_version: 1, protocol_version: null, uptime_secs: 30,
    };
    states[host.connectivity_entity] = { state: ['error', 'stale', 'unconfirmed', 'offline'].includes(scenario) ? 'off' : 'on', attributes: {} };
    if (scenario === 'malformed') states[host.roster_entity]!.attributes.agents = null;
  }
  return states;
}
