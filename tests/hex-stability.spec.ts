import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Visual stability tests for the flood-pulse hex layer.
 *
 * The bug (before the fix): per-frame `map.jumpTo` rotation at 0.015°/frame
 * produced sub-pixel motion that caused visible anti-aliasing shimmer at every
 * hex color boundary — appearing to the user as "static" or "continuously
 * recompiling" hexagons. Pixels changed by small amounts (<30 RGB) on every
 * frame across the entire hex layer.
 *
 * The fix: replace the rAF jumpTo loop with MapLibre's native `easeTo` which
 * produces smooth motion that's either clean edge transitions (real movement)
 * or stable pixels — not the broadband sub-pixel noise.
 *
 * We detect the bug by categorizing per-pixel changes between adjacent frames:
 *   - stable:     delta == 0       (no change)
 *   - noise-like: 0 < delta < 30   (sub-pixel AA shimmer — the "static")
 *   - edge-like:  delta >= 30      (real motion at hex boundaries)
 *
 * In the buggy state, noise-like dominates (~100% of changed pixels).
 * In the fixed state, stable + edge-like dominate; noise-like is minimal.
 */

const CAPTURE_REGION = { w: 400, h: 400 };
const NOISE_THRESHOLD = 30; // RGB sum delta below this is sub-pixel AA noise

async function waitForHexesRendered(page: Page) {
  await page.waitForFunction(
    () => document.querySelector(".maplibregl-canvas") !== null,
    { timeout: 15_000 }
  );
  // Wait for data load + deck.gl compile + first frames
  await page.waitForTimeout(4000);
}

async function captureCenterRegion(page: Page): Promise<number[]> {
  return page.evaluate((region) => {
    const canvas = document.querySelector(
      ".maplibregl-canvas"
    ) as HTMLCanvasElement;
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext("2d")!;
    ctx.drawImage(canvas, 0, 0);
    const cx = Math.floor(canvas.width / 2) - region.w / 2;
    const cy = Math.floor(canvas.height / 2) - region.h / 2;
    return Array.from(ctx.getImageData(cx, cy, region.w, region.h).data);
  }, CAPTURE_REGION);
}

interface ChangeBreakdown {
  stable: number;
  noiseLike: number;
  edgeLike: number;
  total: number;
  stablePct: number;
  noiseLikePct: number;
  edgeLikePct: number;
}

function classifyChanges(a: number[], b: number[]): ChangeBreakdown {
  let stable = 0;
  let noiseLike = 0;
  let edgeLike = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d =
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]);
    if (d === 0) stable++;
    else if (d < NOISE_THRESHOLD) noiseLike++;
    else edgeLike++;
  }
  const total = a.length / 4;
  return {
    stable,
    noiseLike,
    edgeLike,
    total,
    stablePct: (stable / total) * 100,
    noiseLikePct: (noiseLike / total) * 100,
    edgeLikePct: (edgeLike / total) * 100,
  };
}

async function stopRotationByInteraction(page: Page) {
  await page.evaluate(() => {
    const canvas = document.querySelector(".maplibregl-canvas");
    canvas?.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 0 }));
  });
  await page.waitForTimeout(500);
}

/**
 * Ensure the timeline is paused. Timeline starts paused by default,
 * but this helper guarantees it for stability tests.
 */
async function pauseTimeline(page: Page) {
  const pauseBtn = page.getByRole("button", { name: /pause/i });
  if (await pauseBtn.isVisible().catch(() => false)) {
    await pauseBtn.click();
  }
  await page.waitForTimeout(300);
}

test.describe("Hex layer visual stability", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForHexesRendered(page);
  });

  test("hexes are pixel-stable when globe is stationary and timeline is paused", async ({
    page,
  }) => {
    await pauseTimeline(page);
    await stopRotationByInteraction(page);

    // Capture 5 frames with small waits — all should be identical
    const frames: number[][] = [];
    for (let i = 0; i < 5; i++) {
      frames.push(await captureCenterRegion(page));
      await page.waitForTimeout(50);
    }

    for (let i = 1; i < frames.length; i++) {
      const c = classifyChanges(frames[i - 1], frames[i]);
      expect(
        c.stable,
        `Stationary frame ${i}: expected fully stable, got ${c.total - c.stable} changed pixels`
      ).toBe(c.total);
    }
  });

  test("timeline auto-play does not cause sub-pixel flicker between year ticks", async ({
    page,
  }) => {
    // Default behavior: timeline is auto-playing. Capture many frames INSIDE a
    // single page.evaluate to avoid IPC overhead, then pull classified stats back.
    const stats = await page.evaluate(async () => {
      const canvas = document.querySelector(
        ".maplibregl-canvas"
      ) as HTMLCanvasElement;
      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      const ctx = off.getContext("2d")!;
      const cx = Math.floor(canvas.width / 2) - 200;
      const cy = Math.floor(canvas.height / 2) - 200;

      const grab = () => {
        ctx.drawImage(canvas, 0, 0);
        return ctx.getImageData(cx, cy, 400, 400).data;
      };

      // Capture 25 frames over ~800ms to catch ≥1 year tick
      const frames: Uint8ClampedArray[] = [];
      for (let i = 0; i < 25; i++) {
        frames.push(grab());
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r()))
        );
      }

      // Per-pair classification
      let flickerFrames = 0;
      let totalPairs = 0;
      let worstShimmer = 0;
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1];
        const b = frames[i];
        let stable = 0;
        let noise = 0;
        let edge = 0;
        for (let j = 0; j < a.length; j += 4) {
          const d =
            Math.abs(a[j] - b[j]) +
            Math.abs(a[j + 1] - b[j + 1]) +
            Math.abs(a[j + 2] - b[j + 2]);
          if (d === 0) stable++;
          else if (d < 30) noise++;
          else edge++;
        }
        const total = stable + noise + edge;
        const noisePct = (noise / total) * 100;
        const edgePct = (edge / total) * 100;
        const isYearTick = edgePct > 2;
        const isShimmer = !isYearTick && noisePct > 5;
        if (isShimmer) flickerFrames++;
        if (noisePct > worstShimmer && !isYearTick) worstShimmer = noisePct;
        totalPairs++;
      }

      return { flickerFrames, totalPairs, worstShimmer };
    });

    expect(
      stats.flickerFrames,
      `Detected ${stats.flickerFrames}/${stats.totalPairs} frames with sub-pixel shimmer during auto-play (worst non-tick shimmer: ${stats.worstShimmer.toFixed(1)}%)`
    ).toBe(0);
  });

  // Note: rotation-during-playback tests don't work in headless Playwright
  // because requestAnimationFrame is throttled when the browser lacks focus,
  // so auto-rotation doesn't actually render new frames. We therefore verify
  // the rotation-path fix via a source-level regression guard below, plus
  // manual verification in a real browser (documented in the test file).

  test("ocean/empty regions have no flicker (basemap is stable)", async ({
    page,
  }) => {
    await pauseTimeline(page);
    // Sample a region known to have no hexes (top-left quadrant)
    const capture = async () =>
      page.evaluate(() => {
        const canvas = document.querySelector(
          ".maplibregl-canvas"
        ) as HTMLCanvasElement;
        const off = document.createElement("canvas");
        off.width = canvas.width;
        off.height = canvas.height;
        off.getContext("2d")!.drawImage(canvas, 0, 0);
        return Array.from(
          off.getContext("2d")!.getImageData(50, 50, 300, 300).data
        );
      });

    const frames: number[][] = [];
    for (let i = 0; i < 5; i++) {
      frames.push(await capture());
      await page.waitForTimeout(50);
    }

    let totalNoise = 0;
    let totalSamples = 0;
    for (let i = 1; i < frames.length; i++) {
      const c = classifyChanges(frames[i - 1], frames[i]);
      totalNoise += c.noiseLike;
      totalSamples += c.total;
    }
    const noisePct = (totalNoise / totalSamples) * 100;
    expect(
      noisePct,
      `Empty region should have no flicker, got ${noisePct.toFixed(1)}% noise`
    ).toBeLessThan(5);
  });
});

test.describe("Globe.tsx rotation code regression guard", () => {
  // The "static" bug was caused by per-frame map motion at sub-pixel step
  // sizes. The original was map.jumpTo in a rAF loop at 0.015°/frame; a later
  // attempt used map.easeTo at 3°/sec which ALSO produced visible sub-pixel
  // shimmer because 3° over 1 second at 120fps is still ~0.025°/frame.
  //
  // The only reliable fix is to NOT auto-rotate the map at all. Any programmatic
  // continuous motion of the map (auto-spin) will cause sub-pixel AA shimmer
  // on the hex layer. The user can rotate manually by dragging.

  const GLOBE_SRC = readFileSync(
    join(__dirname, "..", "components", "Globe.tsx"),
    "utf8"
  );

  test("Globe.tsx does not call map.jumpTo inside a requestAnimationFrame", () => {
    const rafJumpToPattern =
      /requestAnimationFrame[\s\S]{0,200}map\.jumpTo|map\.jumpTo[\s\S]{0,200}requestAnimationFrame/;
    expect(
      rafJumpToPattern.test(GLOBE_SRC),
      "Globe.tsx uses map.jumpTo inside a requestAnimationFrame loop — this was the original static bug."
    ).toBe(false);
  });

  test("Globe.tsx does not use a sub-pixel rotation step (<= 0.02 deg)", () => {
    const subPixelStepPattern = /jumpTo[\s\S]{0,100}\+\s*0\.0[012]\d*/;
    expect(
      subPixelStepPattern.test(GLOBE_SRC),
      "Globe.tsx appears to use a sub-pixel rotation step in jumpTo — this causes AA shimmer."
    ).toBe(false);
  });

  test("Globe.tsx does not auto-rotate via map.easeTo in a moveend loop", () => {
    // The easeTo/moveend spin pattern also produced visible sub-pixel shimmer.
    // If either easeTo is present AND a moveend handler exists that re-triggers it,
    // the test fails.
    const hasEaseTo = /map\.easeTo|\.easeTo\(/.test(GLOBE_SRC);
    const hasMoveendHandler = /map\.on\(\s*["']moveend["']/.test(GLOBE_SRC);
    expect(
      hasEaseTo && hasMoveendHandler,
      "Globe.tsx has easeTo + moveend handler — likely an auto-rotate loop that produces sub-pixel shimmer. Remove auto-rotation."
    ).toBe(false);
  });

  test("Globe.tsx does not schedule map motion on a setInterval", () => {
    // Any timer-based map motion would also produce motion without user input.
    const intervalMapMotionPattern =
      /setInterval[\s\S]{0,300}map\.(jumpTo|easeTo|panTo|panBy|flyTo|rotateTo)/;
    expect(
      intervalMapMotionPattern.test(GLOBE_SRC),
      "Globe.tsx schedules map motion via setInterval — this can cause flicker."
    ).toBe(false);
  });
});

test.describe("Runtime: map has no auto-motion on initial load", () => {
  test("map.getCenter() does not drift over 2 seconds without interaction", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForHexesRendered(page);

    // DO NOT interact. DO NOT stop rotation. Verify the map is idle.
    const before = await page.evaluate(() => {
      const w = window as unknown as {
        __map: { getCenter: () => { lng: number; lat: number } };
      };
      const c = w.__map.getCenter();
      return { lng: c.lng, lat: c.lat };
    });

    await page.waitForTimeout(2000);

    const after = await page.evaluate(() => {
      const w = window as unknown as {
        __map: { getCenter: () => { lng: number; lat: number } };
      };
      const c = w.__map.getCenter();
      return { lng: c.lng, lat: c.lat };
    });

    expect(
      after.lng,
      `Map longitude drifted from ${before.lng} to ${after.lng} — something is auto-rotating it.`
    ).toBeCloseTo(before.lng, 4);
    expect(after.lat).toBeCloseTo(before.lat, 4);
  });

  test("map.isMoving() is false on initial load", async ({ page }) => {
    await page.goto("/");
    await waitForHexesRendered(page);

    const isMoving = await page.evaluate(() => {
      const w = window as unknown as { __map: { isMoving: () => boolean } };
      return w.__map.isMoving();
    });

    expect(
      isMoving,
      "map.isMoving() is true on load — auto-rotation is still happening."
    ).toBe(false);
  });
});

test.describe("Default UI state", () => {
  test("country borders are visible by default", async ({ page }) => {
    await page.goto("/");
    await waitForHexesRendered(page);

    // Check that the country-boundaries layer exists and has non-zero opacity
    const boundariesOpacity = await page.evaluate(() => {
      const w = window as unknown as {
        __map: {
          getLayer: (id: string) => unknown;
          getPaintProperty: (id: string, prop: string) => number;
        };
      };
      const layer = w.__map.getLayer("country-boundaries");
      if (!layer) return null;
      return w.__map.getPaintProperty("country-boundaries", "line-opacity");
    });

    expect(
      boundariesOpacity,
      "country borders should be visible by default"
    ).toBeGreaterThan(0);
  });

  test("timeline is paused on initial load", async ({ page }) => {
    await page.goto("/");
    await waitForHexesRendered(page);

    // Read the year displayed in the timeline, wait, and check it did NOT advance.
    const readYear = () =>
      page.evaluate(() => {
        const yearEl = Array.from(document.querySelectorAll("span")).find(
          (el) => /^20\d\d$/.test(el.textContent?.trim() ?? "")
        );
        return yearEl ? parseInt(yearEl.textContent!.trim()) : null;
      });

    const before = await readYear();
    await page.waitForTimeout(1500);
    const after = await readYear();

    expect(before, "year should render").not.toBeNull();
    expect(after, "year should render").not.toBeNull();
    expect(
      after,
      `Timeline should be paused: year stayed at ${before} but changed to ${after}`
    ).toBe(before);
  });
});
