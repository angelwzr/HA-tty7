import { afterEach, describe, expect, it } from 'vitest';
import { HaTty7Card } from '../src/ha-tty7-card';
import { discoverHosts } from '../src/discovery';
import { deriveHostView, validateConfig } from '../src/state';
import { agentFixture, fixtureStates, hostConfigs, HOSTILE } from '../dev/fixtures';
import { registryFixture } from '../dev/editor-fixtures';
import type { HomeAssistant, InventorySnapshot } from '../src/contracts';

const host = hostConfigs[0]!;
const mounted: HaTty7Card[] = [];
afterEach(() => mounted.splice(0).forEach(card => card.remove()));
function inventory(names = true): InventorySnapshot {
  return { kind: 'snapshot', sample_id: 'sample-1', consistent: true, names_included: names, derived_labels_included: false,
    workspaces: [{ workspace_id: 'ws-1', name: 'Workspace name', tab_count: 2, pane_count: 3 }],
    tabs: [
      { workspace_id: 'ws-1', tab_id: 'tab-1', ordinal: 1, name: HOSTILE, label: 'PRIVATE_DERIVED', detected_agent: 'RepresentativeOnly', pane_ids: [1, 2], group_id: null, group_name: null, hibernated: false },
      { workspace_id: 'ws-1', tab_id: 'tab-2', ordinal: 2, name: 'Detected tab', label: null, detected_agent: 'ClaudeCode', pane_ids: [3], group_id: null, group_name: null, hibernated: true },
    ],
    panes: [
      { pane_id: 1, workspace_id: 'ws-1', tab_id: 'tab-1', live: true, hibernated: false, orphan: false },
      { pane_id: 2, workspace_id: 'ws-1', tab_id: 'tab-1', live: false, hibernated: false, orphan: false },
      { pane_id: 3, workspace_id: 'ws-1', tab_id: 'tab-2', live: null, hibernated: true, orphan: false },
      { pane_id: 4, workspace_id: null, tab_id: null, live: false, hibernated: false, orphan: true },
    ] };
}
function hass(): HomeAssistant {
  const states = fixtureStates('healthy');
  states[host.roster_entity]!.state = '2';
  Object.assign(states[host.roster_entity]!.attributes, {
    agents: [agentFixture({ agent: 'WorkingAgent', rich: true, model: null, effort: '' }), agentFixture({ pane_id: 2, session_id: 'second', agent: 'WaitingAgent', status: 'waiting', rich: false })],
    counts: { working: 1, waiting: 1, done: 0, idle: 0, unknown: 0 },
    confirmed_counts: { working: 1, waiting: 0, done: 0, idle: 0, unknown: 0 },
    inferred_count: 0, weak_count: 1, unknown_origin_count: 0,
    inventory: inventory(), inventory_state: 'healthy',
    source: { state: 'available', collector_version: '0.4.0', tty7_build: 'stock-build', control_version: 1, protocol_version: null, uptime_secs: 10 },
  });
  return { states };
}
async function mount(settings: Record<string, unknown> = {}, value = hass()) {
  const card = new HaTty7Card(); mounted.push(card);
  card.setConfig({ type: 'custom:ha-tty7-card', hosts: [host], ...settings });
  card.hass = value; document.body.append(card); await card.updateComplete; return card;
}

describe('stock inventory card contract', () => {
  it('discovers exact registry roles with renamed IDs and extra summary sensors', () => {
    const value = registryFixture();
    const device = 'desktop-device';
    delete value.entities![host.roster_entity]; delete value.entities![host.connectivity_entity];
    Object.assign(value.entities!, {
      'sensor.custom_name': { entity_id: 'sensor.custom_name', platform: 'ha_tty7', device_id: device, translation_key: 'roster' },
      'binary_sensor.custom_name': { entity_id: 'binary_sensor.custom_name', platform: 'ha_tty7', device_id: device, translation_key: 'connectivity' },
      'sensor.total': { entity_id: 'sensor.total', platform: 'ha_tty7', device_id: device, translation_key: 'reported_agents' },
    });
    expect(discoverHosts(value)).toContainEqual({ ...host, roster_entity: 'sensor.custom_name', connectivity_entity: 'binary_sensor.custom_name' });
    expect(HaTty7Card.getStubConfig(value).appearance).toBe('home-assistant');
  });
  it('does not guess ambiguous roles and preserves saved pairs when registry disappears', async () => {
    const value = registryFixture();
    Object.assign(value.entities!, {
      'sensor.duplicate': { entity_id: 'sensor.duplicate', platform: 'ha_tty7', device_id: 'desktop-device', translation_key: 'roster' },
    });
    expect(discoverHosts(value).some(pair => pair.roster_entity === host.roster_entity)).toBe(false);
    const card = await mount({}, { states: hass().states });
    expect(card.shadowRoot!.querySelector('[data-state="healthy"]')).not.toBeNull();
  });
  it('accepts display options while preserving old saved config defaults', () => {
    const config = { type: 'custom:ha-tty7-card', hosts: [host], group_by: 'tab', show_summary: false, show_model: false, show_effort: true, show_session_id: true, statuses: ['waiting'], agent_types: ['WaitingAgent'], include_inferred: false };
    expect(validateConfig(config)).toEqual(config);
    expect(validateConfig({ type: 'custom:ha-tty7-card', hosts: [host] })).toEqual({ type: 'custom:ha-tty7-card', hosts: [host] });
  });
  it('preserves rich false and empty effort instead of rejecting the roster', () => {
    const view = deriveHostView(host, hass().states, true);
    expect(view.state).toBe('healthy'); expect(view.agents[0]!.effort).toBe(''); expect(view.agents[1]!.rich).toBe(false);
  });
  it('pairs split-parent type with the most urgent reported status and keeps detections tab-level', async () => {
    const card = await mount({ group_by: 'tab', statuses: ['idle', 'working', 'waiting', 'done', 'unknown'], show_agent_type: true, show_lifecycle: true });
    const parent = card.shadowRoot!.querySelector('[data-tab="tab-1"]')!;
    expect(parent.textContent).toContain('WaitingAgent'); expect(parent.textContent).toContain('Waiting');
    expect(parent.textContent).not.toContain('RepresentativeOnly');
    const detected = card.shadowRoot!.querySelector('[data-tab="tab-2"]')!;
    expect(detected.textContent).toContain('Unknown'); expect(detected.textContent).toContain('Hibernated');
    expect(card.shadowRoot!.querySelector('[data-pane="3"] .agent-name')).toBeNull();
    expect(card.shadowRoot!.textContent).toContain('Orphan');
  });
  it('filters locally without changing totals or group identity across renames and reorder', async () => {
    const card = await mount({ group_by: 'tab', statuses: ['waiting'], show_summary: true, show_filtered_count: true });
    const parent = card.shadowRoot!.querySelector('[data-tab="tab-1"]')!;
    expect(card.shadowRoot!.querySelector('.summary')!.textContent).toContain('2 reported');
    expect(card.shadowRoot!.querySelector('.filtered-count')!.textContent).toContain('1 / 2');
    const attrs = card.hass!.states[host.roster_entity]!.attributes;
    const snapshot = attrs.inventory as InventorySnapshot; snapshot.tabs.reverse(); snapshot.tabs[1]!.name = 'Renamed';
    card.hass = card.hass; await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-tab="tab-1"]')).toBe(parent);
  });
  it.each(['tab', 'workspace'] as const)('selects %s headings from visible status/type/inferred-filtered rows', async groupBy => {
    for (const settings of [{ statuses: ['working'] }, { agent_types: ['WorkingAgent'] }, { include_inferred: false }]) {
      const value = hass();
      if ('include_inferred' in settings) {
        (value.states[host.roster_entity]!.attributes.agents as Record<string, unknown>[])[1]!.inferred = true;
      }
      const card = await mount({ group_by: groupBy, show_agent_type: true, ...settings }, value);
      const heading = card.shadowRoot!.querySelector('[data-tab="tab-1"] .group-head')!;
      expect(heading.textContent).toContain('WorkingAgent');
      expect(heading.textContent).toContain('Working');
      expect(heading.textContent).not.toContain('WaitingAgent');
      expect(card.shadowRoot!.querySelector('[data-pane="1"]')).not.toBeNull();
      expect(card.shadowRoot!.querySelector('[data-pane="2"]')).toBeNull();
    }
  });
  it('retains row details through local status/type/inferred filtering', async () => {
    const card = await mount();
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!; row.click(); await card.updateComplete;
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: [host], agent_types: ['WaitingAgent'], include_inferred: false });
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')).toBeNull();
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: [host] }); await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')!.getAttribute('aria-expanded')).toBe('true');
  });
  it('excludes inferred rows locally while preserving inferred totals and never counting them as confirmed', async () => {
    const value = hass();
    (value.states[host.roster_entity]!.attributes.agents as Record<string, unknown>[])[0]!.inferred = true;
    const card = await mount({ include_inferred: false, show_summary: true }, value);
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')).toBeNull();
    expect(card.shadowRoot!.querySelector('[data-pane="2"]')).not.toBeNull();
    expect(card.shadowRoot!.querySelector('.summary')!.textContent).toContain('1 inferred');
    expect(card.shadowRoot!.querySelector('.summary')!.textContent).toContain('0 confirmed');
  });
  it('does not guess a named tab for ambiguous cross-query pane membership', async () => {
    const value = hass(); const snapshot = value.states[host.roster_entity]!.attributes.inventory as InventorySnapshot;
    snapshot.consistent = false; snapshot.tabs[1]!.pane_ids.push(1);
    const card = await mount({}, value);
    expect(card.shadowRoot!.querySelector('[data-pane="1"] .agent-name')!.textContent).toBe('WorkingAgent');
    expect(card.shadowRoot!.textContent).toContain('Membership pending reconciliation');
  });
  it('accepts stock empty display labels without discarding structural inventory or showing blank titles', async () => {
    const value = hass(); const snapshot = value.states[host.roster_entity]!.attributes.inventory as InventorySnapshot;
    snapshot.workspaces[0]!.name = '';
    snapshot.tabs[0]!.name = ''; snapshot.tabs[0]!.label = ''; snapshot.tabs[0]!.group_name = ''; snapshot.tabs[0]!.detected_agent = '';
    const card = await mount({ group_by: 'tab' }, value);
    expect(card.shadowRoot!.querySelector('[data-tab="tab-1"]')).not.toBeNull();
    expect(card.shadowRoot!.querySelector('[data-pane="1"] .agent-name')!.textContent).toBe('WorkingAgent');
  });
  it('uses derived labels only with both consent flags and marks their origin', async () => {
    const value = hass(); const snapshot = value.states[host.roster_entity]!.attributes.inventory as InventorySnapshot;
    snapshot.derived_labels_included = true; snapshot.tabs[0]!.name = null; snapshot.tabs[0]!.label = HOSTILE;
    const card = await mount({ show_derived_label: true }, value);
    expect(card.shadowRoot!.querySelector('[data-pane="1"] .agent-name')!.textContent).toBe(HOSTILE);
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')!.textContent).toContain('Derived label');
    expect(card.shadowRoot!.querySelector('img,script,iframe')).toBeNull();
    snapshot.names_included = false; card.hass = card.hass; await card.updateComplete;
    expect(card.shadowRoot!.textContent).not.toContain(HOSTILE);
  });
  it('hides unreported metadata and absent session identifiers until details are expanded', async () => {
    const value = hass();
    const first = (value.states[host.roster_entity]!.attributes.agents as Record<string, unknown>[])[0]!;
    Object.assign(first, { model: null, effort: null, session_id: null });
    const card = await mount({ show_session_id: true, show_model: true, show_effort: true }, value);
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!;
    expect(row.querySelector('.metadata')).toBeNull();
    expect(row.textContent).not.toContain('Not reported');
    expect(row.textContent).toContain('Working');
    row.click(); await card.updateComplete;
    expect(card.shadowRoot!.querySelector('dl:not([hidden])')!.textContent).toContain('Not reported');
    Object.assign(first, { model: 'stock/model', effort: null });
    card.hass = card.hass; await card.updateComplete;
    expect(row.querySelector('.metadata')!.textContent).toContain('stock/model');
    expect(row.querySelector('.metadata')!.textContent).not.toContain('Effort');
    Object.assign(first, { model: null, effort: 'high' });
    card.hass = card.hass; await card.updateComplete;
    expect(row.querySelector('.metadata')!.textContent).toContain('high');
    expect(row.querySelector('.metadata')!.textContent).not.toContain('Model');
    Object.assign(first, { model: '   ', effort: '   ' });
    card.hass = card.hass; await card.updateComplete;
    expect(row.querySelector('.metadata')).toBeNull();
  });
  it('does not claim detection for a plain tab or display missing orphan liveness', async () => {
    const value = hass(); const snapshot = value.states[host.roster_entity]!.attributes.inventory as InventorySnapshot;
    snapshot.tabs[1]!.detected_agent = null; snapshot.panes[3]!.live = null;
    const card = await mount({ group_by: 'tab', statuses: ['unknown'] }, value);
    expect(card.shadowRoot!.querySelector('[data-tab="tab-2"] .group-head')!.textContent).not.toContain('Detected only');
    expect(card.shadowRoot!.querySelector('.inventory-panes')!.textContent).not.toContain('Not reported');
  });
  it('shows honest model/effort/provenance and does not infer capability from versions', async () => {
    const card = await mount({ show_effort: true, show_summary: true }); const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!;
    expect(row.textContent).toContain('None applicable');
    row.click(); await card.updateComplete;
    expect(card.shadowRoot!.textContent).toContain('Structured hook');
    expect(card.shadowRoot!.textContent).not.toContain('Unsupported');
    expect(card.shadowRoot!.querySelector('.summary')!.textContent).toContain('1 confirmed');
  });
  it('renders hostile approved names inertly and strips labels without privacy consent', async () => {
    const card = await mount();
    expect(card.shadowRoot!.textContent).toContain(HOSTILE); expect(card.shadowRoot!.querySelector('img,script,a')).toBeNull();
    expect(card.shadowRoot!.textContent).not.toContain('PRIVATE_DERIVED');
    card.hass!.states[host.roster_entity]!.attributes.inventory = inventory(false);
    card.hass = card.hass; await card.updateComplete;
    expect(card.shadowRoot!.textContent).not.toContain(HOSTILE); expect(card.shadowRoot!.textContent).not.toContain('Workspace name');
  });
  it('keeps healthy roster when optional inventory/source is malformed and never exposes private values', async () => {
    const value = hass(); value.states[host.roster_entity]!.attributes.inventory = { kind: 'snapshot', secret: 'PRIVATE_DATA' };
    value.states[host.roster_entity]!.attributes.source = { state: 'unsupported', tty7_build: 'PRIVATE_BUILD' };
    const card = await mount({}, value);
    expect(card.shadowRoot!.querySelector('[data-state="healthy"]')).not.toBeNull();
    expect(card.shadowRoot!.textContent).not.toContain('PRIVATE_');
  });
  it('never renders names or private fields from inventory errors, including revocation flags', async () => {
    const value = hass();
    value.states[host.roster_entity]!.attributes.inventory = { kind: 'error', error_code: 'cli_failed', names_included: false, derived_labels_included: false, name: 'PRIVATE_REVOKED' };
    value.states[host.roster_entity]!.attributes.inventory_state = 'error';
    const card = await mount({}, value);
    expect(card.shadowRoot!.textContent).not.toContain('PRIVATE_REVOKED');
    expect(card.shadowRoot!.textContent).not.toContain(HOSTILE);
    expect(card.shadowRoot!.querySelector('[data-inventory-state="error"]')).not.toBeNull();
    expect(card.shadowRoot!.querySelectorAll('.agent-row')).toHaveLength(2);
  });
  it('updates Russian labels from the HA profile and falls back to English elsewhere', async () => {
    const card = await mount();
    card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!.click(); await card.updateComplete;
    card.hass = { ...card.hass!, locale: { language: 'ru', number_format: 'language', time_format: '24', date_format: 'DMY', first_weekday: 'language', time_zone: 'server' } };
    await card.updateComplete;
    expect(card.shadowRoot!.textContent).toContain('Не сообщается'); expect(card.shadowRoot!.textContent).toContain('Ожидание');
    card.hass = { ...card.hass!, locale: { ...card.hass!.locale!, language: 'de' } }; await card.updateComplete;
    expect(card.shadowRoot!.textContent).toContain('Not reported');
  });
});
