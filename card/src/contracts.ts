export const STATUSES = ['idle', 'working', 'waiting', 'done', 'unknown'] as const;
export type AgentStatus = (typeof STATUSES)[number];
export const OMP_STATES = ['ready', 'missing', 'stale', 'invalid', 'conflict', 'unsupported'] as const;
export interface OmpSource {
  state: (typeof OMP_STATES)[number];
  run_id: string | null;
  background_jobs: number | null;
  outcome?: 'completed' | 'failed' | 'cancelled' | null;
  input_id?: string | null;
}
export const DEFAULT_STATUSES: readonly AgentStatus[] = ['idle', 'working', 'waiting', 'done'];
export const INFORMATION_OPTIONS = [
  'show_last_contact', 'show_last_success', 'show_summary', 'show_inventory_summary', 'show_filtered_count',
  'show_inventory_status', 'show_inventory_last_contact', 'show_inventory_last_success', 'show_agent_type',
  'show_pane_id', 'show_model', 'show_effort', 'show_session_id', 'show_derived_label', 'show_lifecycle', 'show_group_name',
] as const;
export type InformationOption = (typeof INFORMATION_OPTIONS)[number];
export const ERROR_CODES = ['cli_unavailable', 'cli_timeout', 'cli_failed', 'invalid_payload', 'payload_too_large'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface HostConfig {
  name: string;
  roster_entity: string;
  connectivity_entity: string;
}
export interface CardConfig extends Partial<Record<InformationOption, boolean>> {
  type: 'custom:ha-tty7-card';
  hosts: HostConfig[];
  title?: string;
  appearance?: 'tty7' | 'home-assistant';
  group_by?: 'host' | 'workspace' | 'tab';
  statuses?: AgentStatus[];
  agent_types?: string[];
  include_inferred?: boolean;
}
export interface HassEntity {
  state: string;
  attributes: Record<string, unknown>;
}
export type HassStates = Record<string, HassEntity | undefined>;
// Supported frontend registry display shape; no config-entry options or pairing data.
export interface EntityRegistryEntry {
  entity_id: string;
  platform?: string;
  device_id?: string;
  hidden?: boolean;
  translation_key?: string;
}
export interface DeviceRegistryEntry {
  id: string;
  identifiers: [string, string][];
  config_entries: string[];
  name: string | null;
  name_by_user: string | null;
  disabled_by: string | null;
}
// Profile preferences from supported HA frontend 20260930.2 FrontendLocaleData.
export interface HassLocale {
  language: string;
  number_format: string;
  time_format: 'language' | 'system' | '12' | '24';
  date_format: 'language' | 'system' | 'DMY' | 'MDY' | 'YMD';
  first_weekday: string;
  time_zone: 'local' | 'server';
}
export interface HomeAssistant {
  states: HassStates;
  connection?: { connected: boolean };
  themes?: { darkMode?: boolean };
  entities?: Record<string, EntityRegistryEntry>;
  devices?: Record<string, DeviceRegistryEntry>;
  locale?: HassLocale;
  config?: { time_zone: string };
}
export interface AgentRecord {
  pane_id: number;
  session_id: string | null;
  agent: string;
  status: AgentStatus;
  inferred?: boolean;
  rich?: boolean;
  omp?: OmpSource;
  activity: number | null;
  turns: number | null;
  model: string | null;
  effort: string | null;
  permission_mode: string | null;
}
export interface AgentView extends AgentRecord { identity: string }
export type Counts = Record<AgentStatus, number>;
export interface RosterAttributes {
  schema_version: 1;
  agents: AgentRecord[];
  counts: Counts;
  collector_ok: boolean;
  error_code: ErrorCode | null;
  last_contact: string | null;
  last_success: string | null;
  baseline_ready: boolean;
  confirmed_counts?: Counts;
  inferred_count?: number;
  weak_count?: number;
  unknown_origin_count?: number;
  inventory?: InventorySnapshot | null;
  inventory_state?: InventoryState;
  inventory_last_contact?: string | null;
  inventory_last_success?: string | null;
  inventory_error_code?: ErrorCode | null;
}
export interface WorkspaceRecord { workspace_id: string; name: string | null; tab_count: number; pane_count: number }
export interface TabRecord {
  workspace_id: string; tab_id: string; ordinal: number | null; name: string | null; label: string | null;
  detected_agent: string | null; pane_ids: number[]; group_id: string | null; group_name: string | null; hibernated: boolean;
}
export interface PaneRecord {
  pane_id: number; workspace_id: string | null; tab_id: string | null; live: boolean | null; hibernated: boolean; orphan: boolean;
}
export interface InventorySnapshot {
  kind: 'snapshot'; sample_id: string; workspaces: WorkspaceRecord[]; tabs: TabRecord[]; panes: PaneRecord[];
  consistent: boolean; names_included: boolean; derived_labels_included: boolean;
}
export type InventoryState = 'disabled' | 'unconfirmed' | 'healthy' | 'error' | 'stale';
export type ReportOrigin = 'inferred' | 'structured_hook' | 'weak_report' | 'unknown';
export interface TabView {
  identity: string; tab: TabRecord; agents: AgentView[]; representative: AgentView | null;
}
export interface WorkspaceView { identity: string; workspace: WorkspaceRecord; tabs: TabView[] }
export type HostState = 'loading' | 'healthy' | 'empty' | 'error' | 'stale' | 'unconfirmed' | 'malformed' | 'disconnected' | 'offline';
export interface HostView {
  config: HostConfig;
  state: HostState;
  agents: AgentView[];
  counts: Counts;
  lastContact: string | null;
  lastSuccess: string | null;
  errorCode: ErrorCode | null;
  lastKnown: boolean;
  confirmedCounts: Counts;
  inferredCount: number;
  weakCount: number;
  unknownOriginCount: number;
  inventory: InventorySnapshot | null;
  inventoryState: InventoryState;
  inventoryLastContact: string | null;
  inventoryLastSuccess: string | null;
  inventoryErrorCode: ErrorCode | null;
}
