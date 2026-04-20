import { test, expect } from "@playwright/test";

test("/explore renders the interactive globe with info panel", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator('[data-testid="info-panel"]')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("FloodPulse")).toBeVisible();
  // Timeline slider should be present
  await expect(page.locator('text=2026').first()).toBeVisible();
});

test("/ renders (placeholder for story mode)", async ({ page }) => {
  await page.goto("/");
  // Whatever we render must produce a valid 200 and some content
  await expect(page.locator("body")).toBeVisible();
});

test("/explore globe host is attached and shared", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.locator('[data-testid="globe-host"]')).toBeVisible();
  // Map should initialize into the persistent host
  await page.waitForFunction(
    () => !!(window as unknown as { __map?: { loaded: () => boolean } }).__map,
    { timeout: 10_000 }
  );
  // Data should load — check for the basemap layer
  await page.waitForFunction(
    () => {
      const map = (window as unknown as { __map?: { getLayer: (id: string) => unknown } }).__map;
      return !!map && !!map.getLayer("background");
    },
    { timeout: 10_000 }
  );
});
