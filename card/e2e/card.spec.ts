import { expect, test } from '@playwright/test';
import { HOSTILE, hostConfigs } from '../dev/fixtures';

test('host isolation, keyboard expansion and identity updates', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('ha-tty7-card');
  await expect(card.getByRole('heading', { name: 'Desktop', exact: true })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Laptop', exact: true })).toBeVisible();
  const row = card.getByRole('button', { name: /OhMyPi, pane 1/ }).first();
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Reorder heartbeat' }).click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await card.getByRole('combobox', { name: 'Show host' }).selectOption('sensor.ha_tty7_laptop_demo_roster');
  await expect(card.getByRole('heading', { name: 'Desktop', exact: true })).toHaveCount(0);
  await card.getByRole('combobox', { name: 'Show host' }).selectOption('');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Replace session' }).click();
  await expect(row).toHaveAttribute('aria-expanded', 'false');
  await row.focus();
  await page.keyboard.press('Space');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(row).toBeFocused();
});

test('structural inventory keeps detection tab-level and preserves metadata through local filters and locale updates', async ({ page }) => {
  await page.goto('/?scenario=inventory');
  await page.evaluate(async hosts => {
    const card = document.querySelector('ha-tty7-card')!;
    card.setConfig({ type: 'custom:ha-tty7-card', hosts, group_by: 'tab', appearance: 'home-assistant',
      statuses: ['idle', 'working', 'waiting', 'done', 'unknown'], show_agent_type: true, show_lifecycle: true, show_effort: true });
    await card.updateComplete;
  }, [hostConfigs[0]!]);
  const card = page.locator('ha-tty7-card');
  const split = card.locator('[data-tab="synthetic-tab-1"]');
  await expect(split.locator('.group-head')).toContainText('ClaudeCode');
  await expect(split.locator('.group-head')).toContainText('Waiting');
  const detected = card.locator('[data-tab="synthetic-tab-2"]');
  await expect(detected).toContainText('Unknown');
  await expect(detected).toContainText('Hibernated');
  await expect(detected.locator('[data-pane]')).toHaveCount(0);
  const row = card.locator('[data-pane="1"]');
  await row.focus(); await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(row).toContainText('None applicable');
  await page.evaluate(async hosts => {
    const card = document.querySelector('ha-tty7-card')!;
    card.setConfig({ type: 'custom:ha-tty7-card', hosts, group_by: 'tab', statuses: ['waiting'], show_summary: true, show_filtered_count: true });
    await card.updateComplete;
  }, [hostConfigs[0]!]);
  await expect(card.locator('.filtered-count')).toContainText('1 / 5');
  await expect(card.locator('.summary')).toContainText('5 reported');
  await page.evaluate(async hosts => {
    const card = document.querySelector('ha-tty7-card')!;
    card.setConfig({ type: 'custom:ha-tty7-card', hosts, group_by: 'tab' });
    card.hass = { ...card.hass!, locale: { language: 'ru', number_format: 'language', time_format: '24', date_format: 'DMY', first_weekday: 'language', time_zone: 'server' } };
    await card.updateComplete;
  }, [hostConfigs[0]!]);
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test('hostile text is inert, long details wrap, and mobile touch targets do not overflow', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?scenario=hostile');
  const card = page.locator('ha-tty7-card');
  const row = card.getByRole('button', { name: /<img src=x/ }).first();
  if (testInfo.project.name === 'android-width') await row.tap();
  else await row.click();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(card.locator('dd').filter({ hasText: HOSTILE }).first()).toBeVisible();
  await expect(card.locator('img, script, iframe, a')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, '__injected'))).toBe(false);
  for (const target of await card.locator('button,select').all()) {
    const size = await target.boundingBox();
    expect(size!.height).toBeGreaterThanOrEqual(44);
    expect(size!.width).toBeGreaterThanOrEqual(44);
  }
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Dark fixture' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const bounds = await card.boundingBox();
    for (const detail of await card.locator('dl:not([hidden]) dd').all()) {
      const detailBounds = await detail.boundingBox();
      expect(detailBounds!.x + detailBounds!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    }
    expect(await row.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  }
});

test('privacy boundary excludes unrelated entities and unwanted fields', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const card = document.querySelector('ha-tty7-card')!;
    const states = card.hass!.states;
    const roster = states['sensor.ha_tty7_desktop_demo_roster']!;
    roster.attributes.message = 'PRIVATE_MESSAGE';
    const agent = (roster.attributes.agents as Record<string, unknown>[])[0]!;
    agent.cwd = 'PRIVATE_DIRECTORY';
    agent.launch_argv = ['PRIVATE_ARGUMENT'];
    agent.icon_url = 'https://invalid.example/PRIVATE_ICON';
    states['sensor.unconfigured'] = { state: '1', attributes: { agents: [{ agent: 'PRIVATE_HOST' }] } };
    card.hass = { states };
    await card.updateComplete;
  });
  const text = await page.locator('ha-tty7-card').evaluate(element => element.shadowRoot!.textContent);
  expect(text).toContain('OhMyPi');
  for (const marker of ['PRIVATE_MESSAGE', 'PRIVATE_DIRECTORY', 'PRIVATE_ARGUMENT', 'PRIVATE_ICON', 'PRIVATE_HOST']) expect(text).not.toContain(marker);
});

test('native appearance leaves surface styling to ha-card and follows live HA theme colors', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const card = document.querySelector('ha-tty7-card')!;
    // A consumer boundary, not a substitute HA implementation: the inner element owns its surface.
    const surface = card.shadowRoot!.querySelector('ha-card')!;
    surface.attachShadow({ mode: 'open' }).innerHTML = `<style>:host {
      background: var(--ha-card-background); border: 3px solid var(--ha-card-border-color);
      box-shadow: var(--ha-card-box-shadow); border-radius: var(--ha-card-border-radius);
      color: var(--primary-text-color);
    }</style><slot></slot>`;
    const theme: Record<string, string> = {
      '--ha-card-background': 'rgb(11, 22, 33)', '--ha-card-border-color': 'rgb(44, 55, 66)',
      '--ha-card-box-shadow': 'rgb(77, 88, 99) 0px 2px 4px', '--ha-card-border-radius': '23px',
      '--primary-text-color': 'rgb(100, 110, 120)', '--secondary-text-color': 'rgb(130, 140, 150)',
      '--divider-color': 'rgb(44, 55, 66)', '--primary-color': 'rgb(160, 170, 180)',
      '--success-color': 'rgb(20, 130, 40)', '--warning-color': 'rgb(150, 120, 20)', '--error-color': 'rgb(190, 30, 40)',
    };
    for (const [key, value] of Object.entries(theme)) card.style.setProperty(key, value);
    const hosts = [...card.shadowRoot!.querySelectorAll('section')].map(section => {
      const name = section.getAttribute('aria-label')!;
      const roster_entity = name === 'Desktop' ? 'sensor.ha_tty7_desktop_demo_roster' : 'sensor.ha_tty7_laptop_demo_roster';
      return { name, roster_entity, connectivity_entity: roster_entity.replace('sensor.', 'binary_sensor.').replace('_roster', '_connectivity') };
    });
    card.setConfig({ type: 'custom:ha-tty7-card', hosts, appearance: 'home-assistant', show_last_contact: true });
    await card.updateComplete;
  });
  const card = page.locator('ha-tty7-card');
  const surface = card.locator('ha-card');
  await expect(surface).toHaveCSS('background-color', 'rgb(11, 22, 33)');
  await expect(surface).toHaveCSS('border-top-width', '3px');
  await expect(surface).toHaveCSS('border-top-color', 'rgb(44, 55, 66)');
  await expect(surface).toHaveCSS('border-radius', '23px');
  await expect(surface).toHaveCSS('box-shadow', 'rgb(77, 88, 99) 0px 2px 4px 0px');
  await expect(card.locator('.agent-name').first()).toHaveCSS('color', 'rgb(100, 110, 120)');
  await expect(card.locator('.receipt').first()).toHaveCSS('color', 'rgb(130, 140, 150)');
  await expect(card.locator('[data-status="working"] .dot').first()).toHaveCSS('background-color', 'rgb(160, 170, 180)');
  await expect(card.locator('[data-status="done"] .dot').first()).toHaveCSS('background-color', 'rgb(20, 130, 40)');
  await expect(card.locator('[data-status="waiting"] .dot').first()).toHaveCSS('background-color', 'rgb(150, 120, 20)');
  await page.evaluate(() => {
    const card = document.querySelector('ha-tty7-card')!;
    card.style.setProperty('--ha-card-background', 'rgb(230, 240, 250)');
    card.style.setProperty('--primary-color', 'rgb(80, 90, 100)');
    card.hass = { ...card.hass!, themes: { darkMode: true } };
  });
  await expect(surface).toHaveCSS('background-color', 'rgb(230, 240, 250)');
  await expect(card.locator('[data-status="working"] .dot').first()).toHaveCSS('background-color', 'rgb(80, 90, 100)');
});

test.describe('HA locale receipt display', () => {
  test.use({ timezoneId: 'America/Los_Angeles', locale: 'en-US' });
  test('reformats both timestamps on profile changes without changing roster data', async ({ page }) => {
    await page.goto('/?scenario=error');
    await page.evaluate(async hosts => {
      const card = document.querySelector('ha-tty7-card')!;
      card.setConfig({ type: 'custom:ha-tty7-card', hosts, show_last_contact: true, show_last_success: true });
      const states = card.hass!.states;
      for (const entity of Object.values(states)) {
        if (!entity || !Object.hasOwn(entity.attributes, 'last_contact')) continue;
        entity.attributes.last_contact = '2026-10-14T23:07:00Z';
        entity.attributes.last_success = '2026-10-14T22:06:00Z';
      }
      card.hass = {
        ...card.hass!, states, config: { time_zone: 'Asia/Tokyo' },
        locale: { language: 'en-US', number_format: 'language', time_format: '12', date_format: 'DMY', first_weekday: 'language', time_zone: 'server' },
      } as typeof card.hass;
      await card.updateComplete;
    }, hostConfigs);
    const times = page.locator('ha-tty7-card section').first().locator('time');
    await expect(times.nth(0)).toHaveText('15/10/2026, 8:07 AM');
    await expect(times.nth(1)).toHaveText('15/10/2026, 7:06 AM');
    await expect(times.nth(0)).toHaveAttribute('datetime', '2026-10-14T23:07:00Z');
    await page.evaluate(async () => {
      const card = document.querySelector('ha-tty7-card')!;
      const hass = card.hass! as typeof card.hass & { locale: { time_format: string; date_format: string; time_zone: string } };
      hass.locale.time_format = '24';
      hass.locale.date_format = 'YMD';
      hass.locale.time_zone = 'local';
      card.hass = hass;
      await card.updateComplete;
    });
    await expect(times.nth(0)).toHaveText('2026/10/14, 16:07');
    await expect(times.nth(1)).toHaveText('2026/10/14, 15:06');
    await page.evaluate(async () => {
      const card = document.querySelector('ha-tty7-card')!;
      const hass = card.hass! as typeof card.hass & { locale: { language: string; time_format: string; date_format: string } };
      hass.locale.language = 'de-DE';
      hass.locale.time_format = 'language';
      hass.locale.date_format = 'language';
      card.hass = hass;
      await card.updateComplete;
    });
    await expect(times.nth(0)).toHaveText('14.10.2026, 16:07');
    await expect(times.nth(1)).toHaveText('14.10.2026, 15:06');
  });
});
