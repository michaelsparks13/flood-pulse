import { type Page, expect } from "@playwright/test";

/**
 * Wait for the FloodPulse app to be fully loaded:
 * map canvas rendered + hex data loaded + cinematic reveal complete.
 *
 * The app has a cinematic reveal sequence:
 *   1. Map loads (basemap tiles)
 *   2. Hex data fetched + deck.gl compiles shaders
 *   3. flyTo animation (2.8s) + opacity fade-in (2.8s)
 *   4. InteractionHint appears after reveal
 *
 * We wait for the InteractionHint (or its dismissal) as the signal that
 * the reveal is complete and the app is interactive.
 */
export async function waitForAppReady(page: Page) {
  await page.waitForFunction(
    () => document.querySelector(".maplibregl-canvas") !== null,
    { timeout: 15_000 },
  );
  // Wait for data load + cinematic reveal + hint appearance
  // The hint appears ~0.8s after the 2.8s reveal animation completes
  await page.waitForTimeout(8000);
}

/**
 * Pause the timeline auto-play by tapping the pause button.
 * Safe to call even if already paused (becomes a no-op via state check).
 */
export async function pauseTimeline(page: Page) {
  const pauseBtn = page.locator('button[aria-label="Pause"]');
  if (await pauseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pauseBtn.tap();
  }
}

/**
 * Measure the rendered bounding box of an element.
 * Returns null if the element is not visible.
 */
export async function measureElement(
  page: Page,
  selector: string,
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const el = page.locator(selector).first();
  if (!(await el.isVisible().catch(() => false))) return null;
  return el.boundingBox();
}

/**
 * Assert an interactive element meets minimum WCAG 2.2 tap target size.
 * Default minimum: 24x24px (Level AA). Recommended: 44x44px (Level AAA).
 */
export async function assertMinTapTarget(
  page: Page,
  selector: string,
  minPx = 24,
) {
  const box = await measureElement(page, selector);
  expect(box, `Element "${selector}" should be visible`).not.toBeNull();
  expect(box!.width, `"${selector}" width should be >= ${minPx}px`).toBeGreaterThanOrEqual(minPx);
  expect(box!.height, `"${selector}" height should be >= ${minPx}px`).toBeGreaterThanOrEqual(minPx);
}

/**
 * Assert the page has no horizontal overflow (no unintended horizontal scroll).
 */
export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });
  expect(
    overflow.scrollWidth,
    `Page should not overflow horizontally (scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

/**
 * Check if two bounding boxes overlap.
 */
export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Get the viewport dimensions from the page.
 */
export async function getViewport(page: Page) {
  return page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
}

/**
 * Assert an element's bounding box fits entirely within the viewport.
 */
export async function assertWithinViewport(page: Page, selector: string) {
  const box = await measureElement(page, selector);
  expect(box, `Element "${selector}" should be visible`).not.toBeNull();
  const vp = await getViewport(page);
  expect(box!.x, `"${selector}" left edge should be >= 0`).toBeGreaterThanOrEqual(0);
  expect(box!.y, `"${selector}" top edge should be >= 0`).toBeGreaterThanOrEqual(0);
  expect(
    box!.x + box!.width,
    `"${selector}" right edge should be <= viewport width (${vp.width})`,
  ).toBeLessThanOrEqual(vp.width + 1); // 1px tolerance for rounding
  expect(
    box!.y + box!.height,
    `"${selector}" bottom edge should be <= viewport height (${vp.height})`,
  ).toBeLessThanOrEqual(vp.height + 1);
}
