import { LitElement, css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { CardConfig, HomeAssistant, HostConfig } from './contracts';
import { discoverHosts } from './discovery';
import { validateConfig } from './state';

interface HostRow { id: number; host: HostConfig }
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit: number): string {
  return typeof value === 'string' && Array.from(value).length <= limit ? value : '';
}

export class HaTty7CardEditor extends LitElement {
  static override styles = css`
    :host { display: block; color: var(--primary-text-color, #1c1c1e); }
    * { box-sizing: border-box; }
    p { line-height: 1.5; color: var(--secondary-text-color, #666); }
    fieldset { min-width: 0; margin: 16px 0; padding: 12px; border: 1px solid var(--divider-color, #ddd); border-radius: 8px; }
    legend { padding: 0 4px; }
    ha-selector { display: block; min-width: 0; margin: 8px 0 12px; }
    .pair { font-size: 12px; overflow-wrap: anywhere; }
    button { min-height: 44px; min-width: 44px; padding: 8px 16px; border: 1px solid var(--divider-color, #bbb);
      border-radius: 6px; color: inherit; background: var(--card-background-color, #fff); font: inherit; cursor: pointer; }
    button:focus-visible, a:focus-visible { outline: 2px solid var(--primary-color, #1f6bf0); outline-offset: 2px; }
    button:disabled { cursor: default; opacity: .5; }
    a { color: var(--primary-color, #1f6bf0); display: inline-block; min-height: 44px; padding: 8px 0; }
    .feedback { color: var(--error-color, #b3261e); }
  `;
  private currentHass: HomeAssistant | undefined;
  private rows: HostRow[] = [];
  private nextId = 0;
  private feedback = '';

  set hass(value: HomeAssistant | undefined) { this.currentHass = value; this.requestUpdate(); }
  get hass(): HomeAssistant | undefined { return this.currentHass; }

  setConfig(value: unknown): void {
    // HA calls the editor with partial drafts. Keep only dashboard fields, never spread config/options.
    const hosts = record(value) && Array.isArray(value.hosts) ? value.hosts.slice(0, 64) : [];
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
      config = validateConfig({ type: 'custom:ha-tty7-card', hosts: this.rows.map(row => row.host) });
    } catch {
      this.feedback = 'Choose a host pair and a unique, non-empty label for each row.';
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
    void this.updateComplete.then(() => this.shadowRoot?.querySelector<HTMLButtonElement>('[data-action="add"]')?.focus());
  }

  protected override render() {
    const hosts = discoverHosts(this.currentHass);
    return html`
      <p>Choose HA-tty7 hosts and dashboard labels. Only status is shown; pairing credentials stay in integration settings.</p>
      ${!hosts.length ? html`<p role="status">No configured HA-tty7 host pairs are available. Add a host in
        <a href="/config/integrations">Settings · Devices & services</a>, then return to this editor.
        Saved entity pairs remain unchanged.</p>` : nothing}
      ${repeat(this.rows, row => row.id, (row, index) => {
        const choices = hosts.filter(host => host.roster_entity === row.host.roster_entity
          || !this.rows.some(other => other !== row && other.host.roster_entity === host.roster_entity));
        const options = choices.map(host => ({ value: host.roster_entity, label: host.name }));
        if (row.host.roster_entity && !options.some(option => option.value === row.host.roster_entity)) {
          options.push({ value: row.host.roster_entity, label: row.host.name || row.host.roster_entity });
        }
        return html`<fieldset data-row=${row.id}>
          <legend>Host ${index + 1}</legend>
          <ha-selector data-field="host" .hass=${this.currentHass} .label=${`HA-tty7 host ${index + 1}`}
            .selector=${{ select: { options, mode: 'dropdown', custom_value: false } }} .value=${row.host.roster_entity}
            @value-changed=${(event: CustomEvent<{ value: unknown }>) => this.selectHost(event, row.id)}></ha-selector>
          <ha-selector data-field="name" .hass=${this.currentHass} .label=${`Dashboard label ${index + 1}`}
            .selector=${{ text: {} }} .value=${row.host.name}
            @value-changed=${(event: CustomEvent<{ value: unknown }>) => this.labelChanged(event, row.id)}></ha-selector>
          ${row.host.roster_entity && row.host.connectivity_entity ? html`<p class="pair">Roster: ${row.host.roster_entity}<br>
            Connectivity: ${row.host.connectivity_entity}</p>` : nothing}
          <button type="button" data-action="remove" aria-label=${`Remove host ${index + 1}`} @click=${() => this.removeRow(row.id)}>Remove host</button>
        </fieldset>`;
      })}
      ${this.feedback ? html`<p class="feedback" role="alert">${this.feedback}</p>` : nothing}
      <button type="button" data-action="add" ?disabled=${this.rows.length >= 64} @click=${this.addRow}>Add host</button>
    `;
  }
}

if (!customElements.get('ha-tty7-card-editor')) customElements.define('ha-tty7-card-editor', HaTty7CardEditor);
declare global { interface HTMLElementTagNameMap { 'ha-tty7-card-editor': HaTty7CardEditor } }
