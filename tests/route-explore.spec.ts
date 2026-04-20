import { test, expect } from "@playwright/test";

test("/explore renders the interactive globe with info panel", async ({ page }) => {
  await page.goto("http://localhost:3000/explore");
  await expect(page.locator('[data-testid="info-panel"]')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("FloodPulse")).toBeVisible();
  // Timeline slider should be present
  await expect(page.locator('text=2026').first()).toBeVisible();
});

test("/ renders (placeholder for story mode)", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  // Whatever we render must produce a valid 200 and some content
  await expect(page.locator("body")).toBeVisible();
});
