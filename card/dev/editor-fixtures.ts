import type { DeviceRegistryEntry, EntityRegistryEntry, HomeAssistant } from '../src/contracts';
import { fixtureStates, hostConfigs } from './fixtures';

/** Synthetic display registries, shaped like Core 2026.10 frontend data (not HA acceptance). */
export function registryFixture(): HomeAssistant {
  const entities: Record<string, EntityRegistryEntry> = {};
  const devices: Record<string, DeviceRegistryEntry> = {};
  for (const [index, host] of hostConfigs.entries()) {
    const id = index === 0 ? 'desktop-device' : 'laptop-device';
    devices[id] = { id, identifiers: [['ha_tty7', `synthetic-host-${index}`]], config_entries: [`entry-${index}`],
      name: host.name, name_by_user: null, disabled_by: null };
    for (const entityId of [host.roster_entity, host.connectivity_entity]) {
      entities[entityId] = { entity_id: entityId, platform: 'ha_tty7', device_id: id };
    }
  }
  devices['unrelated-device'] = { id: 'unrelated-device', identifiers: [['other_integration', 'other-host']],
    config_entries: ['other-entry'], name: 'Unrelated host', name_by_user: null, disabled_by: null };
  entities['sensor.unrelated'] = { entity_id: 'sensor.unrelated', platform: 'other_integration', device_id: 'unrelated-device' };
  entities['binary_sensor.unrelated'] = { entity_id: 'binary_sensor.unrelated', platform: 'other_integration', device_id: 'unrelated-device' };
  entities['sensor.unbound'] = { entity_id: 'sensor.unbound', platform: 'ha_tty7', device_id: 'unrelated-device' };
  entities['binary_sensor.unbound'] = { entity_id: 'binary_sensor.unbound', platform: 'ha_tty7', device_id: 'unrelated-device' };
  const states = fixtureStates('healthy');
  states['sensor.unrelated'] = { state: '1', attributes: { ...states[hostConfigs[0]!.roster_entity]!.attributes, webhook_url: 'PRIVATE_PAIRING_FIXTURE' } };
  return { entities, devices, states, connection: { connected: true } };
}
