import { test, expect } from "@playwright/test";

test("story renders on mobile viewport", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/");
  await page.waitForSelector(".maplibregl-canvas", { timeout: 20_000 });
  await page.waitForTimeout(2000);

  // Act 1 copy visible
  await expect(page.getByText(/for two decades/i)).toBeVisible();

  // Scroll past Act 1 — active act should advance beyond "old-map"
  await page.evaluate(() => window.scrollTo({ top: 2400, behavior: "instant" }));
  await page.waitForTimeout(800);
  const active = await page
    .locator('[data-testid="active-act"]')
    .getAttribute("data-act-id");
  expect(active).not.toBe("old-map");
});
