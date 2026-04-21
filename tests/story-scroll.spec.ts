import { test, expect } from "@playwright/test";

const ACTS = [
  "old-map",
  "reveal",
  "ratio",
  "why",
  "ladder",
  "three-stories",
  "handoff",
];

async function waitForMap(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => !!(window as unknown as { __map?: { loaded: () => boolean } }).__map,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(1500);
}

async function scrollToAct(page: import("@playwright/test").Page, index: number, fraction = 0.15) {
  // scrollama offset: 0.6 → threshold is 60% down viewport.
  // To land at scrollama progress P within section i:
  //   scrollY = sectionTop - (offset * viewportH) + P * sectionHeight
  await page.evaluate(
    ([idx, frac]) => {
      const section = document.querySelectorAll("[data-story-step]")[idx as number] as HTMLElement;
      if (!section) return;
      const offsetPx = 0.6 * window.innerHeight;
      const enterScrollY = section.offsetTop - offsetPx;
      const target = enterScrollY + (frac as number) * section.offsetHeight;
      window.scrollTo({ top: target, behavior: "instant" });
    },
    [index, fraction],
  );
  await page.waitForTimeout(800);
}

test.describe("Invisible 90% scrollytelling", () => {
  test("initial act is old-map and page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await waitForMap(page);
    await expect(page.locator('[data-testid="active-act"]')).toHaveAttribute(
      "data-act-id",
      "old-map",
    );
    expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
  });

  test("all 7 acts exist in the DOM", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    const found = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-story-step]"))
        .map((s) => s.getAttribute("data-story-step"))
        .filter(Boolean),
    );
    expect(found).toEqual(ACTS);
  });

  test("Act 2 shows dataset counter", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await scrollToAct(page, 1, 0.2);
    await expect(page.locator('[data-testid="active-act"]')).toHaveAttribute(
      "data-act-id",
      "reveal",
      { timeout: 5_000 },
    );
    const counter = page.getByText("Cumulative PE, 2000–2018").first();
    await expect(counter).toBeVisible();
  });

  test("Act 5 renders country gap bars", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await waitForMap(page);
    await scrollToAct(page, 4, 0.2);
    await expect(page.locator('[data-testid="active-act"]')).toHaveAttribute(
      "data-act-id",
      "ladder",
      { timeout: 10_000 },
    );
    const bars = page.locator('[aria-label="Top 10 countries by FP/GFD exposure ratio"] li');
    await expect(bars.first()).toBeVisible({ timeout: 5_000 });
    const count = await bars.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("Act 6 flies to one of the three stories", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await waitForMap(page);
    await scrollToAct(page, 5, 0.1);
    await expect(page.locator('[data-testid="active-act"]')).toHaveAttribute(
      "data-act-id",
      "three-stories",
      { timeout: 10_000 },
    );
    await page.waitForTimeout(3500);
    const lng = await page.evaluate(() => {
      const m = (window as unknown as { __map?: { getCenter: () => { lng: number } } }).__map;
      return m?.getCenter().lng ?? null;
    });
    expect(lng).not.toBeNull();
    // DRC (~25), Bangladesh (~90), or Mozambique (~35)
    expect(lng!).toBeGreaterThan(15);
    expect(lng!).toBeLessThan(100);
  });

  test("Act 7 handoff navigates to /explore", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await waitForMap(page);
    await scrollToAct(page, 6, 0.5);
    await expect(page.locator('[data-testid="active-act"]')).toHaveAttribute(
      "data-act-id",
      "handoff",
      { timeout: 10_000 },
    );
    const btn = page.getByRole("button", { name: /take control/i });
    // Wait for React to propagate activeActId into HandoffButton's visible state
    // (button starts with opacity-0 + pointer-events-none; becomes clickable when visible).
    await expect(btn).not.toHaveClass(/pointer-events-none/, { timeout: 5_000 });
    await btn.click();
    await page.waitForURL("**/explore");
  });

  test("skip link focuses and navigates to /explore", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const activeText = await page.evaluate(() => document.activeElement?.textContent);
    expect(activeText?.toLowerCase()).toContain("skip to interactive explorer");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/explore");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("7 acts render without errors (reduced motion)", async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/");
    await waitForMap(page);
    // Single scroll to bottom rather than step-by-step (avoids 30s evaluate budget)
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(2000);
    expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
  });
});
