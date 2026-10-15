import { describe, expect, it } from 'vitest';
import { deriveHostView, validateConfig } from '../src/state';
import { agentFixture, fixtureStates, hostConfigs, FIXTURE_NOW } from '../dev/fixtures';
import type { HassStates } from '../src/contracts';

const host = hostConfigs[0]!;
function view(states: HassStates = fixtureStates('healthy'), connected = true) {
  return deriveHostView(host, states, connected);
}
function attributes(changes: Record<string, unknown>): HassStates {
  const states = fixtureStates('healthy');
  const roster = states[host.roster_entity]!;
  return { ...states, [host.roster_entity]: { ...roster, attributes: { ...roster.attributes, ...changes } } };
}

describe('configuration boundary', () => {
  it('accepts an empty editor draft without inventing entities', () => {
    expect(validateConfig({ type: 'custom:ha-tty7-card', hosts: [] })).toEqual({ type: 'custom:ha-tty7-card', hosts: [] });
  });
  it('roundtrips optional presentation settings without changing old saved configs', () => {
    const saved = { type: 'custom:ha-tty7-card', hosts: [host], title: 'My agents', appearance: 'home-assistant' };
    expect(validateConfig(saved)).toEqual(saved);
    expect(validateConfig({ type: 'custom:ha-tty7-card', hosts: [host] })).toEqual({ type: 'custom:ha-tty7-card', hosts: [host] });
  });
  it.each([
    { title: 42 }, { title: null }, { title: '' }, { title: ' ' }, { title: 'x'.repeat(129) }, { title: '\ud800' },
    { appearance: 'native' }, { appearance: null }, { appearance: 1 },
    { group_by: 'repository' }, { show_summary: 'true' }, { show_model: null }, { show_effort: 1 },
    { show_session_id: 'false' }, { include_inferred: null }, { statuses: ['PRIVATE_STATUS'] }, { statuses: ['idle', 'idle'] },
    { agent_types: [''] }, { agent_types: ['x'.repeat(65)] },
  ])('rejects invalid presentation settings %j', settings => {
    expect(() => validateConfig({ type: 'custom:ha-tty7-card', hosts: [host], ...settings })).toThrowError(Error);
  });
  it.each([
    {},
    { type: 'custom:ha-tty7-card', hosts: [{ ...host, roster_entity: 'light.demo' }] },
    { type: 'custom:ha-tty7-card', hosts: [{ ...host, connectivity_entity: 'sensor.demo' }] },
    { type: 'custom:ha-tty7-card', hosts: [host, host] },
    { type: 'custom:ha-tty7-card', hosts: [host], webhook_url: 'not-allowed' },
    { type: 'custom:ha-tty7-card', hosts: [{ ...host, action: 'not-allowed' }] },
  ])('rejects invalid configuration without echoing input', config => {
    expect(() => validateConfig(config)).toThrowError(Error);
  });
});

describe('host presentation states', () => {
  it('does not call a missing entity an empty roster', () => {
    expect(view({}).state).toBe('loading');
    expect(view({}).agents).toEqual([]);
  });
  it.each(['empty', 'error', 'stale', 'unconfirmed', 'malformed', 'offline'] as const)('distinguishes %s', scenario => {
    const expected = scenario === 'offline' ? 'offline' : scenario;
    expect(view(fixtureStates(scenario)).state).toBe(expected);
  });
  it('disconnection outranks healthy data and keeps last known rows', () => {
    const result = view(fixtureStates('healthy'), false);
    expect(result.state).toBe('disconnected');
    expect(result.agents).toHaveLength(5);
    expect(result.lastKnown).toBe(true);
  });
  it('classifies actual HA expiry as stale even after HA clears baseline readiness', () => {
    const states = fixtureStates('stale');
    const result = view(states);
    expect(states[host.roster_entity]!.state).toBe('stale');
    expect(states[host.roster_entity]!.attributes.baseline_ready).toBe(false);
    expect(result.state).toBe('stale');
    expect(result.agents).toHaveLength(5);
    expect(result.lastKnown).toBe(true);
    expect(result.agents[0]!.status).toBe('working');
  });
  it('distinguishes explicit startup confirmation from an expired baseline', () => {
    const startup = fixtureStates('unconfirmed');
    const expired = fixtureStates('stale');
    expect(startup[host.roster_entity]!.attributes.baseline_ready).toBe(false);
    expect(expired[host.roster_entity]!.attributes.baseline_ready).toBe(false);
    expect(view(startup).state).toBe('unconfirmed');
    expect(view(expired).state).toBe('stale');
  });
  it('preserves last known rows after errors without changing statuses', () => {
    const result = view(fixtureStates('error'));
    expect(result.agents[0]!.status).toBe('working');
    expect(result.errorCode).toBe('cli_timeout');
    expect(result.lastKnown).toBe(true);
  });
  it('rejects timezone-less timestamps and success newer than receipt on the HA clock', () => {
    expect(view(attributes({ last_contact: '2026-10-14T10:00:00' })).state).toBe('malformed');
    expect(view(attributes({ last_success: new Date(FIXTURE_NOW + 1000).toISOString() })).state).toBe('malformed');
  });
  it.each(['schema_version', 'agents', 'counts', 'collector_ok', 'baseline_ready', 'last_contact', 'last_success', 'error_code'])('does not accept missing %s as a healthy empty roster', key => {
    const states = fixtureStates('healthy');
    delete states[host.roster_entity]!.attributes[key];
    expect(view(states).state).toBe('malformed');
  });
  it('requires count consistency and valid safe numeric values', () => {
    expect(view(attributes({ counts: { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0 } })).state).toBe('malformed');
    for (const pane_id of [true, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(view(attributes({ agents: [agentFixture({ pane_id: pane_id as number })] })).state).toBe('malformed');
    }
  });
  it('does not expose invalid error values', () => {
    const result = view(attributes({ collector_ok: false, baseline_ready: false, error_code: 'PRIVATE_DIAGNOSTIC' }));
    expect(result.state).toBe('malformed');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_DIAGNOSTIC');
  });
  it('validates the entire roster instead of silently dropping malformed records', () => {
    expect(view(attributes({ agents: [agentFixture(), { pane_id: 9 }] })).state).toBe('malformed');
    expect(view(attributes({ agents: [agentFixture(), agentFixture()] })).state).toBe('malformed');
    expect(view(attributes({ agents: Array.from({ length: 257 }, (_, i) => agentFixture({ pane_id: i + 1 })) })).state).toBe('malformed');
  });
  it('keeps missing optional metadata unavailable and preserves zero', () => {
    const states = fixtureStates('healthy');
    const agents = states[host.roster_entity]!.attributes.agents as Record<string, unknown>[];
    delete agents[0]!.model;
    agents[0]!.effort = null;
    agents[0]!.activity = 0;
    const first = view(states).agents[0]!;
    expect(first.model).toBeNull();
    expect(first.effort).toBeNull();
    expect(first.activity).toBe(0);
  });
  it('preserves nonempty whitespace metadata admitted by the wire contract', () => {
    const states = fixtureStates('healthy');
    const agents = states[host.roster_entity]!.attributes.agents as Record<string, unknown>[];
    agents[0]!.model = ' ';
    const result = view(states);
    expect(result.state).toBe('healthy');
    expect(result.agents[0]!.model).toBe(' ');
  });
  it.each([{ turns: true }, { model: {} }, { session_id: '' }, { model: 'x'.repeat(129) }])('rejects incompatible optional metadata %j', change => {
    expect(view(attributes({ agents: [{ ...agentFixture(), ...change }] })).state).toBe('malformed');
  });
  it.each([null, 'true', 1, {}])('rejects a non-boolean inferred flag %j without discarding the malformed record', inferred => {
    const states = fixtureStates('healthy');
    (states[host.roster_entity]!.attributes.agents as Record<string, unknown>[])[0]!.inferred = inferred;
    expect(view(states).state).toBe('malformed');
  });
  it('maps unknown or absent status to a fixed unknown label, never successful', () => {
    const states = fixtureStates('healthy');
    const roster = states[host.roster_entity]!;
    roster.attributes.agents = [agentFixture({ status: 'PRIVATE_STATUS' as 'unknown' })];
    roster.attributes.counts = { working: 0, waiting: 0, done: 0, idle: 0, unknown: 1 };
    expect(view(states).agents[0]!.status).toBe('unknown');
    expect(JSON.stringify(view(states))).not.toContain('PRIVATE_STATUS');
    delete (roster.attributes.agents as Record<string, unknown>[])[0]!.status;
    expect(view(states).agents[0]!.status).toBe('unknown');
  });
  it('projects only allowed fields, regardless of unwanted entity attributes', () => {
    const states = fixtureStates('healthy');
    const roster = states[host.roster_entity]!;
    roster.attributes.message = 'PRIVATE_MESSAGE';
    (roster.attributes.agents as Record<string, unknown>[])[0]!.launch_argv = ['PRIVATE_ARGUMENT'];
    (roster.attributes.agents as Record<string, unknown>[])[0]!.cwd = 'PRIVATE_DIRECTORY';
    const text = JSON.stringify(view(states));
    for (const sentinel of ['PRIVATE_MESSAGE', 'PRIVATE_ARGUMENT', 'PRIVATE_DIRECTORY']) expect(text).not.toContain(sentinel);
  });
  it('keeps identity stable on reorder but changes identity for a replacement session', () => {
    const states = fixtureStates('healthy');
    const before = view(states).agents;
    (states[host.roster_entity]!.attributes.agents as unknown[]).reverse();
    expect(view(states).agents.map(a => a.identity).sort()).toEqual(before.map(a => a.identity).sort());
    expect(view(states).agents[0]!.identity).not.toBe(deriveHostView(hostConfigs[1]!, fixtureStates('healthy'), true).agents[0]?.identity);
    const first = (states[host.roster_entity]!.attributes.agents as Record<string, unknown>[])[0]!;
    first.session_id = 'replacement';
    expect(view(states).agents.find(a => a.pane_id === first.pane_id)!.identity).not.toBe(before.find(a => a.pane_id === first.pane_id)!.identity);
  });
});
