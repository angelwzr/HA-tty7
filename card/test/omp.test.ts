import { afterEach, describe, expect, it } from 'vitest';
import { HaTty7Card } from '../src/ha-tty7-card';
import { deriveHostView } from '../src/state';
import { agentFixture, fixtureStates, hostConfigs } from '../dev/fixtures';
import type { HomeAssistant, InventorySnapshot } from '../src/contracts';

const host = hostConfigs[0]!;
const ready = { state: 'ready', run_id: 'synthetic-main-run', background_jobs: 2 };
function native(changes: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...agentFixture({ rich: true, activity: null, turns: null }), omp: { ...ready }, ...changes };
}
function statesFor(row: Record<string, unknown>) {
  const states = fixtureStates('healthy');
  states[host.roster_entity]!.state = '1';
  states[host.roster_entity]!.attributes.agents = [row];
  states[host.roster_entity]!.attributes.counts = { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0, [row.status as string]: 1 };
  return states;
}
const cards: HaTty7Card[] = [];
afterEach(() => { for (const card of cards.splice(0)) card.remove(); });
async function mount(row: Record<string, unknown>, russian = false) {
  const card = document.createElement('ha-tty7-card');
  cards.push(card);
  card.setConfig({ type: 'custom:ha-tty7-card', hosts: [host] });
  const hass: HomeAssistant = { states: statesFor(row) };
  if (russian) hass.locale = { language: 'ru', number_format: 'language', time_format: 'language', date_format: 'language', first_weekday: 'language', time_zone: 'local' };
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('OMP native source boundary', () => {
  it('preserves exact native metadata through the real host projection', () => {
    const view = deriveHostView(host, statesFor(native()), true);
    expect(view.state).toBe('healthy');
    expect(view.agents[0]).toMatchObject({ omp: ready, activity: null, turns: null });
  });
  it('accepts ready initial idle without a main run and keeps background zero', () => {
    const view = deriveHostView(host, statesFor(native({ status: 'idle', omp: { state: 'ready', run_id: null, background_jobs: 0 } })), true);
    expect(view.state).toBe('healthy');
    expect(view.agents[0]).toMatchObject({ omp: { state: 'ready', run_id: null, background_jobs: 0 } });
  });
  it.each([
    null, [], {}, { ...ready, state: 'private-state' }, { ...ready, private_data: 'PRIVATE_SENTINEL' },
    { ...ready, run_id: '' }, { ...ready, run_id: 'x'.repeat(129) }, { ...ready, run_id: '\ud800' },
    { ...ready, background_jobs: true }, { ...ready, background_jobs: -1 }, { ...ready, background_jobs: 1.5 },
    { ...ready, background_jobs: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects malformed native objects rather than dropping provenance %j', omp => {
    const view = deriveHostView(host, statesFor(native({ omp })), true);
    expect(view.state).toBe('malformed');
    expect(JSON.stringify(view)).not.toContain('PRIVATE_SENTINEL');
  });
  it.each([
    { agent: 'Codex' }, { rich: false }, { inferred: true }, { session_id: null },
    { omp: { state: 'missing', run_id: null, background_jobs: null } },
    { status: 'PRIVATE_STATUS' },
    { activity: 2 }, { turns: 3 }, { omp: { ...ready, background_jobs: null } },
  ])('rejects native source invariant violations %j', changes => {
    expect(deriveHostView(host, statesFor(native(changes)), true).state).toBe('malformed');
  });
  it.each(['missing', 'stale', 'invalid', 'conflict', 'unsupported'])('keeps %s warning visible even with unknown rows hidden', async state => {
    const row = native({ status: 'unknown', rich: false, session_id: null, omp: { state, run_id: null, background_jobs: null } });
    const card = await mount(row);
    expect(card.shadowRoot!.querySelectorAll('.agent-row')).toHaveLength(0);
    const warning = card.shadowRoot!.querySelector('.omp-warning');
    expect(warning).not.toBeNull();
    expect(warning!.textContent).toContain('OhMyPi native status unavailable');
    expect(warning!.textContent!.toLowerCase()).toContain(state);
    expect(card.shadowRoot!.querySelector('.source-diagnostics')).toBeNull();
  });
  it('localizes the essential source warning in Russian', async () => {
    const card = await mount(native({ status: 'unknown', rich: false, session_id: null, omp: { state: 'missing', run_id: null, background_jobs: null } }), true);
    expect(card.shadowRoot!.querySelector('.omp-warning')!.textContent).toContain('Нативный статус OhMyPi недоступен');
    expect(card.shadowRoot!.querySelector('.omp-warning')!.textContent).toContain('нет источника');
  });
  it.each([false, true])('keeps healthy collapsed rows compact and exposes native origin and background count only in details (Russian=%s)', async russian => {
    const card = await mount(native(), russian);
    expect(card.shadowRoot!.querySelector('.omp-warning')).toBeNull();
    const button = card.shadowRoot!.querySelector<HTMLButtonElement>('.agent-row')!;
    expect(button.querySelector('.agent-copy')!.textContent!.trim()).toBe('OhMyPi');
    expect(button.textContent).not.toContain(russian ? 'Фоновые задачи' : 'Background jobs');
    expect(button.querySelector('.identity,.metadata')).toBeNull();
    button.click();
    await card.updateComplete;
    const details = card.shadowRoot!.querySelector('dl:not([hidden])')!;
    expect(details.textContent).toContain(russian ? 'Нативный источник OhMyPi' : 'OhMyPi native source');
    const term = [...details.querySelectorAll('dt')].find(item => item.textContent === (russian ? 'Фоновые задачи' : 'Background jobs'))!;
    expect(term.nextElementSibling!.textContent).toBe('2');
  });
  it.each(['activity', 'turns', 'session_id'])('rejects stock child %s copied into an unavailable native record', field => {
    const row = native({ status: 'unknown', rich: false, session_id: null, omp: { state: 'missing', run_id: null, background_jobs: null } });
    row[field] = field === 'session_id' ? 'child-session' : 3;
    expect(deriveHostView(host, statesFor(row), true).state).toBe('malformed');
  });
  it('keeps a reported native model separate from unavailable thinking level', async () => {
    const card = await mount(native({ model: 'native-provider/native-model', effort: null }));
    card.shadowRoot!.querySelector<HTMLButtonElement>('.agent-row')!.click();
    await card.updateComplete;
    const details = card.shadowRoot!.querySelector('dl:not([hidden])')!;
    const models = [...details.querySelectorAll('dt')].filter(term => term.textContent === 'Model');
    expect(models).toHaveLength(1);
    expect(models[0]!.nextElementSibling!.textContent).toBe('native-provider/native-model');
    const effort = [...details.querySelectorAll('dt')].find(term => term.textContent === 'Effort')!;
    expect(effort.nextElementSibling!.textContent).toBe('Not reported');
  });
  it.each(['completed', 'failed', 'cancelled'])('keeps the card healthy for an authoritative terminal %s outcome', outcome => {
    const view = deriveHostView(host, statesFor(native({
      status: 'done', omp: { ...ready, background_jobs: 0, outcome, input_id: null },
    })), true);
    expect(view.state).toBe('healthy');
  });
  it('accepts a real blocking request without treating its opaque identity as display text', async () => {
    const card = await mount(native({
      status: 'waiting', omp: { ...ready, outcome: null, input_id: 'opaque-input-identity' },
    }));
    expect(card.shadowRoot!.querySelector('.notice')).toBeNull();
    expect(card.shadowRoot!.querySelector('.agent-row')!.textContent).toContain('Waiting');
    expect(card.shadowRoot!.textContent).not.toContain('opaque-input-identity');
  });
  it.each([
    { status: 'done', omp: { ...ready, background_jobs: 0, outcome: 'invented', input_id: null } },
    { status: 'done', omp: { ...ready, background_jobs: 0, outcome: true, input_id: null } },
    { status: 'working', omp: { ...ready, background_jobs: 0, outcome: 'completed', input_id: null } },
    { status: 'done', omp: { ...ready, outcome: 'failed', input_id: null } },
    { status: 'done', omp: { ...ready, background_jobs: 0, outcome: 'completed', input_id: 'still-blocked' } },
    { status: 'waiting', omp: { ...ready, input_id: '', outcome: null } },
    { status: 'waiting', omp: { ...ready, input_id: '\ud800', outcome: null } },
    { status: 'waiting', omp: { ...ready, input_id: 'x'.repeat(129), outcome: null } },
    { status: 'working', omp: { ...ready, input_id: 'not-blocked', outcome: null } },
    { status: 'done', omp: { ...ready, run_id: null, background_jobs: 0, outcome: 'completed' } },
  ])('rejects contradictory or malformed notification proof %j', changes => {
    expect(deriveHostView(host, statesFor(native(changes)), true).state).toBe('malformed');
  });
});

const fullName = 'A synthetic session title longer than forty characters — complete ending';
const clippedName = `${Array.from(fullName).slice(0, 39).join('')}…`;
function namedStates(name: unknown = fullName) {
  const states = statesFor(native({ omp: { ...ready, session_name: name } }));
  Object.assign(states[host.roster_entity]!.attributes, {
    inventory_state: 'healthy',
    inventory: {
      kind: 'snapshot', sample_id: 'names-one', consistent: true, names_included: true, derived_labels_included: true,
      workspaces: [{ workspace_id: 'ws', name: null, tab_count: 1, pane_count: 1 }],
      tabs: [{ workspace_id: 'ws', tab_id: 'tab', ordinal: 1, name: null, label: clippedName,
        detected_agent: 'OhMyPi', pane_ids: [1], group_id: null, group_name: null, hibernated: false }],
      panes: [{ pane_id: 1, workspace_id: 'ws', tab_id: 'tab', live: true, hibernated: false, orphan: false }],
    },
  });
  return states;
}
async function mountNames(states = namedStates(), settings: Record<string, unknown> = {}) {
  const card = document.createElement('ha-tty7-card');
  cards.push(card);
  card.setConfig({ type: 'custom:ha-tty7-card', hosts: [host], ...settings });
  card.hass = { states };
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('complete native session names', () => {
  it('renders the full title instead of the clipped label and updates in place on rename', async () => {
    const states = namedStates();
    const card = await mountNames(states);
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!;
    expect(row.querySelector('.agent-name')!.textContent).toBe(fullName);
    expect(row.getAttribute('aria-label')).toContain(fullName);
    row.click(); await card.updateComplete;
    const attrs = states[host.roster_entity]!.attributes;
    ((attrs.agents as Record<string, unknown>[])[0]!.omp as Record<string, unknown>).session_name = 'Renamed full native title';
    card.hass = { states }; await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')).toBe(row);
    expect(row.querySelector('.agent-name')!.textContent).toBe('Renamed full native title');
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });
  it.each(['host', 'tab', 'workspace'])('keeps explicit names ahead of native titles in %s grouping', async group_by => {
    const states = namedStates();
    (states[host.roster_entity]!.attributes.inventory as InventorySnapshot).tabs[0]!.name = 'Explicit chosen tab';
    const card = await mountNames(states, { group_by });
    expect(card.shadowRoot!.querySelector('.agent-name')!.textContent).toBe('Explicit chosen tab');
    expect(card.shadowRoot!.textContent).not.toContain(fullName);
    if (group_by !== 'host') expect(card.shadowRoot!.querySelector('.group-head h3')!.textContent).toBe('Explicit chosen tab');
  });
  it.each(['names', 'derived', 'missing', 'malformed', 'orphan', 'ambiguous', 'inconsistent', 'stale', 'unconfirmed'])(
    'never renders native names with %s inventory', async mutation => {
      const states = namedStates();
      const attrs = states[host.roster_entity]!.attributes;
      const inv = attrs.inventory as InventorySnapshot;
      if (mutation === 'names') inv.names_included = false;
      if (mutation === 'derived') inv.derived_labels_included = false;
      if (mutation === 'missing') attrs.inventory = null;
      if (mutation === 'malformed') attrs.inventory = { ...inv, panes: 'invalid' };
      if (mutation === 'orphan') inv.panes[0]!.orphan = true;
      if (mutation === 'ambiguous') inv.tabs.push({ ...inv.tabs[0]!, tab_id: 'other' });
      if (mutation === 'inconsistent') inv.consistent = false;
      if (mutation === 'stale' || mutation === 'unconfirmed') attrs.inventory_state = mutation;
      const card = await mountNames(states, { group_by: 'tab' });
      expect(card.shadowRoot!.querySelector('[data-pane="1"]')).not.toBeNull();
      expect(card.shadowRoot!.innerHTML).not.toContain(fullName);
    });
  it.each([null, '😀'.repeat(256)])('accepts nullable names and Unicode scalar bounds', name => {
    expect(deriveHostView(host, namedStates(name), true).state).toBe('healthy');
  });
  it.each(['', '  ', 'x'.repeat(257), 'line\nbreak', 'bad\u007f', 'bad\u0085', '\ud800', 3, {}, []])(
    'rejects malformed native name scalars %j', name => {
      expect(deriveHostView(host, namedStates(name), true).state).toBe('malformed');
    });
  it('rejects names on nonready sources rather than rendering stale child metadata', () => {
    const row = native({ status: 'unknown', rich: false, session_id: null,
      omp: { state: 'stale', run_id: null, background_jobs: null, session_name: fullName } });
    expect(deriveHostView(host, statesFor(row), true).state).toBe('malformed');
  });
  it.each(['tab', 'workspace'])('uses only the visible selected split representative for %s headings', async group_by => {
    const states = namedStates();
    const attrs = states[host.roster_entity]!.attributes;
    const inv = attrs.inventory as InventorySnapshot;
    inv.tabs[0]!.pane_ids.push(2);
    inv.panes.push({ ...inv.panes[0]!, pane_id: 2 });
    (attrs.agents as unknown[]).push(native({ pane_id: 2, session_id: 'other-main', status: 'waiting',
      omp: { ...ready, session_name: 'Hidden waiting main title' } }));
    attrs.counts = { working: 1, waiting: 1, done: 0, idle: 0, unknown: 0 };
    states[host.roster_entity]!.state = '2';
    const card = await mountNames(states, { group_by, statuses: ['working'] });
    expect(card.shadowRoot!.querySelector('.group-head h3')!.textContent).toBe(fullName);
    expect(card.shadowRoot!.textContent).not.toContain('Hidden waiting main title');
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: [host], group_by });
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('.group-head h3')!.textContent).toBe('Hidden waiting main title');
    ((attrs.agents as Record<string, unknown>[])[1]!.omp as Record<string, unknown>).session_name = null;
    card.hass = { states }; await card.updateComplete;
    expect(card.shadowRoot!.querySelector('.group-head h3')!.textContent).toBe(clippedName);
  });
});
