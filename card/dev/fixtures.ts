import type { AgentRecord, Counts, HassStates, HostConfig, RosterAttributes } from '../src/contracts';

export const FIXTURE_NOW = Date.parse('2026-10-14T12:00:00Z');
export const hostConfigs: HostConfig[] = [
  { name: 'Desktop', roster_entity: 'sensor.ha_tty7_desktop_demo_roster', connectivity_entity: 'binary_sensor.ha_tty7_desktop_demo_connectivity' },
  { name: 'Laptop', roster_entity: 'sensor.ha_tty7_laptop_demo_roster', connectivity_entity: 'binary_sensor.ha_tty7_laptop_demo_connectivity' },
];
export const SCENARIOS = ['healthy', 'empty', 'error', 'stale', 'unconfirmed', 'malformed', 'offline', 'loading', 'disconnected', 'hostile'] as const;
export type Scenario = (typeof SCENARIOS)[number];
export const HOSTILE = '<img src=x onerror="window.__injected=true">';

export function agentFixture(changes: Partial<AgentRecord> = {}): AgentRecord {
  return { pane_id: 1, session_id: 'demo-session-1', agent: 'OhMyPi', status: 'working', activity: 0,
    turns: 2, model: 'demo-model', effort: 'medium', permission_mode: null, ...changes };
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
    const state = ['error', 'stale', 'unconfirmed'].includes(scenario) ? scenario : String(agents.length);
    states[host.roster_entity] = { state, attributes: { ...attributes } };
    states[host.connectivity_entity] = { state: ['error', 'stale', 'unconfirmed', 'offline'].includes(scenario) ? 'off' : 'on', attributes: {} };
    if (scenario === 'malformed') states[host.roster_entity]!.attributes.agents = null;
  }
  return states;
}
