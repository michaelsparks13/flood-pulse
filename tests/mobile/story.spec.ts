import { test, expect } from "@playwright/test";

test("story renders on mobile viewport", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/");

  // Wait for map canvas to appear — reliable signal that Globe has mounted
  await page.waitForSelector(".maplibregl-canvas", { timeout: 20_000 });
  // Give the cinematic reveal and scrollama init a moment to settle
  await page.waitForTimeout(2000);

  // Act 1 copy visible
  await expect(page.getByText(/every four years/i)).toBeVisible();

  // Scroll a bit — active act should advance past "breath"
  await page.evaluate(() => window.scrollTo({ top: 2400, behavior: "instant" }));
  await page.waitForTimeout(800);
  const active = await page
    .locator('[data-testid="active-act"]')
    .getAttribute("data-act-id");
  expect(active).not.toBe("breath");
});
