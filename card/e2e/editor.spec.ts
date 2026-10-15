import { expect, test } from '@playwright/test';
import { hostConfigs } from '../dev/fixtures';

// Real Chromium exercises the editor and runtime card. This local selector boundary
// fixture is not proof of HA's selector implementation or HACS installation.
test('host selection and labels roundtrip into the live card with keyboard and touch', async ({ page }, testInfo) => {
  await page.goto('/?editor&config=empty');
  const editor = page.locator('ha-tty7-card-editor');
  const saved = page.locator('#saved-config');
  const card = page.locator('ha-tty7-card');
  const add = editor.getByRole('button', { name: 'Add host', exact: true });
  await add.focus();
  await page.keyboard.press('Enter');
  const host = editor.getByRole('combobox', { name: 'HA-tty7 host 1' });
  await host.selectOption(hostConfigs[0]!.roster_entity);
  const label = editor.getByRole('textbox', { name: 'Dashboard label 1' });
  await label.fill('');
  await label.pressSequentially('My workstation');
  await expect(label).toBeFocused();
  await expect(saved).toHaveText(JSON.stringify({ type: 'custom:ha-tty7-card', hosts: [{ ...hostConfigs[0], name: 'My workstation' }] }));
  await expect(card.getByRole('heading', { name: 'My workstation', exact: true })).toBeVisible();
  await expect(card.getByRole('heading', { name: 'Laptop', exact: true })).toHaveCount(0);
  if (testInfo.project.name === 'android-width') await add.tap();
  else await add.click();
  const second = editor.getByRole('combobox', { name: 'HA-tty7 host 2' });
  await second.selectOption(hostConfigs[1]!.roster_entity);
  await expect(card.getByRole('heading', { name: 'Laptop', exact: true })).toBeVisible();
  // Existing selected hosts cannot accidentally be added twice; unrelated integrations never appear.
  await expect(second.locator('option')).toHaveCount(2);
  await expect(editor.locator('option').filter({ hasText: 'Unrelated host' })).toHaveCount(0);
  await expect(saved).not.toContainText('PRIVATE_PAIRING_FIXTURE');
  const remove = editor.getByRole('button', { name: 'Remove host 2', exact: true });
  await remove.focus();
  await page.keyboard.press('Space');
  await expect(card.getByRole('heading', { name: 'Laptop', exact: true })).toHaveCount(0);
  await expect(saved).toHaveText(JSON.stringify({ type: 'custom:ha-tty7-card', hosts: [{ ...hostConfigs[0], name: 'My workstation' }] }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const target of await editor.locator('button,input,select').all()) {
    const bounds = await target.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
});

test('missing integration has actionable setup and no fictional configured entities', async ({ page }) => {
  await page.goto('/?editor&integration=missing');
  const editor = page.locator('ha-tty7-card-editor');
  await expect(editor.getByRole('link')).toHaveAttribute('href', '/config/integrations');
  await editor.getByRole('button', { name: 'Add host', exact: true }).click();
  await expect(page.locator('ha-tty7-card').locator('section')).toHaveCount(0);
});

test('host labels remain inert text in editor and card', async ({ page }) => {
  await page.goto('/?editor');
  const editor = page.locator('ha-tty7-card-editor');
  await editor.getByRole('textbox', { name: 'Dashboard label 1' }).fill('<img src=x onerror="window.__injected=true">');
  await expect(page.locator('ha-tty7-card').getByRole('heading', { name: '<img src=x onerror="window.__injected=true">', exact: true })).toBeVisible();
  await expect(editor.locator('img,script,iframe')).toHaveCount(0);
  await expect(page.locator('ha-tty7-card').locator('img,script,iframe')).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, '__injected'))).toBe(false);
});

test('native control consumer settings survive config echoes and filter the live preview', async ({ page }) => {
  await page.goto('/?editor');
  const editor = page.locator('ha-tty7-card-editor');
  const card = page.locator('ha-tty7-card');
  const saved = page.locator('#saved-config');
  await expect(card.locator('.metadata, .identity, .summary, .receipt')).toHaveCount(0);
  await editor.getByRole('checkbox', { name: 'Show model', exact: true }).check();
  await expect(card.locator('.metadata').first()).toContainText('demo-model');
  await editor.getByRole('listbox', { name: 'Statuses', exact: true }).selectOption(['unknown']);
  await expect(card.locator('.agent-row')).toHaveCount(1);
  await expect(saved).toContainText('"statuses":["unknown"]');
  await editor.getByRole('listbox', { name: 'Statuses', exact: true }).selectOption(['working']);
  await editor.getByRole('textbox', { name: 'Agent types: add type', exact: true }).fill('OhMyPi');
  await editor.getByRole('textbox', { name: 'Agent types: add type', exact: true }).press('Tab');
  await expect(saved).toContainText('"agent_types":["OhMyPi"]');
  await expect(card.locator('.agent-row')).toHaveCount(1);
  const title = editor.getByRole('textbox', { name: 'Card title (default: tty7 agents)' });
  await title.fill('Compact live preview');
  await expect(saved).toContainText('"show_model":true');
  await expect(saved).toContainText('"agent_types":["OhMyPi"]');
  await expect(title).toBeFocused();
});
