import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { CardConfig, HomeAssistant, HostConfig } from './contracts';
import { DEFAULT_STATUSES, INFORMATION_OPTIONS, STATUSES } from './contracts';
import { localize } from './localize';
import type { MessageKey } from './localize';
import { discoverHosts } from './discovery';
import { validateConfig } from './state';

interface HostRow { id: number; host: HostConfig }
type PresentationConfig = Omit<CardConfig, 'type' | 'hosts' | 'title' | 'appearance'>;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit: number): string {
  return typeof value === 'string' && Array.from(value).length <= limit ? value : '';
}

export class HaTty7CardEditor extends LitElement {
  static override styles = css`
    :host { display: block; color: var(--primary-text-color); font-family: var(--ha-font-family-body); font-size: var(--ha-font-size-m); }
    * { box-sizing: border-box; }
    p { line-height: 1.5; color: var(--secondary-text-color); }
    fieldset { min-width: 0; margin: var(--ha-space-4) 0; padding: var(--ha-space-3); border: 1px solid var(--outline-color); border-radius: var(--ha-border-radius-md); }
    legend { padding: 0 var(--ha-space-1); font-weight: var(--ha-font-weight-medium); }
    ha-selector { display: block; min-width: 0; margin: var(--ha-space-2) 0 var(--ha-space-3); }
    .pair { font-size: var(--ha-font-size-s); overflow-wrap: anywhere; }
    a { color: var(--primary-color); display: inline-block; min-height: 44px; padding: var(--ha-space-2) 0; }
    .feedback { color: var(--error-color); }
    .display-options { display: grid; gap: var(--ha-space-3); }
  `;
  private currentHass: HomeAssistant | undefined;
  private rows: HostRow[] = [];
  private nextId = 0;
  private feedback = '';
  private cardTitle = '';
  private appearance: CardConfig['appearance'];
  private presentation: PresentationConfig = {};
  private t(key: MessageKey): string { return localize(this.currentHass, key); }

  set hass(value: HomeAssistant | undefined) { this.currentHass = value; this.requestUpdate(); }
  get hass(): HomeAssistant | undefined { return this.currentHass; }

  setConfig(value: unknown): void {
    // HA calls the editor with partial drafts. Keep only dashboard fields, never spread config/options.
    const hosts = record(value) && Array.isArray(value.hosts) ? value.hosts.slice(0, 64) : [];
    const title = record(value) ? text(value.title, 128) : '';
    this.cardTitle = this.cardTitle.trim() === title ? this.cardTitle : title;
    this.appearance = record(value) && (value.appearance === 'tty7' || value.appearance === 'home-assistant') ? value.appearance : undefined;
    const display: Record<string, unknown> = { type: 'custom:ha-tty7-card', hosts: [] };
    if (record(value)) for (const key of ['group_by', ...INFORMATION_OPTIONS, 'statuses', 'agent_types', 'include_inferred']) {
      if (Object.hasOwn(value, key)) display[key] = value[key];
    }
    try {
      const { type: _type, hosts: _hosts, title: _title, appearance: _appearance, ...presentation } = validateConfig(display);
      this.presentation = presentation;
    } catch { this.presentation = {}; }
    const previousRows = this.rows;
    this.rows = hosts.filter(record).map((host, index) => {
      const previous = previousRows.find(row => row.host.roster_entity === host.roster_entity
        && row.host.connectivity_entity === host.connectivity_entity);
      const name = text(host.name, 128);
      return { id: previous?.id ?? (!host.roster_entity ? previousRows[index]?.id : undefined) ?? this.nextId++, host: {
        // Config echoes must not replace focused controls or eat a space while a label is being typed.
        name: previous && previous.host.name.trim() === name ? previous.host.name : name,
        roster_entity: typeof host.roster_entity === 'string' && /^sensor\.[a-z0-9_]+$/.test(host.roster_entity) ? host.roster_entity : '',
        connectivity_entity: typeof host.connectivity_entity === 'string' && /^binary_sensor\.[a-z0-9_]+$/.test(host.connectivity_entity) ? host.connectivity_entity : '',
      } };
    });
    this.feedback = '';
    this.requestUpdate();
  }

  private publish(): void {
    let config: CardConfig;
    try {
      config = validateConfig({
        type: 'custom:ha-tty7-card', hosts: this.rows.map(row => row.host),
        ...(this.cardTitle.trim() ? { title: this.cardTitle } : {}),
        ...(this.appearance ? { appearance: this.appearance } : {}),
        ...this.presentation,
      });
    } catch {
      this.feedback = this.t('editor_feedback');
      this.requestUpdate();
      return;
    }
    this.feedback = '';
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  private selectHost(event: CustomEvent<{ value: unknown }>, rowId: number): void {
    event.stopPropagation();
    const row = this.rows.find(current => current.id === rowId);
    if (!row) return;
    const pair = discoverHosts(this.currentHass).find(host => host.roster_entity === event.detail.value);
    if (!pair || this.rows.some(other => other !== row && other.host.roster_entity === pair.roster_entity)) return;
    const previousPair = discoverHosts(this.currentHass).find(host => host.roster_entity === row.host.roster_entity);
    const keepLabel = row.host.name && row.host.name !== previousPair?.name;
    row.host = { ...pair, name: keepLabel ? row.host.name : pair.name };
    this.publish();
  }

  private labelChanged(event: CustomEvent<{ value: unknown }>, rowId: number): void {
    event.stopPropagation();
    const row = this.rows.find(current => current.id === rowId);
    if (!row) return;
    if (typeof event.detail.value !== 'string') return;
    row.host = { ...row.host, name: event.detail.value };
    this.publish();
  }

  private titleChanged(event: CustomEvent<{ value: unknown }>): void {
    event.stopPropagation();
    if (typeof event.detail.value !== 'string') return;
    this.cardTitle = event.detail.value;
    this.publish();
  }

  private appearanceChanged(event: CustomEvent<{ value: unknown }>): void {
    event.stopPropagation();
    if (event.detail.value !== undefined && event.detail.value !== 'tty7' && event.detail.value !== 'home-assistant') return;
    this.appearance = event.detail.value;
    this.publish();
  }
  private presentationChanged(key: keyof PresentationConfig, value: unknown): void {
    try {
      const next = { ...this.presentation, [key]: value };
      if (value === undefined) delete next[key];
      const { type: _type, hosts: _hosts, ...presentation } = validateConfig({
        type: 'custom:ha-tty7-card', hosts: [], ...next,
      });
      this.presentation = presentation;
      this.publish();
    } catch {
      this.feedback = this.t('editor_feedback');
      this.requestUpdate();
    }
  }

  private addRow(): void {
    if (this.rows.length >= 64) return;
    const row = { id: this.nextId++, host: { name: '', roster_entity: '', connectivity_entity: '' } };
    this.rows = [...this.rows, row];
    this.requestUpdate();
    void this.updateComplete.then(() => this.shadowRoot?.querySelector<HTMLElement & { focus(): void }>(`[data-row="${row.id}"] [data-field="host"]`)?.focus());
  }

  private removeRow(rowId: number): void {
    if (!this.rows.some(row => row.id === rowId)) return;
    this.rows = this.rows.filter(row => row.id !== rowId);
    this.publish();
    void this.updateComplete.then(() => this.shadowRoot?.querySelector<HTMLElement>('[data-action="add"]')?.focus());
  }

  protected override render() {
    const hosts = discoverHosts(this.currentHass);
    return html`
      <p>${this.t('editor_intro')}</p>
      <ha-selector data-field="title" .hass=${this.currentHass} .label=${this.t('card_title')}
        .selector=${{ text: {} }} .value=${this.cardTitle} .required=${false}
        @value-changed=${this.titleChanged}></ha-selector>
      <ha-selector data-field="appearance" .hass=${this.currentHass} .label=${this.t('appearance')}
        .selector=${{ select: { options: [{ value: 'tty7', label: 'tty7' }, { value: 'home-assistant', label: 'Home Assistant' }],
          mode: 'dropdown', custom_value: false } }} .value=${this.appearance ?? 'tty7'} .required=${false}
        @value-changed=${this.appearanceChanged}></ha-selector>
      ${!hosts.length ? html`<p role="status">${this.t('missing_hosts')}
        <a href="/config/integrations">${this.t('settings_link')}</a>, ${this.t('saved_pairs')}</p>` : nothing}
      ${repeat(this.rows, row => row.id, (row, index) => {
        const choices = hosts.filter(host => host.roster_entity === row.host.roster_entity
          || !this.rows.some(other => other !== row && other.host.roster_entity === host.roster_entity));
        const options = choices.map(host => ({ value: host.roster_entity, label: host.name }));
        if (row.host.roster_entity && !options.some(option => option.value === row.host.roster_entity)) {
          options.push({ value: row.host.roster_entity, label: row.host.name || row.host.roster_entity });
        }
        return html`<fieldset data-row=${row.id}>
          <legend>${this.t('host')} ${index + 1}</legend>
          <ha-selector data-field="host" .hass=${this.currentHass} .label=${`${this.t('host_picker')} ${index + 1}`}
            .selector=${{ select: { options, mode: 'dropdown', custom_value: false } }} .value=${row.host.roster_entity}
            @value-changed=${(event: CustomEvent<{ value: unknown }>) => this.selectHost(event, row.id)}></ha-selector>
          <ha-selector data-field="name" .hass=${this.currentHass} .label=${`${this.t('dashboard_label')} ${index + 1}`}
            .selector=${{ text: {} }} .value=${row.host.name}
            @value-changed=${(event: CustomEvent<{ value: unknown }>) => this.labelChanged(event, row.id)}></ha-selector>
          ${row.host.roster_entity && row.host.connectivity_entity ? html`<p class="pair">${this.t('roster')}: ${row.host.roster_entity}<br>
            ${this.t('connectivity')}: ${row.host.connectivity_entity}</p>` : nothing}
          <ha-button data-action="remove" size="l" variant="neutral" appearance="outlined" aria-label=${`${this.t('remove_host')} ${index + 1}`} @click=${() => this.removeRow(row.id)}>${this.t('remove_host')}</ha-button>
        </fieldset>`;
      })}
      ${this.feedback ? html`<p class="feedback" role="alert">${this.feedback}</p>` : nothing}
      <ha-button data-action="add" size="l" appearance="filled" .disabled=${this.rows.length >= 64} @click=${this.addRow}>${this.t('add_host')}</ha-button>
      <fieldset class="display-options"><legend>${this.t('group_by')}</legend>
        <ha-selector data-field="group_by" .hass=${this.currentHass} .label=${this.t('group_by')}
          .selector=${{ select: { options: (['host', 'workspace', 'tab'] as const).map(group => ({ value: group, label: this.t(`group_${group}`) })),
            mode: 'dropdown', custom_value: false } }} .value=${this.presentation.group_by ?? 'host'} .required=${false}
          @value-changed=${(event: CustomEvent<{ value: unknown }>) => { event.stopPropagation(); this.presentationChanged('group_by', event.detail.value); }}></ha-selector>
        ${[...INFORMATION_OPTIONS, 'include_inferred' as const].map(key => html`
          <ha-selector data-field=${key} .hass=${this.currentHass} .label=${this.t(key)} .selector=${{ boolean: {} }} .required=${false}
            .value=${this.presentation[key] ?? key === 'include_inferred'}
            @value-changed=${(event: CustomEvent<{ value: unknown }>) => { event.stopPropagation(); this.presentationChanged(key, event.detail.value); }}></ha-selector>`)}
        <ha-selector data-field="statuses" .hass=${this.currentHass} .label=${this.t('statuses')}
          .selector=${{ select: { options: STATUSES.map(status => ({ value: status, label: this.t(status) })),
            mode: 'list', multiple: true, custom_value: false } }} .value=${this.presentation.statuses ?? DEFAULT_STATUSES} .required=${false}
          @value-changed=${(event: CustomEvent<{ value: unknown }>) => { event.stopPropagation(); this.presentationChanged('statuses', event.detail.value); }}></ha-selector>
        <ha-selector data-field="agent_types" .hass=${this.currentHass} .label=${this.t('agent_types')}
          .selector=${{ select: { options: this.presentation.agent_types ?? [], mode: 'dropdown', multiple: true, custom_value: true } }}
          .value=${this.presentation.agent_types ?? []} .helper=${this.t('agent_types_help')} .required=${false}
          @value-changed=${(event: CustomEvent<{ value: unknown }>) => { event.stopPropagation(); this.presentationChanged('agent_types', event.detail.value); }}></ha-selector>
      </fieldset>
    `;
  }
}

// HA imports extra modules concurrently with app.ts. App installs its scoped registry shim;
// defining against the earlier native registry would leave HA's card lookup unable to find us.
// The parsed HA root exists before extra modules run; local consumer fixtures have no HA root.
if (document.querySelector('home-assistant')) await customElements.whenDefined('home-assistant');

if (!customElements.get('ha-tty7-card-editor')) customElements.define('ha-tty7-card-editor', HaTty7CardEditor);
declare global { interface HTMLElementTagNameMap { 'ha-tty7-card-editor': HaTty7CardEditor } }
