import { LitElement, html, nothing, svg } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { AgentView, CardConfig, HomeAssistant, HostView, TabView } from './contracts';
import { deriveHostView, validateConfig } from './state';
import { cardStyles } from './styles';
import { formatTimestamp } from './datetime';
import './editor';
import type { HaTty7CardEditor } from './editor';
import { discoverHosts } from './discovery';
import { filterAgents, origin, selectRepresentative, tabForPane, tabViews, workspaceViews } from './inventory';
import { localize } from './localize';
import type { MessageKey } from './localize';

export class HaTty7Card extends LitElement {
  static override styles = cardStyles;
  static async getConfigElement(): Promise<HaTty7CardEditor> {
    if (!customElements.get('ha-selector') && window.loadCardHelpers) {
      const helpers = await window.loadCardHelpers();
      helpers.createCardElement({ type: 'entities', entities: [] });
      await customElements.whenDefined('hui-entities-card');
      const entitiesCard = customElements.get('hui-entities-card') as CustomElementConstructor & { getConfigElement(): Promise<HTMLElement> };
      await entitiesCard.getConfigElement();
    }
    return document.createElement('ha-tty7-card-editor');
  }
  static getStubConfig(hass: HomeAssistant): CardConfig {
    return { type: 'custom:ha-tty7-card', hosts: discoverHosts(hass), appearance: 'home-assistant' };
  }
  private config: CardConfig | undefined;
  private configurationError = false;
  private currentHass: HomeAssistant | undefined;
  private selectedHost = '';
  private readonly expanded = new Set<string>();
  private t(key: MessageKey): string { return localize(this.currentHass, key); }

  setConfig(value: unknown): void {
    try {
      this.config = validateConfig(value);
      this.configurationError = false;
      this.setAttribute('appearance', this.config.appearance ?? 'tty7');
      if (!this.config.hosts.some(host => host.roster_entity === this.selectedHost)) this.selectedHost = '';
    } catch (error) {
      this.config = undefined; this.configurationError = true; this.requestUpdate(); throw error;
    }
    this.requestUpdate();
  }
  set hass(value: HomeAssistant | undefined) {
    this.currentHass = value;
    this.toggleAttribute('dark', value?.themes?.darkMode === true);
    this.requestUpdate();
  }
  get hass(): HomeAssistant | undefined { return this.currentHass; }
  getCardSize(): number { return 2 + (this.config?.hosts.length ?? 1) * 2; }
  private toggleDetails(identity: string): void {
    if (this.expanded.has(identity)) this.expanded.delete(identity); else this.expanded.add(identity);
    this.requestUpdate();
  }
  private renderAgent(agent: AgentView, host: HostView) {
    const open = this.expanded.has(agent.identity);
    const statusLabel = `${this.t(agent.status)}${agent.inferred === true ? ` (${this.t('inferred')})` : ''}`;
    const tab = tabForPane(host.inventory, agent.pane_id);
    const pane = host.inventory?.panes.find(item => item.pane_id === agent.pane_id);
    const title = tab?.name ?? tab?.label ?? agent.agent;
    const model = agent.model ?? this.t('not_reported');
    const effort = agent.effort === '' ? this.t('none_applicable') : agent.effort ?? this.t('not_reported');
    const showModel = this.config?.show_model !== false && agent.model !== null && agent.model.trim().length > 0;
    const showEffort = this.config?.show_effort !== false && agent.effort !== null && (agent.effort === '' || agent.effort.trim().length > 0);
    const showSession = this.config?.show_session_id === true && !!agent.session_id?.trim();
    const detailId = `details-${Array.from(agent.identity, character => character.codePointAt(0)!.toString(16)).join('-')}`;
    const reportOrigin = origin(agent);
    const details: [string, string | number | null][] = [
      [this.t('agent'), agent.agent], [this.t('status'), statusLabel], [this.t('pane'), agent.pane_id], [this.t('session'), agent.session_id],
      [this.t('provenance'), this.t(reportOrigin === 'unknown' ? 'unknown_origin' : reportOrigin)],
      [this.t('activity'), agent.activity], [this.t('turns'), agent.turns], [this.t('model'), model], [this.t('effort'), effort],
      [this.t('permission'), agent.permission_mode],
    ];
    if (agent.model === null || agent.effort === null) details.push([this.t('model'), this.t('capability_unknown')]);
    if (tab) details.push([this.t('workspace'), tab.workspace_id], [this.t('tab'), tab.tab_id]);
    if (pane) details.push([this.t('live'), pane.live === null ? this.t('not_reported') : this.t(pane.live ? 'live' : 'not_live')],
      [this.t('hibernated'), this.t(pane.hibernated ? 'yes' : 'no')], [this.t('orphan'), this.t(pane.orphan ? 'yes' : 'no')]);
    return html`<li class=${host.lastKnown ? 'last-known' : ''}>
      <button class="agent-row" data-pane=${agent.pane_id} aria-expanded=${String(open)} aria-controls=${detailId}
        aria-label=${`${agent.agent}, ${this.t('pane_accessible')} ${agent.pane_id}, ${statusLabel}${title !== agent.agent ? `, ${title}` : ''}${host.lastKnown ? `, ${this.t('last_known')}` : ''}. ${this.t(open ? 'hide_details' : 'show_details')}`}
        @click=${() => this.toggleDetails(agent.identity)}>
        <span class="agent-icon" aria-hidden="true">${svg`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="12" height="11" rx="3"/><path d="M10 2v3M1 9h3m12 0h3M7 16v2m6-2v2"/><circle cx="7.5" cy="10" r=".75" fill="currentColor"/><circle cx="12.5" cy="10" r=".75" fill="currentColor"/><path d="M7 13h6"/></svg>`}</span>
        <span class="agent-copy"><span class="agent-name">${title}</span>
          <span class="identity">${title !== agent.agent ? html`${agent.agent} · ` : nothing}${this.t('pane')} ${agent.pane_id}${showSession ? html` · ${agent.session_id}` : nothing}</span>
          ${showModel || showEffort ? html`<span class="metadata">${showModel ? html`${this.t('model')}: ${model}` : nothing}${showModel && showEffort ? ' · ' : nothing}${showEffort ? html`${this.t('effort')}: ${effort}` : nothing}</span>` : nothing}
          ${tab?.label && !tab.name ? html`<span class="metadata">${this.t('derived')}</span>` : nothing}
          ${pane?.hibernated || pane?.orphan || pane?.live === false ? html`<span class="metadata">${pane.hibernated ? this.t('hibernated') : ''} ${pane.orphan ? this.t('orphan') : ''} ${pane.live === false ? this.t('not_live') : ''}</span>` : nothing}
        </span>
        <span class="status" data-status=${agent.status}><span class="dot" aria-hidden="true"></span>${statusLabel}</span>
        <span class="chevron" aria-hidden="true">${open ? '⌄' : '›'}</span>
      </button>
      <dl id=${detailId} ?hidden=${!open}>${open ? details.map(([label, value]) => html`<dt>${label}</dt><dd>${value ?? this.t('not_reported')}</dd>`) : nothing}</dl>
    </li>`;
  }
  private renderTab(view: TabView, host: HostView) {
    const visible = filterAgents(view.agents, this.config!);
    if (view.agents.length && !visible.length) return nothing;
    if (!view.agents.length && (this.config?.statuses && !this.config.statuses.includes('unknown')
      || this.config?.agent_types?.length && (!view.tab.detected_agent || !this.config.agent_types.includes(view.tab.detected_agent)))) return nothing;
    const selected = selectRepresentative(visible);
    return html`<li class="tab-group" data-tab=${view.tab.tab_id}>
      <div class="group-head"><h3>${view.tab.name ?? view.tab.label ?? `${this.t('tab')} ${view.tab.ordinal ?? view.tab.tab_id}`}</h3>
        ${selected ? html`<span>${selected.agent} · ${this.t(selected.status)}${selected.inferred ? ` (${this.t('inferred')})` : ''}</span>` : view.tab.detected_agent ? html`<span>${view.tab.detected_agent} · ${this.t('unknown')} · ${this.t('detected_only')}</span>` : nothing}
        ${view.tab.hibernated ? html`<span>${this.t('hibernated')}</span>` : nothing}
        ${view.tab.group_name ? html`<span>${view.tab.group_name}</span>` : nothing}
        ${!view.tab.name && view.tab.label ? html`<span>${this.t('derived')}</span>` : nothing}
      </div>
      ${visible.length ? html`<ul>${repeat(visible, agent => agent.identity, agent => this.renderAgent(agent, host))}</ul>` : nothing}
    </li>`;
  }
  private renderInventoryRemainder(host: HostView) {
    const orphanPanes = host.inventory?.panes.filter(pane => pane.orphan && !host.agents.some(agent => agent.pane_id === pane.pane_id)) ?? [];
    return orphanPanes.length ? html`<ul class="inventory-panes">${repeat(orphanPanes, pane => pane.pane_id, pane => html`<li class="notice">${this.t('orphan')} · ${this.t('pane')} ${pane.pane_id} · ${this.t('unknown')}${pane.live === null ? '' : ` · ${this.t(pane.live ? 'live' : 'not_live')}`}${pane.hibernated ? ` · ${this.t('hibernated')}` : ''}</li>`)}</ul>` : nothing;
  }
  private renderRows(host: HostView) {
    const agents = filterAgents(host.agents, this.config!);
    if (this.config?.group_by === 'workspace' && host.inventory) {
      const workspaces = workspaceViews(host);
      const unmatchedTabs = tabViews(host).filter(tab => !host.inventory!.workspaces.some(workspace => workspace.workspace_id === tab.tab.workspace_id));
      return html`${repeat(workspaces, view => view.identity, view => html`<div class="workspace-group" data-workspace=${view.workspace.workspace_id}>
        <h3 class="workspace-title">${view.workspace.name ?? `${this.t('workspace')} ${view.workspace.workspace_id}`}</h3><ul>${repeat(view.tabs, tab => tab.identity, tab => this.renderTab(tab, host))}</ul></div>`)}
        ${unmatchedTabs.length ? html`<ul>${repeat(unmatchedTabs, tab => tab.identity, tab => this.renderTab(tab, host))}</ul>` : nothing}
        <ul>${repeat(agents.filter(agent => !tabForPane(host.inventory, agent.pane_id)), agent => agent.identity, agent => this.renderAgent(agent, host))}</ul>${this.renderInventoryRemainder(host)}`;
    }
    if (this.config?.group_by === 'tab' && host.inventory) return html`<ul>${repeat(tabViews(host), tab => tab.identity, tab => this.renderTab(tab, host))}
      ${repeat(agents.filter(agent => !tabForPane(host.inventory, agent.pane_id)), agent => agent.identity, agent => this.renderAgent(agent, host))}</ul>${this.renderInventoryRemainder(host)}`;
    return html`<ul>${repeat(agents, agent => agent.identity, agent => this.renderAgent(agent, host))}
      ${repeat(tabViews(host).filter(tab => !tab.agents.length), tab => tab.identity, tab => this.renderTab(tab, host))}</ul>${this.renderInventoryRemainder(host)}`;
  }
  private renderHost(host: HostView) {
    const filtered = filterAgents(host.agents, this.config!);
    const confirmed = Object.values(host.confirmedCounts).reduce((sum, count) => sum + count, 0);
    const noticeKey = `notice_${host.state}` as MessageKey;
    return html`<section aria-label=${host.config.name}>
      <div class="host-head"><div class="host-title"><h2>${host.config.name}</h2><span class="host-state" data-state=${host.state} role="status">${this.t(host.state)}</span></div>
        <p class="receipt">${host.lastContact === null ? this.t('no_receipt') : html`${this.t('last_contact')}: <time datetime=${host.lastContact}>${formatTimestamp(host.lastContact, this.currentHass)}</time>`}</p>
        ${host.lastKnown && host.lastSuccess !== null ? html`<p class="receipt">${this.t('last_success')}: <time datetime=${host.lastSuccess}>${formatTimestamp(host.lastSuccess, this.currentHass)}</time></p>` : nothing}
        ${this.config?.show_summary !== false ? html`<p class="summary">${host.agents.length} ${this.t('reported')} · ${confirmed} ${this.t('confirmed')} · ${host.inferredCount} ${this.t('inferred')} · ${host.weakCount} ${this.t('weak')} · ${host.unknownOriginCount} ${this.t('unknown_origin')}
          ${host.inventory ? html`<br>${host.inventory.workspaces.length} ${this.t('workspaces')} · ${host.inventory.tabs.length} ${this.t('tabs')} · ${host.inventory.panes.length} ${this.t('panes')}` : nothing}</p>` : nothing}
        <p class="filtered-count">${filtered.length} / ${host.agents.length} ${this.t('filtered')}</p>
      </div>
      ${host.state !== 'healthy' ? html`<p class="notice">${this.t(noticeKey)}${host.errorCode ? html` ${this.t(host.errorCode)}.` : nothing}</p>` : nothing}
      <p class="notice inventory-state" data-inventory-state=${host.inventoryState}>${this.t(`inventory_${host.inventoryState}`)}${host.inventoryErrorCode ? html` · ${this.t(host.inventoryErrorCode)}` : nothing}${host.inventory && !host.inventory.consistent ? html` · ${this.t('inventory_pending')}` : nothing}</p>
      ${host.inventoryLastContact ? html`<p class="notice">${this.t('inventory_contact')}: <time datetime=${host.inventoryLastContact}>${formatTimestamp(host.inventoryLastContact, this.currentHass)}</time></p>` : nothing}
      ${host.inventoryLastSuccess && host.inventoryState !== 'healthy' ? html`<p class="notice">${this.t('inventory_success')}: <time datetime=${host.inventoryLastSuccess}>${formatTimestamp(host.inventoryLastSuccess, this.currentHass)}</time></p>` : nothing}
      ${this.renderRows(host)}
      ${host.source ? html`<details class="source"><summary>${this.t('source')}</summary><dl>
        ${([
          ['status', this.t(host.source.state === 'available' ? 'source_available' : 'source_unavailable')], ['collector_version', host.source.collector_version], ['tty7_build', host.source.tty7_build],
          ['control_version', host.source.control_version], ['protocol_version', host.source.protocol_version], ['uptime', host.source.uptime_secs],
        ] as [MessageKey, string | number | null][]).map(([key, value]) => html`<dt>${this.t(key)}</dt><dd>${value ?? this.t('not_reported')}</dd>`)}
        <dt>${this.t('model')}</dt><dd>${this.t('capability_unknown')}</dd></dl></details>` : nothing}
    </section>`;
  }
  protected override render() {
    if (!this.config) return html`<ha-card><p class="configuration"><strong>${this.t(this.configurationError ? 'configuration_error' : 'not_configured')}</strong><br>${this.t('configuration_help')}</p></ha-card>`;
    if (!this.config.hosts.length) return html`<ha-card><p class="configuration"><strong>${this.t('no_hosts')}</strong><br>${this.t('setup_help')}</p></ha-card>`;
    const hosts = this.config.hosts.map(host => deriveHostView(host, this.currentHass?.states ?? {}, this.currentHass?.connection?.connected ?? true));
    const identities = new Set(hosts.flatMap(host => host.agents.map(agent => agent.identity)));
    for (const identity of this.expanded) if (!identities.has(identity)) this.expanded.delete(identity);
    const native = this.config.appearance === 'home-assistant';
    return html`<ha-card .header=${native ? this.config.title ?? this.t('title') : undefined}>
      ${!native || hosts.length > 1 ? html`<header>${native ? nothing : html`<h1>${this.config.title ?? this.t('title')}</h1>`}
        ${hosts.length > 1 ? html`<label>${this.t('show_host')}<select aria-label=${this.t('show_host')} .value=${this.selectedHost}
          @change=${(event: Event) => { this.selectedHost = (event.target as HTMLSelectElement).value; this.requestUpdate(); }}>
          <option value="">${this.t('all_hosts')}</option>${this.config.hosts.map(host => html`<option value=${host.roster_entity}>${host.name}</option>`)}</select></label>` : nothing}</header>` : nothing}
      ${repeat(hosts.filter(host => !this.selectedHost || host.config.roster_entity === this.selectedHost), host => host.config.roster_entity, host => this.renderHost(host))}
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
