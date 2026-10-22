import { afterEach, describe, expect, it } from 'vitest';
import { HaTty7Card } from '../src/ha-tty7-card';
import { deriveHostView } from '../src/state';
import { agentFixture, fixtureStates, hostConfigs } from '../dev/fixtures';
import type { HomeAssistant } from '../src/contracts';

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
