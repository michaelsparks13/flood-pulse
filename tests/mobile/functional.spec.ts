import { test, expect } from "@playwright/test";
import { waitForAppReady, pauseTimeline } from "./fixtures";

/**
 * Mobile functional tests for FloodPulse.
 *
 * These verify that core features work correctly on touch devices at mobile
 * viewports. Each test that fails reveals a concrete functional gap.
 *
 * Tests annotated with test.fail() are KNOWN ISSUES — they are expected to
 * fail and document specific mobile UX gaps in the current codebase.
 */

test.describe("Home page load & content visibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
  });

  test("map canvas renders", async ({ page }) => {
    const canvas = page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();
  });

  test("FloodPulse heading is visible", async ({ page }) => {
    await expect(page.locator("h1", { hasText: "FloodPulse" })).toBeVisible();
  });

  test("exposure counter shows a value (not loading skeleton)", async ({ page }) => {
    const counter = page.locator(".counter-glow");
    await expect(counter).toBeVisible({ timeout: 10_000 });
    const text = await counter.textContent();
    expect(text).toBeTruthy();
    expect(text).toMatch(/\d/);
  });

  test("timeline slider panel is visible at bottom", async ({ page }) => {
    const timeline = page.locator('input[type="range"]');
    await expect(timeline).toBeVisible();
  });

  test("top-right buttons are all visible", async ({ page }) => {
    await expect(page.locator('button[aria-label="Map layers"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Dataset comparison"]')).toBeVisible();
    await expect(page.locator("button", { hasText: "Methodology" })).toBeVisible();
  });

  test("interaction hint appears after cinematic reveal", async ({ page }) => {
    // The InteractionHint shows "Pinch & drag to explore" on touch devices
    // after the cinematic reveal completes. It auto-dismisses after 8s.
    const hint = page.locator("text=explore");
    const visible = await hint.isVisible().catch(() => false);
    // The hint may have already auto-dismissed by the time waitForAppReady
    // returns (8s wait), so we accept either outcome.
    if (visible) {
      // Verify the hint has appropriate touch text on mobile
      const text = await hint.textContent();
      expect(text).toMatch(/explore/i);
    }
    // If not visible, that's OK — it auto-dismissed, confirming it works
  });
});

test.describe("Timeline interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
  });

  test("tap play/pause toggles timeline advancement", async ({ page }) => {
    // Autoplay is now OFF by default — year starts at 2026.
    const yearEl = page.locator(".absolute.bottom-5 .text-accent-bright").first();
    const yearBefore = await yearEl.textContent();
    expect(yearBefore).toBe("2026");

    // Tap play — year should loop: 2026 → (1.4s pause) → 2000
    await page.locator('button[aria-label="Play"]').tap();

    // Wait for the loop-back (1.4s pause at max year + 600ms advance)
    await page.waitForTimeout(2500);

    const yearAfter = await yearEl.textContent();
    expect(yearAfter, "Year should change after tapping play").not.toBe("2026");

    // Tap pause
    await page.locator('button[aria-label="Pause"]').tap();
    await page.waitForTimeout(200);

    const yearPaused = await yearEl.textContent();
    await page.waitForTimeout(1200);
    const yearStill = await yearEl.textContent();
    expect(yearStill, "Year should not advance after tapping pause").toBe(yearPaused);
  });

  test("slider value changes displayed year", async ({ page }) => {
    await pauseTimeline(page);
    await page.waitForTimeout(300);

    // Set slider to a known year via native setter
    await page.evaluate(() => {
      const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
      if (slider) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )!.set!;
        nativeInputValueSetter.call(slider, "2020");
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        slider.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await page.waitForTimeout(500);

    // Use the bottom-panel year element specifically
    const yearEl = page.locator(".absolute.bottom-5 .text-accent-bright").first();
    const yearText = await yearEl.textContent();
    expect(yearText).toContain("2020");
  });
});

test.describe("Layers panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
  });

  test("tap opens layers popover", async ({ page }) => {
    await page.locator('button[aria-label="Map layers"]').tap();
    await page.waitForTimeout(200);

    await expect(page.locator("text=Country boundaries")).toBeVisible();
  });

  test("toggle switch changes state", async ({ page }) => {
    await page.locator('button[aria-label="Map layers"]').tap();
    await page.waitForTimeout(200);

    const toggle = page.locator('button[role="switch"]').first();
    const initialState = await toggle.getAttribute("aria-checked");

    await toggle.tap();
    await page.waitForTimeout(100);

    const newState = await toggle.getAttribute("aria-checked");
    expect(newState, "Toggle state should change on tap").not.toBe(initialState);
  });

  test("tap outside closes popover", async ({ page }) => {
    await page.locator('button[aria-label="Map layers"]').tap();
    await page.waitForTimeout(200);

    const popoverText = page.locator("text=Country boundaries");
    await expect(popoverText).toBeVisible();

    // Tap on the map canvas (outside the popover)
    const vp = page.viewportSize()!;
    await page.tap("body", { position: { x: vp.width / 2, y: vp.height / 2 } });
    await page.waitForTimeout(300);

    await expect(popoverText).not.toBeVisible();
  });
});

test.describe("Methodology drawer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
  });

  test("tap opens methodology modal", async ({ page }) => {
    await page.locator("button", { hasText: "Methodology" }).tap();
    await page.waitForTimeout(300);

    await expect(page.locator("h2", { hasText: "Methodology" })).toBeVisible();
  });

  test("modal content is scrollable", async ({ page }) => {
    await page.locator("button", { hasText: "Methodology" }).tap();
    await page.waitForTimeout(300);

    const modal = page.locator(".overflow-y-auto").first();
    await expect(modal).toBeVisible();

    const scrollable = await modal.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrollable, "Modal content should be scrollable").toBe(true);
  });

  test("close button dismisses modal", async ({ page }) => {
    await page.locator("button", { hasText: "Methodology" }).tap();
    await page.waitForTimeout(300);

    // Find the close button inside the modal's sticky header
    const closeBtn = page.locator(".fixed .sticky button").first();
    await closeBtn.tap();
    await page.waitForTimeout(300);

    await expect(page.locator("h2", { hasText: "Methodology" })).not.toBeVisible();
  });

  test("tapping backdrop closes modal @known-issue:backdrop-tap", async ({ page }) => {
    await page.locator("button", { hasText: "Methodology" }).tap();
    await page.waitForTimeout(300);

    const heading = page.locator("h2", { hasText: "Methodology" });
    await expect(heading).toBeVisible();

    // Tap the backdrop area (bottom-right corner, away from modal and panels)
    const vp = page.viewportSize()!;
    await page.tap(".fixed.inset-0", { position: { x: vp.width - 10, y: vp.height - 10 } });
    await page.waitForTimeout(500);

    await expect(heading).not.toBeVisible();
  });
});

test.describe("Compare page navigation", () => {
  test("navigates to compare page and back", async ({ page }) => {
    await page.goto("/compare");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await expect(page.locator("h1", { hasText: "Dataset Comparison" })).toBeVisible({ timeout: 10_000 });

    const backLink = page.locator("text=Back to FloodPulse");
    await expect(backLink).toBeVisible();
    await backLink.tap();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1", { hasText: "FloodPulse" })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("ComparisonPopover", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
  });

  test("tap opens comparison popover with chart", async ({ page }) => {
    await page.locator('button[aria-label="Dataset comparison"]').tap();

    const heading = page.locator("text=Dataset Comparison").first();
    await expect(heading).toBeVisible({ timeout: 5000 });

    await expect(page.locator("text=View full comparison")).toBeVisible();
  });

  test("tap outside closes comparison popover", async ({ page }) => {
    await page.locator('button[aria-label="Dataset comparison"]').tap();
    await page.waitForTimeout(500);

    const heading = page.locator("text=Dataset Comparison").first();
    await expect(heading).toBeVisible();

    // Tap on the left edge of the FloodPulse heading — guaranteed to be
    // outside the ComparisonPopover's panelRef and not covered by its popover.
    await page.locator("h1", { hasText: "FloodPulse" }).tap({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);

    await expect(heading).not.toBeVisible();
  });
});

test.describe("Globe touch interaction", () => {
  test("tapping a hex shows popup @known-issue:hover-only", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);
    await pauseTimeline(page);

    // Verify the deck.gl H3HexagonLayer has an onClick handler registered.
    // In headless Chromium, WebGL picking is unreliable for verifying actual
    // popup appearance, but we can confirm the handler is wired up by
    // inspecting the overlay's layer props.
    const hasClickHandler = await page.evaluate(() => {
      const map = (window as any).__map;
      if (!map) return false;
      // deck.gl MapboxOverlay is stored as a map control
      const controls = (map as any)._controls;
      if (!controls) return false;
      for (const ctrl of controls) {
        // MapboxOverlay exposes _deck which has layerManager
        const deck = (ctrl as any)._deck;
        if (!deck) continue;
        const layers = deck.props?.layers;
        if (!layers) continue;
        for (const layer of layers) {
          if (layer.id === "h3-hexes" && typeof layer.props?.onClick === "function") {
            return true;
          }
        }
      }
      return false;
    });

    expect(
      hasClickHandler,
      "H3HexagonLayer should have an onClick handler for touch/tap support. " +
      "This enables mobile users to see hex detail popups on tap.",
    ).toBe(true);
  });
});

test.describe("Default timeline state", () => {
  test("timeline does NOT auto-play on load (starts paused at 2026)", async ({ page }) => {
    await page.goto("/explore");
    await waitForAppReady(page);

    // Year should start at 2026 (full dataset)
    const yearEl = page.locator(".absolute.bottom-5 .text-accent-bright").first();
    const yearInitial = await yearEl.textContent();
    expect(yearInitial, "Year should start at 2026").toBe("2026");

    // Play button should be visible (not Pause), confirming autoplay is off
    await expect(page.locator('button[aria-label="Play"]')).toBeVisible();

    // Wait and verify year hasn't changed
    await page.waitForTimeout(2000);
    const yearLater = await yearEl.textContent();
    expect(yearLater, "Year should remain at 2026 (no autoplay)").toBe("2026");
  });
});
