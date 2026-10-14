import { expect, test } from '@playwright/test';
import { HOSTILE } from '../dev/fixtures';

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
