import { HaTty7Card } from '../src/ha-tty7-card';
import { registryFixture } from './editor-fixtures';
import './editor-selectors';
import { fixtureStates, hostConfigs, SCENARIOS } from './fixtures';
import type { Scenario } from './fixtures';
import type { AgentRecord, CardConfig, HassStates } from '../src/contracts';

const card = document.querySelector('ha-tty7-card')!;
const select = document.querySelector<HTMLSelectElement>('#scenario')!;
const themeButton = document.querySelector<HTMLButtonElement>('#theme')!;
let dark = false;
let scenario: Scenario = 'healthy';
let states: HassStates = {};
card.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs });
for (const name of SCENARIOS) {
  const option = document.createElement('option');
  option.value = name;
  option.textContent = name;
  select.append(option);
}
function showScenario(next: Scenario): void {
  scenario = next;
  select.value = next;
  states = fixtureStates(next, Date.now());
  card.hass = { states, connection: { connected: next !== 'disconnected' }, themes: { darkMode: dark } };
}
const requested = new URLSearchParams(location.search).get('scenario');
showScenario(SCENARIOS.includes(requested as Scenario) ? requested as Scenario : 'healthy');
select.addEventListener('change', () => showScenario(select.value as Scenario));
document.querySelector('#heartbeat')!.addEventListener('click', () => {
  for (const host of hostConfigs) {
    const roster = states[host.roster_entity];
    if (roster && Array.isArray(roster.attributes.agents)) {
      roster.attributes.agents.reverse();
      roster.attributes.last_contact = new Date().toISOString();
      roster.attributes.last_success = roster.attributes.last_contact;
    }
  }
  card.hass = { states, connection: { connected: scenario !== 'disconnected' }, themes: { darkMode: dark } };
});
document.querySelector('#replace')!.addEventListener('click', () => {
  const roster = states[hostConfigs[0]!.roster_entity];
  if (roster && Array.isArray(roster.attributes.agents)) {
    const first = (roster.attributes.agents as AgentRecord[]).find(agent => agent.pane_id === 1);
    if (first) first.session_id = 'demo-replacement-session';
  }
  card.hass = { states, connection: { connected: scenario !== 'disconnected' }, themes: { darkMode: dark } };
});
themeButton.addEventListener('click', () => {
  dark = !dark;
  document.body.classList.toggle('dark', dark);
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.textContent = dark ? 'Light fixture' : 'Dark fixture';
  card.hass = { states, connection: { connected: scenario !== 'disconnected' }, themes: { darkMode: dark } };
});

if (new URLSearchParams(location.search).has('editor')) {
  const fixture = registryFixture();
  const params = new URLSearchParams(location.search);
  if (params.get('integration') === 'missing') { fixture.entities = {}; fixture.devices = {}; }
  const config = params.get('config') === 'empty' ? { type: 'custom:ha-tty7-card' as const, hosts: [] } : HaTty7Card.getStubConfig(fixture);
  const editor = await HaTty7Card.getConfigElement();
  editor.setConfig(config);
  editor.hass = fixture;
  card.setConfig(config);
  card.hass = fixture;
  const saved = document.querySelector<HTMLOutputElement>('#saved-config')!;
  saved.textContent = JSON.stringify(config);
  editor.addEventListener('config-changed', event => {
    const next = (event as CustomEvent<{ config: CardConfig }>).detail.config;
    editor.setConfig(next);
    saved.textContent = JSON.stringify(next);
    card.setConfig(next);
    card.hass = fixture;
  });
  document.querySelector('#editor-mount')!.append(editor);
  document.querySelector<HTMLElement>('#editor-fixture')!.hidden = false;
}
