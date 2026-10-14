import { LitElement, html, nothing, svg } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { AgentView, CardConfig, ErrorCode, HomeAssistant, HostState, HostView } from './contracts';
import { deriveHostView, validateConfig } from './state';
import { cardStyles } from './styles';
import './editor';
import type { HaTty7CardEditor } from './editor';
import { discoverHosts } from './discovery';

const STATUS_LABELS = { working: 'Working', waiting: 'Waiting', done: 'Done', idle: 'Idle', unknown: 'Unknown' };
const HOST_LABELS: Record<HostState, string> = {
  loading: 'Loading', healthy: 'Online', empty: 'Online · empty', error: 'Collector error', stale: 'Stale',
  unconfirmed: 'Unconfirmed', malformed: 'Malformed data', disconnected: 'Home Assistant disconnected', offline: 'Offline',
};
const NOTICES: Partial<Record<HostState, string>> = {
  loading: 'Waiting for the configured Home Assistant entities.',
  empty: 'No reported agents. The latest snapshot is healthy and empty.',
  error: 'The collector reported a failure. Last-known roster; not live status.',
  stale: 'No accepted contact for more than 45 seconds. Last-known roster; not live status.',
  unconfirmed: 'Waiting for a fresh snapshot after startup. Last-known roster; not live status.',
  malformed: 'Entity data does not match the status contract. Check the configured roster and package version.',
  disconnected: 'The Home Assistant connection is down. Last-known roster; not live status.',
  offline: 'Host connectivity is unavailable. Last-known roster; not live status.',
};
const ERROR_LABELS: Record<ErrorCode, string> = {
  cli_unavailable: 'tty7 unavailable', cli_timeout: 'tty7 read timed out', cli_failed: 'tty7 read failed',
  invalid_payload: 'Invalid status payload', payload_too_large: 'Status payload too large',
};

export class HaTty7Card extends LitElement {
  static override styles = cardStyles;
  static async getConfigElement(): Promise<HaTty7CardEditor> {
    // HA lazily loads selectors. Load its built-in editor through the supported card helpers.
    if (!customElements.get('ha-selector') && window.loadCardHelpers) {
      const helpers = await window.loadCardHelpers();
      helpers.createCardElement({ type: 'entities', entities: [] });
      await customElements.whenDefined('hui-entities-card');
      const entitiesCard = customElements.get('hui-entities-card') as CustomElementConstructor & {
        getConfigElement(): Promise<HTMLElement>;
      };
      await entitiesCard.getConfigElement();
    }
    return document.createElement('ha-tty7-card-editor');
  }

  static getStubConfig(hass: HomeAssistant): CardConfig {
    return { type: 'custom:ha-tty7-card', hosts: discoverHosts(hass) };
  }
  private config: CardConfig | undefined;
  private configurationError = false;
  private currentHass: HomeAssistant | undefined;
  private selectedHost = '';
  private readonly expanded = new Set<string>();

  setConfig(value: unknown): void {
    try {
      this.config = validateConfig(value);
      this.configurationError = false;
      this.selectedHost = '';
      this.expanded.clear();
    } catch (error) {
      this.config = undefined;
      this.configurationError = true;
      this.requestUpdate();
      throw error;
    }
    this.requestUpdate();
  }

  set hass(value: HomeAssistant | undefined) {
    this.currentHass = value;
    this.toggleAttribute('dark', value?.themes?.darkMode === true);
    // HA may mutate a states object in place; a received update still needs rendering.
    this.requestUpdate();
  }
  get hass(): HomeAssistant | undefined { return this.currentHass; }

  getCardSize(): number {
    return 2 + (this.config?.hosts.length ?? 1) * 2;
  }


  private toggleDetails(identity: string): void {
    if (this.expanded.has(identity)) this.expanded.delete(identity);
    else this.expanded.add(identity);
    this.requestUpdate();
  }

  private renderAgent(agent: AgentView, lastKnown: boolean) {
    const open = this.expanded.has(agent.identity);
    // Encode identity into a safe DOM ID, without allowing incoming strings to become selectors/markup.
    const detailId = `details-${Array.from(agent.identity, character => character.codePointAt(0)!.toString(16)).join('-')}`;
    return html`<li class=${lastKnown ? 'last-known' : ''}>
      <button class="agent-row" data-pane=${agent.pane_id} aria-expanded=${String(open)} aria-controls=${detailId}
        aria-label=${`${agent.agent}, pane ${agent.pane_id}, ${STATUS_LABELS[agent.status]}${lastKnown ? ', last known' : ''}. ${open ? 'Hide' : 'Show'} details`}
        @click=${() => this.toggleDetails(agent.identity)}>
        <span class="agent-icon" aria-hidden="true">${svg`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="12" height="11" rx="3"/><path d="M10 2v3M1 9h3m12 0h3M7 16v2m6-2v2"/><circle cx="7.5" cy="10" r=".75" fill="currentColor"/><circle cx="12.5" cy="10" r=".75" fill="currentColor"/><path d="M7 13h6"/></svg>`}</span>
        <span class="agent-copy"><span class="agent-name">${agent.agent}</span>
          <span class="identity">Pane ${agent.pane_id} · ${agent.session_id ?? 'Session unavailable'}</span></span>
        <span class="status" data-status=${agent.status}><span class="dot" aria-hidden="true"></span>${STATUS_LABELS[agent.status]}</span>
        <span class="chevron" aria-hidden="true">${open ? '⌄' : '›'}</span>
      </button>
      <dl id=${detailId} ?hidden=${!open}>
        ${open ? [
          ['Agent', agent.agent], ['Status', STATUS_LABELS[agent.status]], ['Pane', agent.pane_id],
          ['Session', agent.session_id], ['Activity (as reported)', agent.activity], ['Turns (as reported)', agent.turns],
          ['Model', agent.model], ['Effort', agent.effort], ['Permission mode (informational)', agent.permission_mode],
        ].map(([label, value]) => html`<dt>${label}</dt><dd>${value ?? 'Unavailable'}</dd>`) : nothing}
      </dl>
    </li>`;
  }

  private renderHost(host: HostView) {
    return html`<section aria-label=${host.config.name}>
      <div class="host-head"><div class="host-title"><h2>${host.config.name}</h2>
        <span class="host-state" data-state=${host.state} role="status">${HOST_LABELS[host.state]}</span></div>
        <p class="receipt">${host.lastContact === null ? 'No confirmed receipt' : html`Last contact (HA): <time datetime=${host.lastContact}>${host.lastContact}</time>`}
          ${host.agents.length ? html` · ${host.agents.length} reported` : nothing}</p>
        ${host.lastKnown && host.lastSuccess !== null ? html`<p class="receipt">Last successful snapshot (HA): <time datetime=${host.lastSuccess}>${host.lastSuccess}</time></p>` : nothing}
      </div>
      ${NOTICES[host.state] ? html`<p class="notice">${NOTICES[host.state]}${host.errorCode ? html` ${ERROR_LABELS[host.errorCode]}.` : nothing}</p>` : nothing}
      ${host.agents.length ? html`<ul>${repeat(host.agents, agent => agent.identity, agent => this.renderAgent(agent, host.lastKnown))}</ul>` : nothing}
    </section>`;
  }

  protected override render() {
    if (!this.config) return html`<ha-card><p class="configuration"><strong>${this.configurationError ? 'Configuration error' : 'Not configured'}</strong><br>
      Configure unique host names, sensor rosters, and binary_sensor connectivity entities.</p></ha-card>`;
    if (!this.config.hosts.length) return html`<ha-card><p class="configuration"><strong>No hosts selected</strong><br>
      Add HA-tty7 in Settings · Devices & services, then choose hosts in this card's visual editor.</p></ha-card>`;
    const hosts = this.config.hosts.map(host => deriveHostView(host, this.currentHass?.states ?? {},
      this.currentHass?.connection?.connected ?? true));
    const identities = new Set(hosts.flatMap(host => host.agents.map(agent => agent.identity)));
    for (const identity of this.expanded) if (!identities.has(identity)) this.expanded.delete(identity);
    return html`<ha-card>
      <header><div><h1><span class="brand">tty7</span> agents</h1><span class="subtitle">Read-only status</span></div>
        ${hosts.length > 1 ? html`<label>Show host<select aria-label="Show host" .value=${this.selectedHost}
          @change=${(event: Event) => { this.selectedHost = (event.target as HTMLSelectElement).value; this.requestUpdate(); }}>
          <option value="">All hosts</option>${this.config.hosts.map(host => html`<option value=${host.roster_entity}>${host.name}</option>`)}
        </select></label>` : nothing}
      </header>
      ${repeat(hosts.filter(host => !this.selectedHost || host.config.roster_entity === this.selectedHost),
        host => host.config.roster_entity, host => this.renderHost(host))}
    </ha-card>`;
  }
}

if (!customElements.get('ha-tty7-card')) customElements.define('ha-tty7-card', HaTty7Card);
declare global {
  interface HTMLElementTagNameMap { 'ha-tty7-card': HaTty7Card }
  interface Window {
    customCards?: { type: string; name: string; description: string; preview?: boolean }[];
    loadCardHelpers?: () => Promise<{ createCardElement(config: { type: 'entities'; entities: string[] }): HTMLElement }>;
  }
}
window.customCards ??= [];
if (!window.customCards.some(card => card.type === 'ha-tty7-card')) {
  window.customCards.push({ type: 'ha-tty7-card', name: 'HA-tty7', description: 'Read-only structured tty7 agent status grouped by host.', preview: true });
}
