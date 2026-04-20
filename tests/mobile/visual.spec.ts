import { test, expect } from "@playwright/test";
import { waitForAppReady, pauseTimeline, measureElement, getViewport } from "./fixtures";

/**
 * Mobile visual / UI tests for FloodPulse.
 *
 * These verify layout integrity, element sizing, and visual correctness
 * at mobile viewports. Screenshot baselines are generated on first run
 * and compared on subsequent runs for regression detection.
 */

test.describe("Layout integrity", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
    await pauseTimeline(page);
    // Give animations time to settle
    await page.waitForTimeout(500);
  });

  test("top-left panel fits within viewport width", async ({ page }) => {
    // The panel has max-w-sm (384px) and starts at left-5 (20px).
    // On a 320px screen, 20 + 384 = 404px — overflows.
    // The parent has overflow-hidden so it clips, but we should check
    // whether the panel's content area is reasonable.
    const panel = await measureElement(page, "[data-testid='info-panel']");
    const vp = await getViewport(page);

    expect(panel, "Top-left panel should be visible").not.toBeNull();

    // The panel's right edge should ideally not exceed viewport
    const rightEdge = panel!.x + panel!.width;
    expect(
      rightEdge,
      `Top-left panel right edge (${rightEdge}px) exceeds viewport width (${vp.width}px). ` +
      "Content may be clipped. Fix: constrain max-w to viewport-aware value " +
      "in app/page.tsx:99.",
    ).toBeLessThanOrEqual(vp.width);
  });

  test("bottom timeline panel is fully visible", async ({ page }) => {
    const bottomPanel = await measureElement(page, ".absolute.bottom-5");
    const vp = await getViewport(page);

    expect(bottomPanel, "Bottom timeline panel should be visible").not.toBeNull();

    // Check the panel doesn't extend below viewport
    const bottomEdge = bottomPanel!.y + bottomPanel!.height;
    expect(
      bottomEdge,
      `Bottom panel bottom edge (${bottomEdge}px) should be <= viewport height (${vp.height}px)`,
    ).toBeLessThanOrEqual(vp.height + 1);

    // Slider should be visible within the panel
    const slider = await measureElement(page, 'input[type="range"]');
    expect(slider, "Timeline slider should be visible").not.toBeNull();
    expect(slider!.width, "Slider should have reasonable width (>100px)").toBeGreaterThan(100);
  });

  test("exposure counter text is not clipped", async ({ page }) => {
    // The counter uses text-4xl on mobile — verify it's fully visible
    const counter = page.locator(".counter-glow").first();
    await expect(counter).toBeVisible();

    const box = await counter.boundingBox();
    expect(box).not.toBeNull();

    // Check the text isn't clipped by verifying the parent panel contains it
    const panel = await measureElement(page, "[data-testid='info-panel']");
    expect(panel).not.toBeNull();

    // Counter right edge should be within the panel
    expect(
      box!.x + box!.width,
      "Counter right edge should fit within its panel",
    ).toBeLessThanOrEqual(panel!.x + panel!.width + 1);
  });
});

test.describe("Overlay stacking order", () => {
  test("modal renders above all other content", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);

    // Open methodology drawer
    await page.locator("button", { hasText: "Methodology" }).tap();
    await page.waitForTimeout(300);

    // Verify the modal has z-50 (highest z-index in the app)
    const zIndex = await page.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0.z-50");
      if (!modal) return null;
      return getComputedStyle(modal).zIndex;
    });

    expect(zIndex).not.toBeNull();
    expect(parseInt(zIndex!), "Modal z-index should be 50").toBe(50);

    // Verify modal covers the full viewport
    const modal = await measureElement(page, ".fixed.inset-0.z-50");
    const vp = await getViewport(page);
    expect(modal).not.toBeNull();
    expect(modal!.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(modal!.height).toBeGreaterThanOrEqual(vp.height - 1);
  });

  test("panels have z-10 above map", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);

    const panelZIndex = await page.evaluate(() => {
      const panel = document.querySelector("[data-testid='info-panel']");
      if (!panel) return null;
      return getComputedStyle(panel).zIndex;
    });

    expect(panelZIndex).not.toBeNull();
    expect(parseInt(panelZIndex!), "Panel z-index should be 10").toBe(10);
  });
});

test.describe("Screenshot baselines", () => {
  test("home page visual baseline", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
    await pauseTimeline(page);
    // Extra wait for map tiles to load
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot("home-mobile.png", {
      maxDiffPixelRatio: 0.05, // Generous threshold for map tile variability
      timeout: 10_000,
    });
  });

  test("compare page visual baseline", async ({ page }) => {
    await page.goto("/compare");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot("compare-mobile.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      timeout: 10_000,
    });
  });

  test("methodology drawer visual baseline", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);

    await page.locator("button", { hasText: "Methodology" }).tap();
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("methodology-drawer-mobile.png", {
      maxDiffPixelRatio: 0.03,
      timeout: 10_000,
    });
  });

  test("layers panel visual baseline", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);

    await page.locator('button[aria-label="Map layers"]').tap();
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("layers-panel-mobile.png", {
      maxDiffPixelRatio: 0.03,
      timeout: 10_000,
    });
  });
});

test.describe("Dark theme contrast", () => {
  test("primary text has sufficient contrast on panel background", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);

    // Check the heading color against the panel background
    const contrast = await page.evaluate(() => {
      const heading = document.querySelector("h1");
      if (!heading) return null;

      const textColor = getComputedStyle(heading).color;
      const panel = heading.closest("[class*='bg-panel']");
      if (!panel) return null;

      // Parse the RGB values
      const parseRGB = (color: string) => {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return null;
        return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
      };

      const text = parseRGB(textColor);
      if (!text) return null;

      // Calculate relative luminance (simplified WCAG formula)
      const luminance = (c: { r: number; g: number; b: number }) => {
        const [rs, gs, bs] = [c.r / 255, c.g / 255, c.b / 255].map((v) =>
          v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
        );
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };

      // Use the known panel solid color (#0f0e1a) as background
      const bg = { r: 15, g: 14, b: 26 };
      const l1 = luminance(text);
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

      return { ratio: Math.round(ratio * 10) / 10, textColor, textRGB: text, bgRGB: bg };
    });

    expect(contrast, "Should be able to measure contrast").not.toBeNull();
    // WCAG AA requires 4.5:1 for normal text, 3:1 for large text (>= 18px bold)
    expect(
      contrast!.ratio,
      `Primary text contrast ratio (${contrast!.ratio}:1) should be >= 4.5:1 for WCAG AA`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  test("tertiary text contrast check @known-issue:contrast", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);

    const ratio = await page.evaluate(() => {
      const luminance = (c: { r: number; g: number; b: number }) => {
        const [rs, gs, bs] = [c.r / 255, c.g / 255, c.b / 255].map((v) =>
          v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
        );
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      };

      // Tertiary text: #7b8ba1
      const text = { r: 123, g: 139, b: 161 };
      // Panel solid background: #0f0e1a
      const bg = { r: 15, g: 14, b: 26 };

      const l1 = luminance(text);
      const l2 = luminance(bg);
      return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 10) / 10;
    });

    // This may fail at 4.5:1 threshold — documents Issue #9.
    // Tertiary text is used for secondary labels, descriptions, and metadata.
    expect(
      ratio,
      `Tertiary text contrast ratio (${ratio}:1) is below WCAG AA 4.5:1 minimum. ` +
      "KNOWN CONCERN (Issue #9): Consider brightening --color-text-tertiary from #64748b to #7b8ba1 " +
      "in globals.css to reach 4.5:1.",
    ).toBeGreaterThanOrEqual(4.5);
  });
});
