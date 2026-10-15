import { DEFAULT_STATUSES } from './contracts';
import type { AgentRecord, AgentView, CardConfig, HostView, InventorySnapshot, PaneRecord, ReportOrigin, TabRecord, TabView, WorkspaceRecord, WorkspaceView } from './contracts';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, limit = 128, allowEmpty = false): value is string {
  return typeof value === 'string' && (allowEmpty || value.length > 0) && Array.from(value).length <= limit
    && !/[\u0000-\u001f\u007f-\u009f\ud800-\udfff]/u.test(value);
}
function integer(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function nullableText(value: unknown): value is string | null { return value === null || text(value); }
function displayText(value: unknown, limit = 128): value is string | null { return value === null || text(value, limit, true); }
function nullableInteger(value: unknown): value is number | null { return value === null || integer(value); }
function nullableBoolean(value: unknown): value is boolean | null { return value === null || typeof value === 'boolean'; }

/** Defensive display projection, not a replacement for the authoritative Python wire validator. */
export function parseInventory(value: unknown): InventorySnapshot | null {
  if (!record(value) || value.kind !== 'snapshot' || !text(value.sample_id)
    || typeof value.consistent !== 'boolean' || typeof value.names_included !== 'boolean' || typeof value.derived_labels_included !== 'boolean'
    || !Array.isArray(value.workspaces) || value.workspaces.length > 64 || !Array.isArray(value.tabs) || value.tabs.length > 256
    || !Array.isArray(value.panes) || value.panes.length > 512) return null;
  const names = value.names_included;
  const derived = names && value.derived_labels_included;
  const workspaces: WorkspaceRecord[] = [];
  const tabs: TabRecord[] = [];
  const panes: PaneRecord[] = [];
  const workspaceIds = new Set<string>();
  const tabIds = new Set<string>();
  const paneIds = new Set<number>();
  for (const item of value.workspaces) {
    if (!record(item) || !text(item.workspace_id) || workspaceIds.has(item.workspace_id) || !displayText(item.name)
      || !integer(item.tab_count) || !integer(item.pane_count)) return null;
    workspaceIds.add(item.workspace_id);
    workspaces.push({ workspace_id: item.workspace_id, name: names ? item.name || null : null, tab_count: item.tab_count, pane_count: item.pane_count });
  }
  for (const item of value.tabs) {
    if (!record(item) || !text(item.workspace_id) || !text(item.tab_id) || tabIds.has(item.tab_id)
      || !nullableInteger(item.ordinal) || !displayText(item.name) || !displayText(item.label)
      || !displayText(item.detected_agent, 64) || !nullableText(item.group_id) || !displayText(item.group_name)
      || typeof item.hibernated !== 'boolean' || !Array.isArray(item.pane_ids) || item.pane_ids.length > 512
      || item.pane_ids.some(id => !integer(id) || id === 0) || new Set(item.pane_ids).size !== item.pane_ids.length) return null;
    tabIds.add(item.tab_id);
    tabs.push({ workspace_id: item.workspace_id, tab_id: item.tab_id, ordinal: item.ordinal, name: names ? item.name || null : null,
      label: derived ? item.label || null : null, detected_agent: item.detected_agent || null, pane_ids: [...item.pane_ids as number[]],
      group_id: item.group_id, group_name: names ? item.group_name || null : null, hibernated: item.hibernated });
  }
  for (const item of value.panes) {
    if (!record(item) || !integer(item.pane_id) || item.pane_id === 0 || paneIds.has(item.pane_id)
      || !nullableText(item.workspace_id) || !nullableText(item.tab_id) || !nullableBoolean(item.live)
      || typeof item.hibernated !== 'boolean' || typeof item.orphan !== 'boolean') return null;
    paneIds.add(item.pane_id);
    panes.push({ pane_id: item.pane_id, workspace_id: item.workspace_id, tab_id: item.tab_id, live: item.live, hibernated: item.hibernated, orphan: item.orphan });
  }
  return { kind: 'snapshot', sample_id: value.sample_id, workspaces, tabs, panes, consistent: value.consistent,
    names_included: names, derived_labels_included: derived };
}


export function origin(agent: AgentRecord): ReportOrigin {
  if (agent.inferred === true) return 'inferred';
  if (agent.rich === true) return 'structured_hook';
  if (agent.rich === false) return 'weak_report';
  return 'unknown';
}
export function filterAgents(agents: AgentView[], config: CardConfig): AgentView[] {
  return agents.filter(agent => (config.include_inferred !== false || agent.inferred !== true)
    && (config.statuses ?? DEFAULT_STATUSES).includes(agent.status) && (!config.agent_types?.length || config.agent_types.includes(agent.agent)));
}
/** Join only direct, mutually agreeing membership. Ambiguous cross-query membership stays ungrouped. */
export function tabForPane(inventory: InventorySnapshot | null, paneId: number): TabRecord | null {
  if (!inventory) return null;
  const pane = inventory.panes.find(item => item.pane_id === paneId);
  if (!pane || pane.orphan || !pane.tab_id || !pane.workspace_id) return null;
  let membership: TabRecord | null = null;
  for (const tab of inventory.tabs) {
    if (!tab.pane_ids.includes(paneId)) continue;
    if (membership) return null;
    membership = tab;
  }
  return membership?.tab_id === pane.tab_id && membership.workspace_id === pane.workspace_id ? membership : null;
}
const URGENCY: Record<AgentRecord['status'], number> = { waiting: 0, working: 1, done: 2, unknown: 3, idle: 4 };
export function selectRepresentative(agents: readonly AgentView[]): AgentView | null {
  return agents.reduce<AgentView | null>((best, agent) => !best || URGENCY[agent.status] < URGENCY[best.status] ? agent : best, null);
}
export function tabViews(host: HostView): TabView[] {
  const grouped = new Map<TabRecord, AgentView[]>();
  for (const agent of host.agents) {
    const tab = tabForPane(host.inventory, agent.pane_id);
    if (!tab) continue;
    const agents = grouped.get(tab) ?? [];
    agents.push(agent);
    grouped.set(tab, agents);
  }
  return (host.inventory?.tabs ?? []).map(tab => {
    const agents = grouped.get(tab) ?? [];
    const representative = selectRepresentative(agents);
    return { identity: JSON.stringify([host.config.roster_entity, tab.workspace_id, tab.tab_id]), tab, agents, representative };
  });
}
export function workspaceViews(host: HostView): WorkspaceView[] {
  const tabs = tabViews(host);
  return (host.inventory?.workspaces ?? []).map(workspace => ({ identity: JSON.stringify([host.config.roster_entity, workspace.workspace_id]), workspace,
    tabs: tabs.filter(tab => tab.tab.workspace_id === workspace.workspace_id) }));
}
