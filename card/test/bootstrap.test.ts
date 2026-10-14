import { expect, it, vi } from 'vitest';
import { registryFixture } from '../dev/editor-fixtures';

it('keeps the runtime card and editor discoverable after HA replaces its startup registry', async () => {
  const nativeRegistry = window.customElements;
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'customElements')!;
  const nativeWhenDefined = nativeRegistry.whenDefined.bind(nativeRegistry);
  const root = document.createElement('home-assistant');
  document.body.append(root);
  let enteredReadiness!: () => void;
  const readiness = new Promise<void>(resolve => { enteredReadiness = resolve; });
  const readinessSpy = vi.spyOn(nativeRegistry, 'whenDefined').mockImplementation(name => {
    if (name === 'home-assistant') enteredReadiness();
    return nativeWhenDefined(name);
  });
  let card: HTMLElement | undefined;
  try {
    // Intentional dynamic import: this tests the integration's early-module loading boundary,
    // before HA's app replaces the global native registry with its scoped registry.
    const loaded = import('../src/ha-tty7-card');
    expect(await Promise.race([
      loaded.then(() => 'registered-before-app'),
      readiness.then(() => 'waiting-for-app'),
    ])).toBe('waiting-for-app');

    // Narrow dependency adapter for the observed scoped-registry boundary: it cannot see
    // definitions made in the old registry, but forwards new definitions to the browser.
    const definitions = new Map<string, CustomElementConstructor>();
    const scopedRegistry = new Proxy(nativeRegistry, { get(target, property) {
      if (property === 'get') return (name: string) => definitions.get(name);
      if (property === 'define') return (name: string, constructor: CustomElementConstructor) => {
        nativeRegistry.define(name, constructor);
        definitions.set(name, constructor);
      };
      if (property === 'whenDefined') return nativeWhenDefined;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    Object.defineProperty(window, 'customElements', { configurable: true, value: scopedRegistry });
    nativeRegistry.define('home-assistant', class extends HTMLElement {});
    const { HaTty7Card } = await loaded;
    // Consume the active registry exactly as HA's card/editor loader does; do not fall back
    // to document.createElement, which can hide a registration left in the old registry.
    const RuntimeCard = customElements.get('ha-tty7-card');
    const Editor = customElements.get('ha-tty7-card-editor');
    expect(RuntimeCard).toBeDefined();
    expect(Editor).toBeDefined();
    const runtimeCard = new RuntimeCard!() as InstanceType<typeof HaTty7Card>;
    card = runtimeCard;
    runtimeCard.setConfig(HaTty7Card.getStubConfig(registryFixture()));
    runtimeCard.hass = registryFixture();
    document.body.append(runtimeCard);
    await runtimeCard.updateComplete;
    expect(runtimeCard.shadowRoot!.querySelectorAll('section')).toHaveLength(2);
    expect(runtimeCard.shadowRoot!.textContent).toContain('Desktop');
    expect(runtimeCard.shadowRoot!.textContent).toContain('Laptop');
    expect((await HaTty7Card.getConfigElement()).constructor).toBe(Editor);
  } finally {
    card?.remove();
    root.remove();
    readinessSpy.mockRestore();
    Object.defineProperty(window, 'customElements', originalDescriptor);
  }
});
