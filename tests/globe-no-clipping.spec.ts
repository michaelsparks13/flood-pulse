import { test, expect } from "@playwright/test";

test("globe renders hex layer without rectangular clipping at tilt", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  // Wait for the cinematic reveal to complete
  await page.waitForFunction(
    () => !!(window as any).__map && (window as any).__map.loaded(),
    { timeout: 10_000 }
  );
  await page.waitForTimeout(3500); // flyTo + opacity reveal

  // Tilt + zoom into Bangladesh region (known hex-dense area)
  await page.evaluate(() => {
    const map = (window as any).__map;
    map.jumpTo({ center: [90, 23.7], zoom: 2.8, pitch: 35, bearing: 0 });
  });
  await page.waitForTimeout(1200);

  const screenshot = await page.screenshot({ clip: { x: 200, y: 200, width: 600, height: 400 } });
  expect(screenshot.length).toBeGreaterThan(5000); // non-empty image
  // Snapshot check: used for visual regression — will be baselined on first run.
  expect(screenshot).toMatchSnapshot("globe-tilted-bangladesh.png", { maxDiffPixelRatio: 0.05 });
});
