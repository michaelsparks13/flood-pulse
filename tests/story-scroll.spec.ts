import { test, expect } from "@playwright/test";

test("scrolling advances story acts", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(
    () => !!(window as unknown as { __map?: { loaded: () => boolean } }).__map,
    { timeout: 10_000 }
  );
  await page.waitForTimeout(1500);

  // Initial active act is "breath"
  await expect(page.locator('[data-testid="active-act"]')).toHaveAttribute("data-act-id", "breath");

  // Scroll to act 3
  await page.evaluate(() => window.scrollTo({ top: 2400, behavior: "instant" }));
  await page.waitForTimeout(500);

  const activeId = await page.locator('[data-testid="active-act"]').getAttribute("data-act-id");
  expect(["counter", "where", "hex"]).toContain(activeId);
});
