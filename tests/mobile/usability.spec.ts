import { test, expect } from "@playwright/test";
import {
  waitForAppReady,
  assertMinTapTarget,
  assertNoHorizontalOverflow,
  measureElement,
  boxesOverlap,
  getViewport,
} from "./fixtures";

/**
 * Mobile usability tests for FloodPulse.
 *
 * These verify that interactions meet quality thresholds for touch devices.
 * Failures here document concrete improvement opportunities for mobile UX.
 */

test.describe("Tap target sizes — WCAG 2.2 Level AA (24x24px minimum)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("play/pause button meets minimum tap target", async ({ page }) => {
    // w-9 h-9 = 36x36px — should pass
    await assertMinTapTarget(page, 'button[aria-label="Pause"], button[aria-label="Play"]');
  });

  test("layers button meets minimum tap target", async ({ page }) => {
    await assertMinTapTarget(page, 'button[aria-label="Map layers"]');
  });

  test("compare button meets minimum tap target", async ({ page }) => {
    await assertMinTapTarget(page, 'button[aria-label="Dataset comparison"]');
  });

  test("methodology button meets minimum tap target", async ({ page }) => {
    const btn = page.locator("button", { hasText: "Methodology" });
    const box = await btn.boundingBox();
    expect(box, "Methodology button should be visible").not.toBeNull();
    expect(box!.width, "Button width >= 24px").toBeGreaterThanOrEqual(24);
    expect(box!.height, "Button height >= 24px").toBeGreaterThanOrEqual(24);
  });

  test("toggle switches meet minimum tap target @known-issue:size", async ({ page }) => {
    await page.locator('button[aria-label="Map layers"]').tap();
    await page.waitForTimeout(200);

    const toggles = page.locator('button[role="switch"]');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await toggles.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(
        box!.height,
        `Toggle switch #${i + 1} height (${box!.height}px) should be >= 24px`,
      ).toBeGreaterThanOrEqual(24);
    }
  });

  test("timeline slider thumb meets minimum tap target @known-issue:size", async ({ page }) => {
    const classes = await page.locator('input[type="range"]').first().getAttribute("class");
    const hasSmallThumb = classes?.includes("w-5");
    expect(
      !hasSmallThumb,
      "Timeline slider thumb uses w-5 (20px) — below 24px WCAG minimum.",
    ).toBe(true);
  });

  test("opacity slider thumb meets minimum tap target @known-issue:size", async ({ page }) => {
    await page.locator('button[aria-label="Map layers"]').tap();
    await page.waitForTimeout(200);

    const opacitySlider = page.locator('input[type="range"]').last();
    const classes = await opacitySlider.getAttribute("class") ?? "";
    // Verify the thumb uses w-6 (24px) or larger
    const hasAdequateThumb = classes.includes("slider-thumb]:w-6") || classes.includes("slider-thumb]:w-7");
    expect(
      hasAdequateThumb,
      "Opacity slider thumb should use w-6 (24px) or larger for WCAG compliance",
    ).toBe(true);
  });

  test("methodology drawer close button meets minimum tap target", async ({ page }) => {
    // Open drawer
    await page.locator("button", { hasText: "Methodology" }).tap();
    await page.waitForTimeout(300);

    // Close button is w-8 h-8 = 32x32px — should pass
    const closeBtn = page.locator(".fixed .sticky button").first();
    const box = await closeBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width, "Close button width >= 24px").toBeGreaterThanOrEqual(24);
    expect(box!.height, "Close button height >= 24px").toBeGreaterThanOrEqual(24);
  });
});

test.describe("No horizontal overflow", () => {
  test("home page has no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await assertNoHorizontalOverflow(page);
  });

  test("compare page has no horizontal scroll", async ({ page }) => {
    await page.goto("/compare");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
    await assertNoHorizontalOverflow(page);
  });
});

test.describe("Panel overlap detection", () => {
  test("top-left panel and top-right buttons do not overlap @known-issue:layout", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const topLeftPanel = await measureElement(page, "[data-testid='info-panel']");
    const topRightBtns = await measureElement(page, ".absolute.top-5.right-5");

    if (topLeftPanel && topRightBtns) {
      const overlaps = boxesOverlap(topLeftPanel, topRightBtns);
      expect(
        overlaps,
        `Top-left panel (right edge: ${topLeftPanel.x + topLeftPanel.width}px) ` +
        `overlaps with top-right buttons (left edge: ${topRightBtns.x}px).`,
      ).toBe(false);
    }
  });

  test("bottom timeline panel does not overlap top panels", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const topLeftPanel = await measureElement(page, "[data-testid='info-panel']");
    // Bottom panel — use a more specific selector
    const bottomPanel = await measureElement(page, ".absolute.bottom-5");

    if (topLeftPanel && bottomPanel) {
      const overlaps = boxesOverlap(topLeftPanel, bottomPanel);
      expect(
        overlaps,
        "Top-left panel should not overlap with bottom timeline panel",
      ).toBe(false);
    }
  });
});

test.describe("Popover viewport containment", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("layers popover fits within viewport", async ({ page }) => {
    await page.locator('button[aria-label="Map layers"]').tap();
    await page.waitForTimeout(300);

    // The popover is w-56 (224px) positioned absolute right-0
    const popover = page.locator(".w-56").first();
    if (await popover.isVisible()) {
      const box = await popover.boundingBox();
      const vp = await getViewport(page);
      expect(box).not.toBeNull();
      expect(
        box!.x + box!.width,
        `Layers popover right edge (${box!.x + box!.width}px) should be <= viewport width (${vp.width}px)`,
      ).toBeLessThanOrEqual(vp.width + 1);
      expect(box!.x, "Layers popover left edge should be >= 0").toBeGreaterThanOrEqual(-1);
    }
  });

  test("comparison popover fits within viewport @known-issue:overflow", async ({ page }) => {
    await page.locator('button[aria-label="Dataset comparison"]').tap();
    await page.waitForTimeout(500);

    const popover = page.locator("[data-testid='comparison-popover']").first();
    if (await popover.isVisible()) {
      const box = await popover.boundingBox();
      const vp = await getViewport(page);
      expect(box).not.toBeNull();
      expect(
        box!.x + box!.width,
        `Comparison popover right edge (${box!.x + box!.width}px) should be <= viewport width (${vp.width}px)`,
      ).toBeLessThanOrEqual(vp.width + 1);
      expect(box!.x, "Comparison popover left edge should be >= 0").toBeGreaterThanOrEqual(-1);
    }
  });
});

test.describe("Mode toggle accessibility on mobile", () => {
  test("exposure/frequency toggle is hidden on mobile (known gap)", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // The mode toggle is inside a div with "hidden sm:flex"
    // On mobile (< 640px), it should be hidden.
    // This test DOCUMENTS the gap — it PASSES by confirming the toggle is missing.
    const exposureBtn = page.locator("button", { hasText: "Exposure" });
    const isVisible = await exposureBtn.isVisible().catch(() => false);

    expect(
      isVisible,
      "KNOWN GAP (Issue #1): Exposure/Frequency mode toggle is completely hidden on mobile. " +
      "Users cannot switch map modes or see the color legend. " +
      "Fix: Add a mobile-friendly mode toggle (e.g., bottom sheet or floating FAB) in app/page.tsx:142.",
    ).toBe(false);
  });

  test("color legend is hidden on mobile (known gap)", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // The legend gradient is a w-28 h-2 div inside the hidden sm:flex container.
    // On mobile, users have no way to interpret hex colors.
    const legendLow = page.locator("text=Low").first();
    const isVisible = await legendLow.isVisible().catch(() => false);

    expect(
      isVisible,
      "KNOWN GAP (Issue #1): Color legend is hidden on mobile. " +
      "Users see colored hexes but have no way to interpret what the colors mean. " +
      "Fix: Add a minimal legend inside the top-left panel or as a collapsible element.",
    ).toBe(false);
  });
});

test.describe("Text readability", () => {
  test("no text renders below 8px on home page", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const tinyText = await page.evaluate(() => {
      const issues: string[] = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const cs = getComputedStyle(parent);
            if (cs.display === "none" || cs.visibility === "hidden") return NodeFilter.FILTER_REJECT;
            if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const parent = node.parentElement!;
        const fontSize = parseFloat(getComputedStyle(parent).fontSize);
        if (fontSize < 8) {
          issues.push(`"${node.textContent?.trim().slice(0, 30)}" at ${fontSize}px`);
        }
      }
      return issues;
    });

    expect(
      tinyText.length,
      `Found ${tinyText.length} text elements below 8px: ${tinyText.join(", ")}`,
    ).toBe(0);
  });
});
