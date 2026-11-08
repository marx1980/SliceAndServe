import { expect, test, type Page } from '@playwright/test';

type Plate = { slices: number[] } | null;
type Snapshot = {
  status: string;
  moveNumber: number;
  columns: number;
  playable: boolean[];
  board: Plate[];
  tray: Plate[];
};
type Sas = {
  state(): Snapshot;
  level(): string;
  history(): { position: number; length: number; branches: number; bookmarks: number };
  play(cmd: { slot: number; row: number; column: number }): void;
};

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
  await page.goto('/?e2e=1');
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
  await expect(page.locator('#level-grid .level-btn')).toHaveCount(30);
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

/** Plays the first legal move, or a random one, through the app. */
async function playMove(page: Page, random = false): Promise<void> {
  await page.evaluate((rnd) => {
    const sas = (window as unknown as { __sas: Sas }).__sas;
    const s = sas.state();
    const slots = s.tray.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
    const cells = s.board.map((p, i) => (s.playable[i] && !p ? i : -1)).filter((i) => i >= 0);
    const pick = <T>(a: T[]): T =>
      rnd ? (a[Math.floor(Math.random() * a.length)] as T) : (a[0] as T);
    const cell = pick(cells);
    sas.play({ slot: pick(slots), row: Math.floor(cell / s.columns), column: cell % s.columns });
  }, random);
}

test('hint ladder climbs six rungs, is labelled, and demonstrates a winning solution', async ({
  page,
}) => {
  await page.locator('#btn-settings').click();
  await page.locator('#settings-body .seg button', { hasText: 'Off' }).first().click();
  await page.locator('#settings-close').click();
  await page.locator('#btn-hint').click();
  await expect(page.locator('#coach')).toContainText('Hint 1/6', { timeout: 15000 });
  await expect(page.locator('#coach .badge')).toHaveText('Solver-confirmed');
  for (let rung = 2; rung <= 6; rung++) {
    await page.locator('#coach .coach-head button', { hasText: 'More' }).click();
    await expect(page.locator('#coach')).toContainText(`Hint ${rung}/6`);
  }
  await expect(page.locator('#coach dl.rows').first()).toContainText('Empty cells');
  await page.locator('#coach button', { hasText: 'Show solution' }).click();
  await expect.poll(async () => (await state(page)).status, { timeout: 30000 }).toBe('won');
});

test('timeline: scrub, branch, bookmark and return to the earlier branch', async ({ page }) => {
  for (let i = 0; i < 3; i++) await playMove(page);
  await page.locator('#btn-timeline').click();
  await expect(page.locator('#timeline-pos')).toContainText('3 / 3');
  await page.locator('#timeline-range').fill('1');
  await expect.poll(async () => (await state(page)).moveNumber).toBe(1);
  await page.locator('#tl-bookmark').click();
  await expect(page.locator('#tl-bookmarks .btn')).toHaveCount(1);
  // A different move from this earlier position starts a second branch.
  await page.evaluate(() => {
    const sas = (window as unknown as { __sas: Sas }).__sas;
    const s = sas.state();
    const empties = s.board.map((p, i) => (s.playable[i] && !p ? i : -1)).filter((i) => i >= 0);
    const cell = empties[empties.length - 1] as number;
    sas.play({ slot: 2, row: Math.floor(cell / s.columns), column: cell % s.columns });
  });
  await expect
    .poll(async () =>
      page.evaluate(() => (window as unknown as { __sas: Sas }).__sas.history().branches),
    )
    .toBe(2);
  await expect(page.locator('#tl-branches .btn')).toHaveCount(2);
  await page.locator('#tl-branches .btn').first().click();
  await expect.poll(async () => (await state(page)).moveNumber).toBe(3);
  await page.locator('#tl-undo').click();
  await expect.poll(async () => (await state(page)).moveNumber).toBe(2);
  await page.locator('#tl-redo').click();
  await expect.poll(async () => (await state(page)).moveNumber).toBe(3);
});

test('failure analysis names the closing move and retry returns to the winning position', async ({
  page,
}) => {
  await page.locator('#btn-menu').click();
  await page.locator('#level-grid .level-btn').nth(3).click();
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = 0; i < 40; i++) {
      if ((await state(page)).status !== 'playing') break;
      await playMove(page, true);
    }
    if ((await state(page)).status === 'lost') break;
    await page
      .locator('#result .btn')
      .last()
      .click()
      .catch(() => undefined);
    await page.locator('#btn-restart').click();
  }
  expect((await state(page)).status).toBe('lost');
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#result-analysis')).toContainText('Last winning move', {
    timeout: 60000,
  });
  await expect(page.locator('#result-analysis')).toContainText('Closing move');
  const before = (await state(page)).moveNumber;
  await page.locator('#result-actions .btn', { hasText: 'Retry from move' }).click();
  await expect.poll(async () => (await state(page)).moveNumber).toBeLessThan(before);
  expect((await state(page)).status).toBe('playing');
});

test('Fair Bake receipt shows a verified level', async ({ page }) => {
  await page.locator('#btn-menu').click();
  await page.locator('#menu-fair').click();
  await expect(page.locator('#fair-rows')).toContainText('Verified');
  await expect(page.locator('#fair-rows')).toContainText('Viable first moves');
  await expect(page.locator('#fair-rows')).toContainText('Fixed');
});

test('Teach Me compares a played move with the recommendation', async ({ page }) => {
  await page.locator('#btn-settings').click();
  const row = page.locator('#settings-body .row', { hasText: 'Teach Me' });
  await row.locator('button', { hasText: 'On' }).click();
  await page.locator('#settings-close').click();
  await playMove(page, true);
  await expect(page.locator('#coach')).toContainText('Teach Me', { timeout: 20000 });
  await expect(page.locator('#coach .badge')).toHaveText(/Matches|Differs/);
  await expect(page.locator('#coach dl.rows')).toContainText('Route');
});

test('suspend and resume: the timeline survives a reload', async ({ page }) => {
  await playMove(page, true);
  const before = await page.evaluate(() => (window as unknown as { __sas: Sas }).__sas.history());
  expect(before.length).toBeGreaterThan(1);
  await page.reload();
  await expect(page.locator('#stage canvas')).toBeVisible();
  const after = await page.evaluate(() => (window as unknown as { __sas: Sas }).__sas.history());
  expect(after.length).toBe(before.length);
  expect((await state(page)).moveNumber).toBeGreaterThan(0);
});

test('recipe book and bakery list their collections', async ({ page }) => {
  await page.locator('#btn-menu').click();
  await page.locator('#menu-recipes').click();
  await expect(page.locator('#recipes-body .stamp')).toHaveCount(30);
  await expect(page.locator('#recipes-title')).toContainText('0/30');
  await page.locator('#recipes-close').click();
  await page.locator('#btn-menu').click();
  await page.locator('#menu-bakery').click();
  await expect(page.locator('#bakery-body .area')).toHaveCount(7);
  await page.locator('#bakery-close').click();
});

test('story lines appear once and can be dismissed', async ({ page }) => {
  await page.goto('/?e2e=1&story=1');
  await expect(page.locator('#story')).toBeVisible();
  await expect(page.locator('#story-speaker')).toHaveText('Mira');
  await page.locator('#story-next').click();
  await expect(page.locator('#story')).toBeHidden();
  await page.reload();
  await expect(page.locator('#stage canvas')).toBeVisible();
  await expect(page.locator('#story')).toBeHidden();
});

test('earned tools: choose a tool, reveal upcoming plates with the spoon', async ({ page }) => {
  await page.locator('#btn-menu').click();
  await page.locator('#level-grid .level-btn').nth(11).click();
  await expect(page.locator('#tools')).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __sas: { debugStart(p: object): void } }).__sas.debugStart({
      grants: 1,
    }),
  );
  await expect(page.locator('#tools')).toContainText('Choose');
  await page.locator('#tools button', { hasText: 'Tasting spoon' }).click();
  await expect(page.locator('#tools button', { hasText: 'Tasting spoon ×1' })).toBeVisible();
  await page.locator('#tools button', { hasText: 'Tasting spoon ×1' }).click();
  await expect(page.locator('#tools')).toContainText('Next');
});

test('a hat is shown for the mastery goal', async ({ page }) => {
  await page.locator('#btn-menu').click();
  await page.locator('#level-grid .level-btn').nth(5).click();
  await expect(page.locator('#v-goal')).toContainText('★');
});
