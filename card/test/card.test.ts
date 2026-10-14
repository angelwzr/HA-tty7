import { afterEach, describe, expect, it, vi } from 'vitest';
import { HaTty7Card } from '../src/ha-tty7-card';
import { agentFixture, fixtureStates, hostConfigs, HOSTILE, FIXTURE_NOW } from '../dev/fixtures';
import type { Scenario } from '../dev/fixtures';
import type { AgentRecord } from '../src/contracts';

const cards: HaTty7Card[] = [];
async function mount(scenario: Scenario = 'healthy') {
  const card = document.createElement('ha-tty7-card') as HaTty7Card;
  cards.push(card);
  card.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs });
  card.hass = { states: fixtureStates(scenario, Date.now()), connection: { connected: scenario !== 'disconnected' } };
  document.body.append(card);
  await card.updateComplete;
  return card;
}
afterEach(() => { for (const card of cards.splice(0)) card.remove(); vi.useRealTimers(); });

describe('Lovelace card consumer behavior', () => {
  it('does not leak invalid configuration into rendered feedback', async () => {
    const card = new HaTty7Card();
    cards.push(card);
    document.body.append(card);
    await card.updateComplete;
    expect(() => card.setConfig({ type: 'custom:ha-tty7-card', hosts: [], secret: 'PRIVATE_SECRET' })).toThrow();
    await card.updateComplete;
    expect(card.shadowRoot!.textContent).not.toContain('PRIVATE_SECRET');
  });
  it('renders configured title as inert text and preserves the existing default for saved configs', async () => {
    const card = await mount();
    expect(card.shadowRoot!.querySelector('h1')!.textContent).toBe('tty7 agents');
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs, title: HOSTILE });
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('h1')!.textContent).toBe(HOSTILE);
    expect(card.shadowRoot!.querySelector('img,script,iframe')).toBeNull();
    expect(card.shadowRoot!.querySelector('header')!.textContent).not.toContain('Read-only status');
  });
  it('expands structured details without inventing activity units', async () => {
    const card = await mount();
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="2"]')!;
    row.click();
    await card.updateComplete;
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(card.shadowRoot!.querySelector('dl:not([hidden])')!.textContent).not.toMatch(/tokens|seconds/);
  });
  it.each([{ pane: 4, status: 'Idle' }, { pane: 3, status: 'Done' }])('distinguishes inferred $status in visible, accessible and expanded status', async ({ pane, status }) => {
    const card = await mount();
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>(`[data-pane="${pane}"]`)!;
    expect(row.querySelector('.status')!.textContent).toBe(status);
    const agents = card.hass!.states[hostConfigs[0]!.roster_entity]!.attributes.agents as Record<string, unknown>[];
    agents.find(agent => agent.pane_id === pane)!.inferred = true;
    card.hass = card.hass;
    await card.updateComplete;
    expect(row.querySelector('.status')!.textContent).toBe(`${status} (inferred)`);
    expect(row.getAttribute('aria-label')).toContain(`${status} (inferred)`);
    row.click();
    await card.updateComplete;
    const detail = card.shadowRoot!.querySelector('dl:not([hidden])')!;
    expect([...detail.querySelectorAll('dt')].find(term => term.textContent === 'Status')!.nextElementSibling!.textContent).toBe(`${status} (inferred)`);
    agents.find(agent => agent.pane_id === pane)!.inferred = false;
    card.hass = card.hass;
    await card.updateComplete;
    expect(row.querySelector('.status')!.textContent).toBe(status);
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });
  it('preserves details and button nodes across heartbeat reorder but closes replacement identities', async () => {
    const card = await mount();
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!;
    row.click();
    await card.updateComplete;
    const states = fixtureStates('healthy', Date.now());
    (states[hostConfigs[0]!.roster_entity]!.attributes.agents as unknown[]).reverse();
    card.hass = { states };
    await card.updateComplete;
    expect(row.isConnected).toBe(true);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    const agents = states[hostConfigs[0]!.roster_entity]!.attributes.agents as AgentRecord[];
    agents.find(a => a.pane_id === 1)!.session_id = 'replacement';
    card.hass = { states };
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')!.getAttribute('aria-expanded')).toBe('false');
  });
  it('retains expansion through host filtering and never reads unconfigured entities', async () => {
    const card = await mount();
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="2"]')!;
    row.click();
    await card.updateComplete;
    const select = card.shadowRoot!.querySelector('select')!;
    select.value = hostConfigs[1]!.roster_entity;
    select.dispatchEvent(new Event('change'));
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('section')!.textContent).not.toContain('Desktop');
    // The option remains, but its host section is filtered.
    expect(card.shadowRoot!.querySelectorAll('section')).toHaveLength(1);
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-pane="2"]')!.getAttribute('aria-expanded')).toBe('true');
    const states = fixtureStates('healthy', Date.now());
    states['sensor.unconfigured'] = { state: '1', attributes: { agents: [agentFixture({ agent: 'UNCONFIGURED_AGENT' })] } };
    card.hass = { states };
    await card.updateComplete;
    expect(card.shadowRoot!.textContent).not.toContain('UNCONFIGURED_AGENT');
  });
  it('escapes hostile values and ignores payload-controlled rendering fields', async () => {
    const card = await mount('hostile');
    expect(card.shadowRoot!.textContent).toContain(HOSTILE);
    expect(card.shadowRoot!.querySelector('img,script,iframe,a')).toBeNull();
    expect(card.shadowRoot!.querySelector('svg')).not.toBeNull();
  });
  it.each([-30_000, 30_000])('keeps rows and expansion when the viewer clock shifts by %ims', async skew => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXTURE_NOW);
    const card = await mount();
    const states = card.hass!.states;
    const receipt = states[hostConfigs[0]!.roster_entity]!.attributes.last_contact as string;
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!;
    row.click();
    await card.updateComplete;
    vi.setSystemTime(FIXTURE_NOW + skew);
    card.hass = { states };
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[role="status"]')!.getAttribute('data-state')).toBe('healthy');
    expect(card.shadowRoot!.querySelectorAll('.agent-row')).toHaveLength(6);
    expect(row.isConnected).toBe(true);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(card.shadowRoot!.querySelector('time')!.getAttribute('datetime')).toBe(receipt);
    expect(card.shadowRoot!.textContent).not.toContain('s ago');
  });
  it('changes healthy to stale only when HA publishes expiry, preserving open last-known details', async () => {
    vi.useFakeTimers();
    const card = await mount();
    const row = card.shadowRoot!.querySelector<HTMLButtonElement>('[data-pane="1"]')!;
    row.click();
    await card.updateComplete;
    vi.advanceTimersByTime(60_000);
    card.requestUpdate();
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[role="status"]')!.getAttribute('data-state')).toBe('healthy');
    card.hass = { states: fixtureStates('stale', Date.now()) };
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[role="status"]')!.getAttribute('data-state')).toBe('stale');
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(card.shadowRoot!.textContent).toContain('Last-known roster');
    card.hass = { states: fixtureStates('unconfirmed', Date.now()) };
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[role="status"]')!.getAttribute('data-state')).toBe('unconfirmed');
  });
});
