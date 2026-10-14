export const STATUSES = ['idle', 'working', 'waiting', 'done', 'unknown'] as const;
export type AgentStatus = (typeof STATUSES)[number];
export const ERROR_CODES = ['cli_unavailable', 'cli_timeout', 'cli_failed', 'invalid_payload', 'payload_too_large'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface HostConfig {
  name: string;
  roster_entity: string;
  connectivity_entity: string;
}
export interface CardConfig {
  type: 'custom:ha-tty7-card';
  hosts: HostConfig[];
  title?: string;
  appearance?: 'tty7' | 'home-assistant';
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
}
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
}
