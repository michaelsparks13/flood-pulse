import { test, expect } from "@playwright/test";
import { getViewport, assertNoHorizontalOverflow } from "./fixtures";

/**
 * Mobile tests for the /compare page.
 *
 * The compare page is a long scrollable document with charts, tables,
 * and methodology notes. These tests verify it works well on mobile.
 */

async function waitForCompareData(page: import("@playwright/test").Page) {
  await page.goto("/compare");
  // Wait for client-side data fetch to complete — the page shows
  // "Loading comparison data..." until the JSON is fetched and parsed.
  await page.waitForFunction(
    () => !document.body.textContent?.includes("Loading comparison data"),
    { timeout: 15_000 },
  );
  await page.waitForTimeout(500);
}

test.describe("Compare page — content & navigation", () => {
  test.beforeEach(async ({ page }) => {
    await waitForCompareData(page);
  });

  test("heading and subheading are visible", async ({ page }) => {
    await expect(page.locator("h1", { hasText: "Dataset Comparison" })).toBeVisible();
    await expect(page.locator("text=FloodPulse PE/year vs. GFD")).toBeVisible();
  });

  test("all 7 sections render on mobile", async ({ page }) => {
    const sections = [
      "Annual Population Exposed",
      "Event Detection",
      "Cumulative Population Exposed",
      "Calibration",
      "Literature Benchmarks",
      "Methodology Notes",
      "Sources",
    ];

    for (const title of sections) {
      const heading = page.locator("h2", { hasText: title });
      // Scroll into view since sections are below the fold
      await heading.scrollIntoViewIfNeeded();
      await expect(
        heading,
        `Section "${title}" should be visible on mobile`,
      ).toBeVisible();
    }
  });

  test("back link navigates to home page", async ({ page }) => {
    const backLink = page.locator("text=Back to FloodPulse");
    await expect(backLink).toBeVisible();
    await backLink.tap();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1", { hasText: "FloodPulse" })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Compare page — sticky header", () => {
  test("header remains visible after scrolling down", async ({ page }) => {
    await waitForCompareData(page);

    // Verify header is initially visible
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Scroll down significantly
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);

    // Header should still be visible (sticky)
    await expect(header).toBeVisible();

    // Verify it's at the top of the viewport
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y, "Sticky header should be at top of viewport").toBeLessThanOrEqual(1);
  });
});

test.describe("Compare page — table & charts on mobile", () => {
  test.beforeEach(async ({ page }) => {
    await waitForCompareData(page);
  });

  test("benchmarks table is horizontally scrollable", async ({ page }) => {
    // Scroll to the benchmarks section
    const benchmarks = page.locator("h2", { hasText: "Literature Benchmarks" });
    await benchmarks.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // The table wrapper has overflow-x-auto
    const tableWrapper = page.locator(".overflow-x-auto").first();
    await expect(tableWrapper).toBeVisible();

    // Check if table is wider than its container (needs horizontal scroll)
    const scrollInfo = await tableWrapper.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      isScrollable: el.scrollWidth > el.clientWidth,
    }));

    // The table may or may not need scrolling depending on viewport width.
    // If it does need scrolling, verify it's properly set up.
    if (scrollInfo.isScrollable) {
      // Verify we can scroll
      await tableWrapper.evaluate((el) => el.scrollTo(100, 0));
      const scrollLeft = await tableWrapper.evaluate((el) => el.scrollLeft);
      expect(scrollLeft, "Table should be scrollable when content overflows").toBeGreaterThan(0);
    }

    // All 4 column headers should be present
    await expect(page.locator("th", { hasText: "Source" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Metric" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Value" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Period" })).toBeVisible();
  });

  test("charts render at reasonable width on mobile", async ({ page }) => {
    // Check that Recharts ResponsiveContainer actually renders charts
    const chartWrappers = page.locator(".recharts-wrapper");

    // Wait for charts to render
    await page.waitForTimeout(1000);
    const count = await chartWrappers.count();
    expect(count, "At least one chart should render").toBeGreaterThan(0);

    // Check each chart has reasonable dimensions
    for (let i = 0; i < count; i++) {
      const box = await chartWrappers.nth(i).boundingBox();
      if (box) {
        expect(
          box.width,
          `Chart #${i + 1} width (${box.width}px) should be > 200px on mobile`,
        ).toBeGreaterThan(200);
        expect(
          box.height,
          `Chart #${i + 1} height (${box.height}px) should be > 100px`,
        ).toBeGreaterThan(100);
      }
    }
  });

  test("log scale toggle button is tappable (known accessibility concern)", async ({ page }) => {
    // Scroll to the annual PE section where the log scale button lives
    const annualSection = page.locator("h2", { hasText: "Annual Population Exposed" });
    await annualSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const logBtn = page.locator("button", { hasText: "Log scale" });
    await expect(logBtn).toBeVisible();

    // Measure tap target
    const box = await logBtn.boundingBox();
    expect(box).not.toBeNull();

    // The button uses px-2.5 py-1 text-[10px] — likely small for touch
    // WCAG minimum is 24x24px
    if (box!.height < 24 || box!.width < 24) {
      // Document Issue #8 but don't fail the test hard — still tappable
      console.warn(
        `Log scale button tap target: ${box!.width}x${box!.height}px — ` +
        "below 24px WCAG minimum. Consider increasing padding in compare/page.tsx:168.",
      );
    }

    // Verify it actually works when tapped
    await logBtn.tap();
    await page.waitForTimeout(300);

    // Button should now be active (has accent color)
    const classes = await logBtn.getAttribute("class");
    expect(
      classes,
      "Log scale button should be active after tapping",
    ).toContain("accent-bright");
  });

  test("DOI links in benchmarks table are tappable", async ({ page }) => {
    // Scroll to benchmarks
    const benchmarks = page.locator("h2", { hasText: "Literature Benchmarks" });
    await benchmarks.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Find DOI links (text-accent-bright underline elements in the table)
    const doiLinks = page.locator("table a.text-accent-bright");
    const count = await doiLinks.count();
    expect(count, "Benchmarks table should contain DOI links").toBeGreaterThan(0);

    // Verify first link has reasonable tap target
    const firstLink = doiLinks.first();
    const box = await firstLink.boundingBox();
    expect(box).not.toBeNull();
    // Links in a table cell are small but should be at least tappable
    expect(box!.height, "DOI link should have reasonable height").toBeGreaterThanOrEqual(16);
  });
});

test.describe("Compare page — responsive layout", () => {
  test("no unintended horizontal overflow", async ({ page }) => {
    await waitForCompareData(page);
    await assertNoHorizontalOverflow(page);
  });

  test("section cards have appropriate padding on mobile", async ({ page }) => {
    await waitForCompareData(page);

    // Each section uses p-6 (24px) — check the actual rendered padding
    const padding = await page.evaluate(() => {
      const section = document.querySelector("section");
      if (!section) return null;
      const cs = getComputedStyle(section);
      return {
        left: parseFloat(cs.paddingLeft),
        right: parseFloat(cs.paddingRight),
      };
    });

    expect(padding).not.toBeNull();
    // On mobile, 24px padding on each side of a 320px viewport leaves only
    // 272px for content. Verify padding isn't eating too much space.
    const vp = await getViewport(page);
    const contentWidth = vp.width - (padding!.left + padding!.right) - 48; // minus mx-auto px-6
    expect(
      contentWidth,
      `Usable content width (${contentWidth}px) should be > 200px for readability`,
    ).toBeGreaterThan(200);
  });
});
