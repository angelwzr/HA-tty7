import { afterEach, describe, expect, it } from 'vitest';
import { HaTty7Card } from '../src/ha-tty7-card';
import type { HaTty7CardEditor } from '../src/editor';
import { discoverHosts } from '../src/discovery';
import { registryFixture } from '../dev/editor-fixtures';
import { hostConfigs } from '../dev/fixtures';
import type { CardConfig, HomeAssistant } from '../src/contracts';

const elements: HTMLElement[] = [];
afterEach(() => { elements.splice(0).forEach(element => element.remove()); });
async function mount(config: unknown = { type: 'custom:ha-tty7-card', hosts: [] }, hass = registryFixture()) {
  const editor = await HaTty7Card.getConfigElement();
  elements.push(editor);
  editor.setConfig(config);
  editor.hass = hass;
  document.body.append(editor);
  await editor.updateComplete;
  return editor;
}
function change(editor: HaTty7CardEditor, field: string, value: unknown, index = 0) {
  editor.shadowRoot!.querySelectorAll(`[data-field="${field}"]`)[index]!.dispatchEvent(
    new CustomEvent('value-changed', { detail: { value }, bubbles: true, composed: true }));
}
function listen(editor: HaTty7CardEditor): CardConfig[] {
  const configs: CardConfig[] = [];
  editor.addEventListener('config-changed', event => configs.push((event as CustomEvent<{ config: CardConfig }>).detail.config));
  return configs;
}

describe('native host discovery and picker consumer', () => {
  it('suggests real renamed pairs from native registry devices, not lookalike states', () => {
    expect(HaTty7Card.getStubConfig(registryFixture())).toEqual({ type: 'custom:ha-tty7-card', hosts: hostConfigs });
    expect(discoverHosts({ states: registryFixture().states })).toEqual([]);
  });
  it('excludes ambiguous, disabled, unrelated and unbound device pairs', () => {
    const hass = registryFixture();
    hass.entities!['sensor.extra_native'] = { entity_id: 'sensor.extra_native', platform: 'ha_tty7', device_id: 'desktop-device' };
    expect(discoverHosts(hass)).toEqual([hostConfigs[1]]);
    hass.devices!['laptop-device']!.disabled_by = 'config_entry';
    expect(discoverHosts(hass)).toEqual([]);
    expect(HaTty7Card.getStubConfig({ states: {} })).toEqual({ type: 'custom:ha-tty7-card', hosts: [] });
  });
  it('uses renamed entity IDs and user device labels without inferring old IDs', () => {
    const hass = registryFixture();
    delete hass.entities![hostConfigs[0]!.roster_entity];
    delete hass.entities![hostConfigs[0]!.connectivity_entity];
    hass.entities!['sensor.renamed_roster'] = { entity_id: 'sensor.renamed_roster', platform: 'ha_tty7', device_id: 'desktop-device' };
    hass.entities!['binary_sensor.renamed_health'] = { entity_id: 'binary_sensor.renamed_health', platform: 'ha_tty7', device_id: 'desktop-device' };
    hass.devices!['desktop-device']!.name_by_user = 'User host label';
    expect(discoverHosts(hass)).toContainEqual({ name: 'User host label', roster_entity: 'sensor.renamed_roster', connectivity_entity: 'binary_sensor.renamed_health' });
    expect(discoverHosts(hass).some(host => host.roster_entity === hostConfigs[0]!.roster_entity)).toBe(false);
  });
  it('preserves focused label controls and draft spaces across HA config echoes', async () => {
    const editor = await mount({ type: 'custom:ha-tty7-card', hosts: [hostConfigs[0]] });
    const label = editor.shadowRoot!.querySelector('[data-field="name"]')!;
    editor.addEventListener('config-changed', event => editor.setConfig((event as CustomEvent<{ config: CardConfig }>).detail.config));
    change(editor, 'name', 'My ');
    await editor.updateComplete;
    expect(label.isConnected).toBe(true);
    expect((label as HTMLElement & { value: string }).value).toBe('My ');
    change(editor, 'name', 'My workstation');
    await editor.updateComplete;
    expect(editor.shadowRoot!.querySelector('[data-field="name"]')).toBe(label);
  });
  it('applies pending selector and remove events to the current config, not replaced row objects', async () => {
    const editor = await mount({ type: 'custom:ha-tty7-card', hosts: [hostConfigs[0]] });
    const configs = listen(editor);
    const remove = editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="remove"]')!;
    // Exercise the interval before Lit replaces event closures for a new authoritative config.
    editor.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs });
    change(editor, 'host', hostConfigs[1]!.roster_entity);
    expect(configs).toEqual([]);
    remove.click();
    expect(configs).toEqual([{ type: 'custom:ha-tty7-card', hosts: [hostConfigs[1]] }]);
  });
  it('delivers config changes across shadow boundaries to the Lovelace consumer', async () => {
    const editor = await mount({ type: 'custom:ha-tty7-card', hosts: [hostConfigs[0]] });
    const wrapper = document.createElement('div');
    elements.push(wrapper);
    document.body.append(wrapper);
    wrapper.attachShadow({ mode: 'open' }).append(editor);
    const received: CardConfig[] = [];
    const consumer = (event: Event) => received.push((event as CustomEvent<{ config: CardConfig }>).detail.config);
    document.addEventListener('config-changed', consumer, { once: true });
    change(editor, 'name', 'Edited host');
    expect(received).toEqual([{ type: 'custom:ha-tty7-card', hosts: [{ ...hostConfigs[0], name: 'Edited host' }] }]);
    document.removeEventListener('config-changed', consumer);
  });
  it('keeps saved manual config authoritative and roundtrips label edits without adding discovered hosts', async () => {
    const manual = { name: 'Saved label', roster_entity: 'sensor.manual', connectivity_entity: 'binary_sensor.manual' };
    const editor = await mount({ type: 'custom:ha-tty7-card', hosts: [manual] });
    const configs = listen(editor);
    change(editor, 'name', 'Renamed label');
    await editor.updateComplete;
    expect(configs).toEqual([{ type: 'custom:ha-tty7-card', hosts: [{ ...manual, name: 'Renamed label' }] }]);
    const card = new HaTty7Card();
    elements.push(card);
    card.setConfig(configs[0]);
    card.hass = registryFixture();
    document.body.append(card);
    await card.updateComplete;
    expect(card.shadowRoot!.querySelectorAll('section')).toHaveLength(1);
    expect(card.shadowRoot!.textContent).toContain('Renamed label');
    expect(card.shadowRoot!.textContent).not.toContain('Laptop');
  });
  it('handles blank rows locally, selects complete pairs, and removes the last host without fake IDs', async () => {
    const editor = await mount();
    const configs = listen(editor);
    editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="add"]')!.click();
    await editor.updateComplete;
    expect(configs).toEqual([]);
    change(editor, 'host', hostConfigs[0]!.roster_entity);
    await editor.updateComplete;
    expect(configs).toEqual([{ type: 'custom:ha-tty7-card', hosts: [hostConfigs[0]] }]);
    change(editor, 'host', 'sensor.unrelated');
    expect(configs).toHaveLength(1);
    editor.shadowRoot!.querySelector<HTMLButtonElement>('[data-action="remove"]')!.click();
    await editor.updateComplete;
    expect(configs.at(-1)).toEqual({ type: 'custom:ha-tty7-card', hosts: [] });
  });
  it('never emits secrets, options or arbitrary registry data and blocks duplicate labels', async () => {
    const editor = await mount({ type: 'custom:ha-tty7-card', hosts: [{ ...hostConfigs[0], webhook_url: 'PRIVATE_PAIRING' }], options: { token: 'PRIVATE_TOKEN' } });
    const configs = listen(editor);
    change(editor, 'name', 'Visible label');
    await editor.updateComplete;
    expect(configs[0]).toEqual({ type: 'custom:ha-tty7-card', hosts: [{ ...hostConfigs[0], name: 'Visible label' }] });
    expect(JSON.stringify(configs)).not.toMatch(/PRIVATE|webhook|token|options/);
    expect(editor.shadowRoot!.textContent).not.toContain('PRIVATE');
    editor.setConfig({ type: 'custom:ha-tty7-card', hosts: hostConfigs });
    change(editor, 'name', 'Laptop');
    expect(configs).toHaveLength(1);
  });
  it('keeps partial editing visible and provides setup guidance when no integration is installed', async () => {
    const editor = await mount({ type: 'custom:ha-tty7-card', hosts: [{ name: 'Draft' }] }, { states: {} } as HomeAssistant);
    expect(editor.shadowRoot!.querySelector('[data-field="name"]')).not.toBeNull();
    const link = editor.shadowRoot!.querySelector<HTMLAnchorElement>('a')!;
    expect(link.href).toContain('/config/integrations');
    const configs = listen(editor);
    change(editor, 'name', 'Still draft');
    expect(configs).toEqual([]);
  });
});
