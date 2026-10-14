import type { HomeAssistant, HostConfig } from './contracts';

/** Discover only integration-owned pairs; never inspect or infer from entity state attributes. */
export function discoverHosts(hass: HomeAssistant | undefined): HostConfig[] {
  if (!hass?.entities || !hass.devices) return [];
  const pairs = new Map<string, { rosters: string[]; connectivity: string[] }>();
  for (const entity of Object.values(hass.entities)) {
    if (entity.platform !== 'ha_tty7' || !entity.device_id || entity.hidden) continue;
    const device = hass.devices[entity.device_id];
    if (!device || device.disabled_by || !device.config_entries.length
      || !device.identifiers.some(([domain, hostId]) => domain === 'ha_tty7' && hostId.length > 0)) continue;
    const pair = pairs.get(device.id) ?? { rosters: [], connectivity: [] };
    if (/^sensor\.[a-z0-9_]+$/.test(entity.entity_id)) pair.rosters.push(entity.entity_id);
    else if (/^binary_sensor\.[a-z0-9_]+$/.test(entity.entity_id)) pair.connectivity.push(entity.entity_id);
    else continue;
    pairs.set(device.id, pair);
  }
  const hosts: HostConfig[] = [];
  const usedNames = new Set<string>();
  for (const [deviceId, pair] of pairs) {
    if (pair.rosters.length !== 1 || pair.connectivity.length !== 1 || hosts.length === 64) continue;
    const device = hass.devices[deviceId]!;
    const label = (device.name_by_user || device.name)?.trim();
    if (!label || Array.from(label).length > 128) continue;
    // Duplicate device labels need distinct dashboard labels, not silently invalid stub configs.
    let name = label;
    let number = 2;
    while (usedNames.has(name)) name = `${Array.from(label).slice(0, 120).join('')} (${number++})`;
    usedNames.add(name);
    hosts.push({ name, roster_entity: pair.rosters[0]!, connectivity_entity: pair.connectivity[0]! });
  }
  return hosts;
}
