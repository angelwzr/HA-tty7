import { afterEach, describe, expect, it } from 'vitest';
import { HaTty7Card } from '../src/ha-tty7-card';
import { fixtureStates, hostConfigs } from '../dev/fixtures';
import { registryFixture } from '../dev/editor-fixtures';
import type { CardConfig, InventorySnapshot } from '../src/contracts';

// Synthetic fixtures only; native component compatibility is verified separately in HA.
const mounted: HTMLElement[] = [];
afterEach(() => mounted.splice(0).forEach(element => element.remove()));
async function mount(settings: Record<string, unknown> = {}) {
  const card = new HaTty7Card(); mounted.push(card);
  card.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs, ...settings });
  card.hass = { states: fixtureStates('inventory') };
  document.body.append(card); await card.updateComplete; return card;
}
const information = ['show_last_contact', 'show_last_success', 'show_summary', 'show_inventory_summary',
  'show_filtered_count', 'show_inventory_status', 'show_inventory_last_contact', 'show_inventory_last_success',
  'show_agent_type', 'show_pane_id', 'show_model', 'show_effort', 'show_session_id', 'show_derived_label',
  'show_lifecycle', 'show_group_name'];

describe('compact defaults and explicit presentation', () => {
  it('renders only core host, title and status with omitted information options', async () => {
    const card = await mount();
    const root = card.shadowRoot!;
    expect(root.querySelector('h2')!.textContent).toBe('Desktop');
    expect(root.querySelector('[data-pane="1"] .agent-name')!.textContent).toBe('Named split tab');
    expect(root.querySelector('[data-pane="1"] .status')!.textContent).toContain('Working');
    expect(root.querySelector('.receipt, .summary, .inventory-summary, .filtered-count, .inventory-state, .identity, .metadata, time')).toBeNull();
    expect(root.querySelector('[data-pane="5"], [data-tab="synthetic-tab-2"], .inventory-panes')).toBeNull();
    expect(root.querySelector('.source, details')).toBeNull();
    expect(root.textContent).not.toMatch(/Source diagnostics|synthetic-stock-build|Collector version/);
  });
  it.each([
    ['show_last_contact', '.receipt'], ['show_last_success', '.receipt'], ['show_summary', '.summary'], ['show_inventory_summary', '.inventory-summary'],
    ['show_filtered_count', '.filtered-count'], ['show_inventory_status', '.inventory-state'],
    ['show_inventory_last_contact', '.inventory-contact'], ['show_inventory_last_success', '.inventory-success'], ['show_agent_type', '.identity'],
    ['show_pane_id', '.identity'], ['show_model', '.metadata'], ['show_effort', '.metadata'], ['show_session_id', '.identity'],
  ])('enables %s independently', async (option, selector) => {
    const card = await mount({ [option]: true });
    expect(card.shadowRoot!.querySelector(selector)).not.toBeNull();
    if (option !== 'show_summary') expect(card.shadowRoot!.querySelector('.summary')).toBeNull();
  });
  it('keeps retained receipt times, derived origin and lifecycle/group annotations independently opt-in', async () => {
    const card = await mount();
    const attrs = card.hass!.states[hostConfigs[0]!.roster_entity]!.attributes;
    const snapshot = attrs.inventory as InventorySnapshot;
    snapshot.derived_labels_included = true; snapshot.tabs[0]!.name = null; snapshot.tabs[0]!.label = 'Synthetic derived';
    snapshot.panes[0]!.hibernated = true;
    card.hass!.states[hostConfigs[0]!.roster_entity]!.state = 'stale';
    attrs.inventory_state = 'stale';
    card.hass = card.hass; await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')!.textContent).not.toMatch(/Derived label|Hibernated|Demo group/);
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs, group_by: 'tab',
      show_last_success: true, show_inventory_last_success: true, show_derived_label: true, show_lifecycle: true, show_group_name: true });
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('.receipt time')).not.toBeNull();
    expect(card.shadowRoot!.querySelector('.inventory-success time')).not.toBeNull();
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')!.textContent).toContain('Derived label');
    expect(card.shadowRoot!.querySelector('[data-pane="1"]')!.textContent).toContain('Hibernated');
    expect(card.shadowRoot!.querySelector('.group-head')!.textContent).toContain('Demo group');
  });
  it('keeps stale inventory safety visible without informational status or receipt settings', async () => {
    const card = await mount();
    card.hass!.states[hostConfigs[0]!.roster_entity]!.attributes.inventory_state = 'stale';
    card.hass = card.hass; await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-inventory-state="stale"]')!.textContent).toContain('stale');
    expect(card.shadowRoot!.querySelector('time')).toBeNull();
  });
  it.each(['host', 'tab', 'workspace'])('unknown opt-in includes reported, detected, plain and orphan rows in %s grouping', async group_by => {
    const card = await mount({ group_by });
    const snapshot = card.hass!.states[hostConfigs[0]!.roster_entity]!.attributes.inventory as InventorySnapshot;
    snapshot.tabs.push({ ...snapshot.tabs[1]!, tab_id: 'plain-tab', name: 'Plain tab', detected_agent: null, pane_ids: [] });
    card.hass = card.hass; await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-tab="plain-tab"], [data-pane="5"], .inventory-panes')).toBeNull();
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs, group_by, statuses: ['unknown'] });
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('[data-pane="5"]')).not.toBeNull();
    expect(card.shadowRoot!.querySelector('[data-tab="synthetic-tab-2"]')!.textContent).toContain('Unknown');
    expect(card.shadowRoot!.querySelector('[data-tab="plain-tab"]')!.textContent).toContain('Unknown');
    expect(card.shadowRoot!.querySelector('.inventory-panes')!.textContent).toContain('Unknown');
  });
  it('orders outer hosts by label then roster ID and isolates identical session/pane identities', async () => {
    const card = await mount();
    const states = card.hass!.states;
    const first = hostConfigs[0]!; const second = hostConfigs[1]!;
    states[second.roster_entity] = structuredClone(states[first.roster_entity]!);
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: [{ ...second, name: 'Zulu' }, { ...first, name: 'Alpha' }] });
    card.hass = { states }; await card.updateComplete;
    expect([...card.shadowRoot!.querySelectorAll('section h2')].map(node => node.textContent)).toEqual(['Alpha', 'Zulu']);
    const rows = card.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-pane="1"]');
    rows[0]!.click(); await card.updateComplete;
    expect(rows[0]!.getAttribute('aria-expanded')).toBe('true');
    expect(rows[1]!.getAttribute('aria-expanded')).toBe('false');
    card.setConfig({ type: 'custom:ha-tty7-card', hosts: [{ ...second, name: 'Same' }, { ...first, name: 'Same' }] });
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('section [data-pane="1"]')!.getAttribute('aria-expanded')).toBe('true');
  });
  it('uses native editor controls and persists every independent flag, unknown opt-in and custom agent types', async () => {
    const editor = await HaTty7Card.getConfigElement(); mounted.push(editor);
    editor.setConfig({ type: 'custom:ha-tty7-card', hosts: [hostConfigs[0]] }); editor.hass = registryFixture();
    document.body.append(editor); await editor.updateComplete;
    expect(editor.shadowRoot!.querySelector('input, select, textarea, button')).toBeNull();
    expect(editor.shadowRoot!.querySelectorAll('ha-button')).toHaveLength(2);
    let saved: CardConfig | undefined;
    editor.addEventListener('config-changed', event => {
      saved = (event as CustomEvent<{ config: CardConfig }>).detail.config; editor.setConfig(saved);
    });
    for (const field of information) {
      const control = editor.shadowRoot!.querySelector<HTMLElement & { value: unknown }>(`ha-selector[data-field="${field}"]`)!;
      expect(control.value).toBe(false);
      control.dispatchEvent(new CustomEvent('value-changed', { detail: { value: true } }));
      await editor.updateComplete;
      expect(saved).toMatchObject({ [field]: true });
    }
    for (const [field, value] of [['statuses', ['unknown']], ['agent_types', ['Synthetic custom type']]] as const) {
      editor.shadowRoot!.querySelector(`ha-selector[data-field="${field}"]`)!.dispatchEvent(new CustomEvent('value-changed', { detail: { value } }));
      await editor.updateComplete; expect(saved).toMatchObject({ [field]: value });
    }
    expect(saved!.hosts).toEqual([hostConfigs[0]]);
  });
});
