import { ERROR_CODES, INFORMATION_OPTIONS, OMP_STATES, STATUSES } from './contracts';
import type { AgentRecord, AgentStatus, CardConfig, Counts, ErrorCode, HassStates, HostConfig, HostView, OmpSource } from './contracts';
import { parseInventory, origin } from './inventory';

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
  const fail = () => { throw new Error('Configure host labels, unique sensor rosters, and binary_sensor connectivity entities.'); };
  if (!object(value) || value.type !== 'custom:ha-tty7-card' || !Array.isArray(value.hosts)
    || value.hosts.length > 64
    || Object.keys(value).some(key => !['type', 'hosts', 'title', 'appearance', 'group_by', ...INFORMATION_OPTIONS, 'statuses', 'agent_types', 'include_inferred'].includes(key))) return fail();
  if (Object.hasOwn(value, 'title') && (!boundedString(value.title, 128) || !value.title.trim())) return fail();
  if (Object.hasOwn(value, 'appearance') && !['tty7', 'home-assistant'].includes(value.appearance as string)) return fail();
  if (Object.hasOwn(value, 'group_by') && !['host', 'workspace', 'tab'].includes(value.group_by as string)) return fail();
  for (const key of [...INFORMATION_OPTIONS, 'include_inferred']) {
    if (Object.hasOwn(value, key) && typeof value[key] !== 'boolean') return fail();
  }
  if (Object.hasOwn(value, 'statuses') && (!Array.isArray(value.statuses) || value.statuses.length > 5
    || value.statuses.some(status => !STATUSES.includes(status as AgentStatus)) || new Set(value.statuses).size !== value.statuses.length)) return fail();
  if (Object.hasOwn(value, 'agent_types') && (!Array.isArray(value.agent_types) || value.agent_types.length > 256
    || value.agent_types.some(agent => !boundedString(agent, 64)) || new Set(value.agent_types).size !== value.agent_types.length)) return fail();
  const entities = new Set<string>();
  const hosts: HostConfig[] = [];
  for (const host of value.hosts) {
    if (!object(host) || Object.keys(host).some(key => !['name', 'roster_entity', 'connectivity_entity'].includes(key))
      || !boundedString(host.name, 128) || !host.name.trim() || typeof host.roster_entity !== 'string' || typeof host.connectivity_entity !== 'string'
      || !/^sensor\.[a-z0-9_]+$/.test(host.roster_entity) || !/^binary_sensor\.[a-z0-9_]+$/.test(host.connectivity_entity)
      || entities.has(host.roster_entity) || entities.has(host.connectivity_entity)) return fail();
    entities.add(host.roster_entity);
    entities.add(host.connectivity_entity);
    hosts.push({ name: host.name.trim(), roster_entity: host.roster_entity, connectivity_entity: host.connectivity_entity });
  }
  const information: Pick<CardConfig, (typeof INFORMATION_OPTIONS)[number]> = {};
  for (const key of INFORMATION_OPTIONS) if (Object.hasOwn(value, key)) information[key] = value[key] as boolean;
  return {
    type: 'custom:ha-tty7-card', hosts,
    ...(Object.hasOwn(value, 'title') ? { title: (value.title as string).trim() } : {}),
    ...(Object.hasOwn(value, 'appearance') ? { appearance: value.appearance as CardConfig['appearance'] & string } : {}),
    ...(Object.hasOwn(value, 'group_by') ? { group_by: value.group_by as NonNullable<CardConfig['group_by']> } : {}),
    ...information,
    ...(Object.hasOwn(value, 'include_inferred') ? { include_inferred: value.include_inferred as boolean } : {}),
    ...(Object.hasOwn(value, 'statuses') ? { statuses: [...value.statuses as AgentStatus[]] } : {}),
    ...(Object.hasOwn(value, 'agent_types') ? { agent_types: [...value.agent_types as string[]] } : {}),
  };
}

function parseOmp(value: unknown): OmpSource | null {
  if (!object(value) || Object.keys(value).some(key => !['state', 'run_id', 'background_jobs', 'outcome', 'input_id'].includes(key))
    || !Object.hasOwn(value, 'state') || !Object.hasOwn(value, 'run_id') || !Object.hasOwn(value, 'background_jobs')
    || !OMP_STATES.includes(value.state as OmpSource['state'])
    || (value.run_id !== null && !boundedString(value.run_id, 128))
    || (value.background_jobs !== null && !safeNumber(value.background_jobs))
    || (Object.hasOwn(value, 'outcome') && value.outcome !== null && !['completed', 'failed', 'cancelled'].includes(value.outcome as string))
    || (Object.hasOwn(value, 'input_id') && value.input_id !== null && !boundedString(value.input_id, 128))) return null;
  return { state: value.state as OmpSource['state'], run_id: value.run_id as string | null,
    background_jobs: value.background_jobs as number | null,
    ...(Object.hasOwn(value, 'outcome') ? { outcome: value.outcome as Exclude<OmpSource['outcome'], undefined> } : {}),
    ...(Object.hasOwn(value, 'input_id') ? { input_id: value.input_id as string | null } : {}) };
}

function parseAgent(value: unknown): AgentRecord | null {
  if (!object(value) || !safeNumber(value.pane_id) || value.pane_id === 0 || !boundedString(value.agent, 64)) return null;
  if (Object.hasOwn(value, 'inferred') && typeof value.inferred !== 'boolean') return null;
  if (Object.hasOwn(value, 'rich') && typeof value.rich !== 'boolean') return null;
  for (const key of ['session_id', 'model', 'effort', 'permission_mode']) {
    if (key === 'effort' && value[key] === '') continue;
    if (value[key] !== undefined && value[key] !== null && !boundedString(value[key], 128)) return null;
  }
  for (const key of ['activity', 'turns']) {
    if (value[key] !== undefined && value[key] !== null && !safeNumber(value[key])) return null;
  }
  let omp: OmpSource | undefined;
  if (Object.hasOwn(value, 'omp')) {
    const parsed = parseOmp(value.omp);
    if (!parsed || value.agent !== 'OhMyPi' || !STATUSES.includes(value.status as AgentStatus)
      || value.activity !== null || value.turns !== null) return null;
    if (parsed.state === 'ready') {
      if (value.rich !== true || value.inferred === true || !boundedString(value.session_id, 128)
        || parsed.background_jobs === null) return null;
    } else if (value.status !== 'unknown' || value.session_id !== null
      || value.rich !== false || value.inferred === true
      || parsed.run_id !== null || parsed.background_jobs !== null || parsed.outcome != null || parsed.input_id != null) return null;
    if (parsed.outcome != null && (value.status !== 'done' || parsed.run_id === null
      || parsed.background_jobs !== 0 || parsed.input_id != null)) return null;
    if (parsed.input_id != null && (value.status !== 'waiting' || parsed.run_id === null || parsed.outcome != null)) return null;
    omp = parsed;
  }
  // Reconstruct an allowlist. Unknown attributes, including action/icon URLs, never reach rendering.
  return {
    pane_id: value.pane_id,
    agent: value.agent,
    session_id: (value.session_id as string | null | undefined) ?? null,
    status: STATUSES.includes(value.status as AgentStatus) ? value.status as AgentStatus : 'unknown',
    ...(value.inferred === true ? { inferred: true } : {}),
    ...(typeof value.rich === 'boolean' ? { rich: value.rich } : {}),
    ...(omp ? { omp } : {}),
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
    lastContact: null, lastSuccess: null, errorCode: null, lastKnown: true,
    confirmedCounts: { idle: 0, working: 0, waiting: 0, done: 0, unknown: 0 },
    inferredCount: 0, weakCount: 0, unknownOriginCount: 0, inventory: null, inventoryState: 'disabled',
    inventoryLastContact: null, inventoryLastSuccess: null, inventoryErrorCode: null };
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
  for (const agent of agents) {
    const reportOrigin = origin(agent);
    if (reportOrigin === 'structured_hook') result.confirmedCounts[agent.status]++;
    else if (reportOrigin === 'inferred') result.inferredCount++;
    else if (reportOrigin === 'weak_report') result.weakCount++;
    else result.unknownOriginCount++;
  }
  result.inventoryState = ['disabled', 'unconfirmed', 'healthy', 'error', 'stale'].includes(attrs.inventory_state as string)
    ? attrs.inventory_state as HostView['inventoryState'] : attrs.inventory === undefined ? 'disabled' : 'unconfirmed';
  if (result.inventoryState !== 'disabled') result.inventory = parseInventory(attrs.inventory);
  if (!result.inventory && result.inventoryState === 'healthy') result.inventoryState = 'unconfirmed';
  result.inventoryLastContact = typeof attrs.inventory_last_contact === 'string' && Number.isFinite(timestamp(attrs.inventory_last_contact)) ? attrs.inventory_last_contact : null;
  result.inventoryLastSuccess = typeof attrs.inventory_last_success === 'string' && Number.isFinite(timestamp(attrs.inventory_last_success)) ? attrs.inventory_last_success : null;
  result.inventoryErrorCode = ERROR_CODES.includes(attrs.inventory_error_code as ErrorCode) ? attrs.inventory_error_code as ErrorCode : null;
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
