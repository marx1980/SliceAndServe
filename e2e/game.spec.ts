import { expect, test, type Page } from '@playwright/test';

type Sas = { state(): { status: string; moveNumber: number; tray: unknown[] }; level(): string };

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sas: Sas }).__sas.state());

/** Convert a logical canvas point to page coordinates using the canvas bounding box. */
async function canvasPoint(page: Page, lx: number, ly: number) {
  const box = await page.locator('#stage canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const dims = await page.evaluate(() => {
    const c = document.querySelector('#stage canvas') as HTMLCanvasElement;
    return { w: c.width, h: c.height };
  });
  // Phaser keeps the canvas at the logical size and scales it with CSS.
  return { x: box.x + (lx / dims.w) * box.width, y: box.y + (ly / dims.h) * box.height };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Clear saves once per test, not on reloads.
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.clear();
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  await page.goto('/');
  await expect(page.locator('#stage canvas')).toBeVisible();
});

test('loads at any width without horizontal scroll and exposes 44px targets', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  for (const id of ['btn-menu', 'btn-undo', 'btn-restart', 'btn-settings']) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('keyboard: select a plate, move cursor, preview and place', async ({ page }) => {
  await page.locator('#stage').focus();
  await page.keyboard.press('1');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#btn-place')).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).moveNumber).toBe(1);
});

test('tap placement with preview confirmation, then undo and restart', async ({ page }) => {
  const dims = await page.evaluate(() => {
    const c = document.querySelector('#stage canvas') as HTMLCanvasElement;
    return { h: c.height };
  });
  // First tray slot is centred in the lower area of the canvas.
  const slot = await canvasPoint(page, 60, dims.h - 62);
  await page.mouse.click(slot.x, slot.y);
  await expect(page.locator('#btn-place')).toBeDisabled();
  // Tap an empty board cell twice: first previews, second confirms.
  const cell = await canvasPoint(page, 180, 100);
  await page.mouse.click(cell.x, cell.y);
  await expect(page.locator('#btn-place')).toBeEnabled();
  await page.mouse.click(cell.x, cell.y);
  await expect.poll(async () => (await state(page)).moveNumber).toBe(1);
  await page.locator('#btn-undo').click();
  await expect.poll(async () => (await state(page)).moveNumber).toBe(0);
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.locator('#btn-restart').click();
  await expect.poll(async () => (await state(page)).moveNumber).toBe(0);
});

test('drag a tray plate onto the board', async ({ page }) => {
  const dims = await page.evaluate(() => {
    const c = document.querySelector('#stage canvas') as HTMLCanvasElement;
    return { h: c.height };
  });
  const from = await canvasPoint(page, 60, dims.h - 62);
  const to = await canvasPoint(page, 180, 100);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).moveNumber).toBe(1);
});

test('settings: tray mode toggle persists and applies to the next restart', async ({ page }) => {
  await page.locator('#btn-settings').click();
  const batch = page.locator('#settings-body .seg button', { hasText: 'Batch' });
  await batch.click();
  await expect(batch).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#settings-close').click();
  await page.locator('#btn-restart').click();
  const mode = await page.evaluate(
    () => JSON.parse(localStorage.getItem('sliceandserve.settings') ?? '{}').trayMode,
  );
  expect(mode).toBe('batch');
  // Reload keeps the setting (versioned save).
  await page.reload();
  await page.locator('#btn-settings').click();
  await expect(page.locator('#settings-body .seg button', { hasText: 'Batch' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('level menu lists all levels and switching works; Croatian labels', async ({ page }) => {
  await page.locator('#btn-menu').click();
  await expect(page.locator('#level-grid .level-btn')).toHaveCount(5);
  await page.locator('#level-grid .level-btn').nth(2).click();
  await expect
    .poll(async () => page.evaluate(() => (window as unknown as { __sas: Sas }).__sas.level()))
    .toBe('L03');
  await page.locator('#btn-settings').click();
  await page.locator('#settings-body .seg button', { hasText: 'HR' }).click();
  await page.locator('#settings-close').click();
  await expect(page.locator('#btn-undo')).toHaveText('Poništi');
});

test('corrupted save data recovers to defaults', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('sliceandserve.settings', '{broken'));
  await page.reload();
  await expect(page.locator('#stage canvas')).toBeVisible();
  await page.locator('#btn-settings').click();
  await expect(page.locator('#settings-body .seg button').first()).toBeVisible();
});

test('keyboard play advances moves until the game ends or the cap is hit', async ({ page }) => {
  for (let i = 0; i < 40; i++) {
    const s = await state(page);
    if (s.status !== 'playing') break;
    await page.keyboard.press('1');
    // Cursor starts on the first playable cell; move right then down to find an empty one.
    await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowDown');
    await page.keyboard.press('Enter');
  }
  const s = await state(page);
  expect(s.moveNumber).toBeGreaterThan(0);
});
