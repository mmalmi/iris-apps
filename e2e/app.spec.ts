import { expect, test } from '@playwright/test';

test('loads the real index, searches via btree, and plays audio over /htree/', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Your Library')).toBeVisible();
  await expect(page.getByRole('heading', { name: /directionless ep/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /night owl/i }).first()).toBeVisible();
  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const player = document.querySelector('.player-bar');
          const frame = document.querySelector('.page-frame');
          if (!(player instanceof HTMLElement) || !(frame instanceof HTMLElement)) {
            return null;
          }
          return {
            playerPosition: getComputedStyle(player).position,
            playerBottom: getComputedStyle(player).bottom,
            framePaddingBottom: getComputedStyle(frame).paddingBottom,
          };
        }),
    )
    .toMatchObject({ playerPosition: 'fixed', playerBottom: '0px' });

  const searchInput = page.getByPlaceholder('What do you want to play?');

  await searchInput.fill('r');
  const dropdownRows = page.locator('.search-dropdown .dropdown-row');
  await expect(dropdownRows.first()).toBeVisible({ timeout: 10000 });
  await expect(dropdownRows.first()).toHaveClass(/dropdown-row-active/);

  await searchInput.press('ArrowDown');
  await expect(dropdownRows.nth(1)).toHaveClass(/dropdown-row-active/);

  await searchInput.press('Escape');
  await expect(page.locator('.search-dropdown')).toBeHidden();
  await expect(searchInput).not.toBeFocused();

  await searchInput.fill('risey');
  const dropdown = page.locator('.search-dropdown');
  const firstResult = dropdown.locator('.dropdown-row').first();
  await expect(firstResult).toContainText('Memories Of Thailand', { timeout: 15000 });
  await expect(firstResult).toContainText('Risey');
  await expect(firstResult).toHaveClass(/dropdown-row-active/);
  await searchInput.press('Enter');
  await expect(page.locator('.now-panel h2')).toContainText("Memories Of Thailand");
  await expect(page.locator('.player-song strong')).toContainText("Memories Of Thailand");

  const audio = page.locator('audio');
  await expect(audio).toBeVisible();

  await page.evaluate(() => {
    const element = document.querySelector('audio') as HTMLAudioElement | null;
    if (!element) throw new Error('audio element missing');
    element.muted = true;
  });

  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const element = document.querySelector('audio') as HTMLAudioElement | null;
          return element?.currentSrc ?? '';
        }),
      { timeout: 15000 },
    )
    .toContain('/htree/');

  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const element = document.querySelector('audio') as HTMLAudioElement | null;
          return element?.readyState ?? 0;
        }),
      { timeout: 20000 },
    )
    .toBeGreaterThan(1);

  await page.evaluate(async () => {
    const element = document.querySelector('audio') as HTMLAudioElement | null;
    if (!element) throw new Error('audio element missing');
    element.muted = true;
    await element.play();
  });

  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const element = document.querySelector('audio') as HTMLAudioElement | null;
          if (!element) return { currentTime: 0, paused: true };
          return { currentTime: element.currentTime, paused: element.paused };
        }),
      { timeout: 20000 },
    )
    .toMatchObject({ paused: false });

  await expect
    .poll(
      async () =>
        await page.evaluate(() => {
          const element = document.querySelector('audio') as HTMLAudioElement | null;
          return element?.currentTime ?? 0;
        }),
      { timeout: 20000 },
    )
    .toBeGreaterThan(0.5);
});
