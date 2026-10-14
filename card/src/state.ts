import { ERROR_CODES, STATUSES } from './contracts';
import type { AgentRecord, AgentStatus, CardConfig, Counts, ErrorCode, HassStates, HostConfig, HostView } from './contracts';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function boundedString(value: unknown, limit: number): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  let characters = 0;
  for (let index = 0; index < value.length; index++) {
    const first = value.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(++index);
      if (!(second >= 0xdc00 && second <= 0xdfff)) return false;
    } else if (first >= 0xdc00 && first <= 0xdfff) return false;
    if (++characters > limit) return false;
  }
  return true;
}
function safeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function validateConfig(value: unknown): CardConfig {
  const fail = () => { throw new Error('Configure unique host names, sensor rosters, and binary_sensor connectivity entities.'); };
  if (!object(value) || value.type !== 'custom:ha-tty7-card' || !Array.isArray(value.hosts)
    || value.hosts.length > 64
    || Object.keys(value).some(key => !['type', 'hosts'].includes(key))) return fail();
  const names = new Set<string>();
  const entities = new Set<string>();
  const hosts: HostConfig[] = [];
  for (const host of value.hosts) {
    if (!object(host) || Object.keys(host).some(key => !['name', 'roster_entity', 'connectivity_entity'].includes(key))
      || !boundedString(host.name, 128) || !host.name.trim() || typeof host.roster_entity !== 'string' || typeof host.connectivity_entity !== 'string'
      || !/^sensor\.[a-z0-9_]+$/.test(host.roster_entity) || !/^binary_sensor\.[a-z0-9_]+$/.test(host.connectivity_entity)
      || names.has(host.name.trim()) || entities.has(host.roster_entity) || entities.has(host.connectivity_entity)) return fail();
    names.add(host.name.trim());
    entities.add(host.roster_entity);
    entities.add(host.connectivity_entity);
    hosts.push({ name: host.name.trim(), roster_entity: host.roster_entity, connectivity_entity: host.connectivity_entity });
  }
  return { type: 'custom:ha-tty7-card', hosts };
}

function parseAgent(value: unknown): AgentRecord | null {
  if (!object(value) || !safeNumber(value.pane_id) || value.pane_id === 0 || !boundedString(value.agent, 64)) return null;
  for (const key of ['session_id', 'model', 'effort', 'permission_mode']) {
    if (value[key] !== undefined && value[key] !== null && !boundedString(value[key], 128)) return null;
  }
  for (const key of ['activity', 'turns']) {
    if (value[key] !== undefined && value[key] !== null && !safeNumber(value[key])) return null;
  }
  // Reconstruct an allowlist. Unknown attributes, including action/icon URLs, never reach rendering.
  return {
    pane_id: value.pane_id,
    agent: value.agent,
    session_id: (value.session_id as string | null | undefined) ?? null,
    status: STATUSES.includes(value.status as AgentStatus) ? value.status as AgentStatus : 'unknown',
    activity: (value.activity as number | null | undefined) ?? null,
    turns: (value.turns as number | null | undefined) ?? null,
    model: (value.model as string | null | undefined) ?? null,
    effort: (value.effort as string | null | undefined) ?? null,
    permission_mode: (value.permission_mode as string | null | undefined) ?? null,
  };
}

function timestamp(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  return Date.parse(value);
}

export function deriveHostView(config: HostConfig, states: HassStates, connected: boolean): HostView {
  const counts: Counts = { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0 };
  const result: HostView = { config, state: connected ? 'loading' : 'disconnected', agents: [], counts,
    lastContact: null, lastSuccess: null, errorCode: null, lastKnown: true };
  const roster = states[config.roster_entity];
  const connectivity = states[config.connectivity_entity];
  if (!roster || !connectivity) return result;
  result.state = connected ? 'malformed' : 'disconnected';
  if (!object(roster.attributes)) return result;
  const attrs = roster.attributes;
  if (attrs.schema_version !== 1 || !Array.isArray(attrs.agents) || attrs.agents.length > 256
    || typeof attrs.collector_ok !== 'boolean' || typeof attrs.baseline_ready !== 'boolean' || !object(attrs.counts)
    || !Object.hasOwn(attrs, 'error_code') || !Object.hasOwn(attrs, 'last_contact') || !Object.hasOwn(attrs, 'last_success')) return result;
  const contact = timestamp(attrs.last_contact);
  const success = timestamp(attrs.last_success);
  if ((contact !== null && !Number.isFinite(contact))
    || (success !== null && !Number.isFinite(success))
    || (contact !== null && success !== null && success > contact)
    || (attrs.baseline_ready && (contact === null || success === null))) return result;
  if (attrs.error_code !== null && !ERROR_CODES.includes(attrs.error_code as ErrorCode)) return result;
  if ((attrs.collector_ok && attrs.error_code !== null) || (!attrs.collector_ok && attrs.baseline_ready)) return result;
  const agents: AgentRecord[] = [];
  const panes = new Set<number>();
  for (const value of attrs.agents) {
    const agent = parseAgent(value);
    if (!agent || panes.has(agent.pane_id)) return result;
    panes.add(agent.pane_id);
    agents.push(agent);
    counts[agent.status] += 1;
  }
  const reportedCounts = attrs.counts;
  if (STATUSES.some(status => !safeNumber(reportedCounts[status]) || reportedCounts[status] !== counts[status])) return result;
  result.agents = agents.map(agent => ({ ...agent, identity: JSON.stringify([config.roster_entity, agent.session_id, agent.pane_id]) }));
  result.lastContact = attrs.last_contact as string | null;
  result.lastSuccess = attrs.last_success as string | null;
  result.errorCode = attrs.error_code as ErrorCode | null;
  if (!connected) result.state = 'disconnected';
  else if (['unavailable', 'unknown'].includes(roster.state) || ['unavailable', 'unknown'].includes(connectivity.state)) result.state = 'offline';
  else if (roster.state === 'error') result.state = result.errorCode === null ? 'malformed' : 'error';
  else if (roster.state === 'stale') result.state = 'stale';
  else if (roster.state === 'unconfirmed') result.state = 'unconfirmed';
  else if (result.errorCode !== null || roster.state !== String(agents.length)) result.state = 'malformed';
  else if (!attrs.collector_ok || !attrs.baseline_ready || contact === null || success === null || connectivity.state === 'off') result.state = 'offline';
  else if (connectivity.state !== 'on') result.state = 'malformed';
  else result.state = agents.length === 0 ? 'empty' : 'healthy';
  result.lastKnown = !['healthy', 'empty'].includes(result.state);
  return result;
}
