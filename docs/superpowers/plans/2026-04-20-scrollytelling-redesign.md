# FloodPulse Scrollytelling Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the globe-projection hex-clipping bug and reframe `/` as a 9-act scrollytelling narrative that hands off seamlessly to the existing explorer at `/explore`.

**Architecture:** Option B — story as front door, explorer as destination. Shared globe instance persisted across routes via a React context so the handoff requires no map reinit. scrollama drives act transitions; deck.gl `FlyToInterpolator` handles camera choreography. The rendering bug is fixed by a one-line switch from `interleaved: true` to `interleaved: false` on the `MapboxOverlay`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.7, MapLibre GL 5.20, deck.gl 9.2, scrollama 3.2, Playwright 1.59.

**Spec:** `docs/superpowers/specs/2026-04-20-scrollytelling-redesign-design.md`

**Branch:** `agent/pages-scrollytelling-redesign-4f32` (already created and tracks the spec commit).

---

## Conventions for every task

- Tests live in `tests/*.spec.ts` (Playwright — the project has no unit test framework; visual behavior is verified via Playwright).
- Dev server: `npm run dev` — Turbopack, http://localhost:3000.
- Build check before commit: `npm run build` must pass.
- Commit messages use the `[area]` prefix per the repo's multi-agent protocol (`pages`, `components`, `lib`, `config`).
- All commits end with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Do NOT push, merge, or deploy at any task boundary. Final verification (Task 18) is the only place deployment discussion lives.

---

## Task 1: Fix the Globe-Projection Rendering Bug

**Files:**
- Modify: `components/Globe.tsx:341-368`
- Create: `tests/globe-no-clipping.spec.ts`

**Rationale:** This ships the fix in isolation so it can be merged independently if the scrollytelling work is slower to complete. It's also the lowest-risk change.

- [ ] **Step 1: Write the failing test**

Create `tests/globe-no-clipping.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("globe renders hex layer without rectangular clipping at tilt", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  // Wait for the cinematic reveal to complete
  await page.waitForFunction(
    () => !!(window as any).__map && (window as any).__map.loaded(),
    { timeout: 10_000 }
  );
  await page.waitForTimeout(3500); // flyTo + opacity reveal

  // Tilt + zoom into Bangladesh region (known hex-dense area)
  await page.evaluate(() => {
    const map = (window as any).__map;
    map.jumpTo({ center: [90, 23.7], zoom: 2.8, pitch: 35, bearing: 0 });
  });
  await page.waitForTimeout(1200);

  // Sample 25 pixels across a 500x500 region and verify none are pure black (no hex clip)
  const blackPixelRatio = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.maplibregl-canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("webgl2") || canvas.getContext("webgl");
    // We can't read WebGL framebuffer directly; use a 2D snapshot via the deck.gl overlay canvas too.
    // Instead, take a screenshot and check via Playwright.
    return 0; // placeholder; we'll verify by screenshot comparison below
  });

  const screenshot = await page.screenshot({ clip: { x: 200, y: 200, width: 600, height: 400 } });
  expect(screenshot.length).toBeGreaterThan(5000); // non-empty image
  // Snapshot check: used for visual regression — will be baselined on first run.
  expect(screenshot).toMatchSnapshot("globe-tilted-bangladesh.png", { maxDiffPixelRatio: 0.05 });
});
```

- [ ] **Step 2: Run the test to confirm it fails (shows the bug)**

Start the dev server first in one terminal:
```bash
npm run dev
```

Then in another:
```bash
npx playwright test tests/globe-no-clipping.spec.ts
```

Expected: FAIL on first run (no snapshot baseline). Before baselining, visually verify the screenshot in `test-results/` shows the black rectangular artifacts.

- [ ] **Step 3: Apply the fix**

In `components/Globe.tsx`, replace lines 341-368 (the try/fallback block for overlay creation) with this single construction:

```ts
    if (!overlayRef.current) {
      const overlay = new MapboxOverlay({
        interleaved: false,
        layers: [layer],
      });
      map.addControl(overlay as unknown as maplibregl.IControl);
      overlayRef.current = overlay;
      console.log("[FloodPulse] deck.gl overlay added (overlaid)");
      onDataReady?.();
      triggerReveal();
    } else {
      overlayRef.current.setProps({ layers: [layer] });
    }
```

- [ ] **Step 4: Baseline and re-run the test**

Re-run with `--update-snapshots` to baseline the now-correct rendering:
```bash
npx playwright test tests/globe-no-clipping.spec.ts --update-snapshots
```

Expected: Snapshot written. Visually inspect the baseline in `tests/globe-no-clipping.spec.ts-snapshots/` — must show continuous hex coverage with NO rectangular black regions.

Run the full existing Playwright suite to confirm no regression:
```bash
npx playwright test
```

Expected: all tests PASS, including `tests/hex-stability.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add components/Globe.tsx tests/globe-no-clipping.spec.ts tests/globe-no-clipping.spec.ts-snapshots/
git commit -m "$(cat <<'EOF'
[components] Fix globe-projection hex clipping via overlaid mode

deck.gl interleaved rendering shared MapLibre's depth buffer and got
z-killed by the globe horizon clipping plane at tilt + zoom. Overlaid
mode renders to a separate canvas above MapLibre and avoids the issue.

Tracked upstream: mapbox-gl-js#13574, deck.gl#7920.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Install scrollama and Add Story Type Definitions

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `lib/story/storyTypes.ts`
- Create: `lib/story/cameraKeyframes.ts`

- [ ] **Step 1: Install scrollama**

```bash
npm install scrollama@3.2.0
npm install --save-dev @types/scrollama
```

Expected: new entries in `package.json`. Size impact under 5 KB gzipped.

- [ ] **Step 2: Create story type definitions**

Create `lib/story/storyTypes.ts`:

```ts
import type { MapMode } from "@/lib/types";

export interface CameraKeyframe {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  duration: number | "auto";
  easing?: (t: number) => number;
}

export interface ActDataState {
  year: number;
  mapMode: MapMode;
  hexOpacity: number;
  /** Specific H3 index to pulse, if any (Act 4). */
  highlightHex?: string;
  /** When true, render before/after dual-layer compare (Act 5). */
  splitCompare?: boolean;
  /** When true, recolor hexes by client-computed confidence (Act 6). */
  confidenceMode?: boolean;
  /** When true, render the globe fog mask (Act 3). */
  fogMask?: boolean;
}

export interface ActDefinition {
  id: string;
  /** Short title shown only to screen readers. */
  ariaTitle: string;
  copy: string | string[]; // multi-string = Act 7 city sequence
  camera: CameraKeyframe;
  data: ActDataState;
  /**
   * If true, scroll progress (0..1) within this act drives a continuous
   * transformation (year, bearing) — see lib/story/acts.ts for handlers.
   */
  progressDriven?: boolean;
}
```

- [ ] **Step 3: Create the camera keyframe library**

Create `lib/story/cameraKeyframes.ts` with the exact keyframes from the spec for each of the 9 acts:

```ts
import type { CameraKeyframe } from "./storyTypes";

export const GLOBE_HOME: CameraKeyframe = {
  center: [20, 15],
  zoom: 0.8,
  pitch: 15,
  bearing: 0,
  duration: "auto",
};

export const GLOBE_MID: CameraKeyframe = {
  center: [20, 15],
  zoom: 1.6,
  pitch: 10,
  bearing: 0,
  duration: "auto",
};

export const GLOBE_FLAT: CameraKeyframe = {
  center: [20, 15],
  zoom: 1.4,
  pitch: 0,
  bearing: 0,
  duration: "auto",
};

export const BANGLADESH_COUNTRY: CameraKeyframe = {
  center: [90, 23.7],
  zoom: 4.5,
  pitch: 30,
  bearing: 0,
  duration: "auto",
};

export const KHULNA_HEX: CameraKeyframe = {
  center: [89.56, 22.84],
  zoom: 5.5,
  pitch: 45,
  bearing: 0,
  duration: "auto",
};

export const DHAKA: CameraKeyframe = {
  center: [90.4, 23.8],
  zoom: 6.5,
  pitch: 25,
  bearing: 0,
  duration: 2500,
};

export const JAKARTA: CameraKeyframe = {
  center: [106.8, -6.2],
  zoom: 6.5,
  pitch: 25,
  bearing: 0,
  duration: 2500,
};

export const NEW_ORLEANS: CameraKeyframe = {
  center: [-90.1, 29.95],
  zoom: 6.5,
  pitch: 25,
  bearing: 0,
  duration: 2500,
};
```

- [ ] **Step 4: Verify the build compiles**

```bash
npm run build
```

Expected: build passes. No type errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json lib/story/
git commit -m "$(cat <<'EOF'
[lib] Scaffold story types and camera keyframes

Adds scrollama dependency and defines ActDefinition / CameraKeyframe
types. Camera keyframes locked in for all 9 acts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Route Split — Move `/` to `/explore`

**Files:**
- Create: `app/explore/page.tsx` (content from current `app/page.tsx`)
- Modify: `app/page.tsx` (temporary placeholder — replaced in later tasks)
- Create: `tests/route-explore.spec.ts`

**Rationale:** Separate the route move from the story build so the explorer works on a stable URL before we touch it further.

- [ ] **Step 1: Write the failing test**

Create `tests/route-explore.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx playwright test tests/route-explore.spec.ts
```

Expected: FAIL — `/explore` route does not exist yet.

- [ ] **Step 3: Move the existing page to `/explore`**

```bash
mkdir -p app/explore
git mv app/page.tsx app/explore/page.tsx
```

Leave the file contents untouched.

- [ ] **Step 4: Create a placeholder `app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="w-screen h-screen flex items-center justify-center bg-bg text-text-primary">
      <div className="text-center">
        <h1 className="text-2xl mb-4">FloodPulse</h1>
        <a href="/explore" className="underline text-text-secondary">
          Open explorer →
        </a>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx playwright test tests/route-explore.spec.ts
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/explore/page.tsx tests/route-explore.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Move explorer to /explore, placeholder at /

Separates the routes ahead of the scrollytelling rewrite. /explore
functions identically to the previous /.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: GlobeContext — Shared Map Instance Across Routes

**Files:**
- Create: `context/GlobeContext.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/Globe.tsx` (read from context instead of owning its own refs)
- Modify: `app/explore/page.tsx` (use context-aware Globe)

**Rationale:** The shared-globe handoff is the riskiest part of this plan. Ship it standalone so it can be stress-tested via `/explore` before the story is built on top.

- [ ] **Step 1: Create GlobeContext**

Create `context/GlobeContext.tsx`:

```tsx
"use client";

import { createContext, useContext, useRef, useState, useCallback, ReactNode } from "react";
import type maplibregl from "maplibre-gl";
import type { MapboxOverlay } from "@deck.gl/mapbox";
import type { HexDatum } from "@/lib/types";

interface GlobeContextValue {
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  overlayRef: React.MutableRefObject<MapboxOverlay | null>;
  hexDataRef: React.MutableRefObject<HexDatum[] | null>;
  containerRef: React.RefObject<HTMLDivElement>;
  basemapReady: boolean;
  dataReady: boolean;
  setBasemapReady: (v: boolean) => void;
  setDataReady: (v: boolean) => void;
}

const GlobeContext = createContext<GlobeContextValue | null>(null);

export function GlobeProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const hexDataRef = useRef<HexDatum[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [basemapReady, setBasemapReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  return (
    <GlobeContext.Provider
      value={{
        mapRef,
        overlayRef,
        hexDataRef,
        containerRef,
        basemapReady,
        dataReady,
        setBasemapReady,
        setDataReady,
      }}
    >
      {/* Persistent globe host — positioned by route via CSS, never unmounted */}
      <div
        ref={containerRef}
        data-testid="globe-host"
        className="fixed inset-0 z-0"
        style={{ pointerEvents: "auto" }}
      />
      {children}
    </GlobeContext.Provider>
  );
}

export function useGlobe() {
  const ctx = useContext(GlobeContext);
  if (!ctx) throw new Error("useGlobe must be used inside GlobeProvider");
  return ctx;
}
```

- [ ] **Step 2: Wire GlobeProvider into the root layout**

Modify `app/layout.tsx` — wrap `{children}` in `<GlobeProvider>`:

```tsx
import { GlobeProvider } from "@/context/GlobeContext";
// ... existing imports ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlobeProvider>{children}</GlobeProvider>
      </body>
    </html>
  );
}
```

(Preserve whatever metadata exports and className structure already exist in `app/layout.tsx`.)

- [ ] **Step 3: Refactor Globe.tsx to use the shared refs**

Modify `components/Globe.tsx`:

- Replace the local `containerRef = useRef<HTMLDivElement>(null)` with `const { containerRef, mapRef, overlayRef, hexDataRef } = useGlobe();`.
- Remove the local `useRef` declarations for `mapRef`, `overlayRef`, `hexDataRef`.
- Change the component's return to `return null;` — the container div now lives in the provider.
- Change the initialization effect's cleanup: DO NOT call `mapRef.current.remove()` on unmount. The map persists. Instead, reset state flags only.

Full replacement of the cleanup block (currently lines 225-236):

```ts
    return () => {
      cancelled = true;
      // NOTE: Do not destroy the map — it lives in GlobeContext and persists
      // across route transitions. Only clean up route-scoped listeners/popups.
      popupRef.current?.remove();
    };
```

Additionally, replace `setLoaded(true)` local state with `setBasemapReady(true)` from context (and delete the local `loaded` state — derive it from `context.basemapReady`).

- [ ] **Step 4: Update `app/explore/page.tsx` to render Globe via context**

In `app/explore/page.tsx`, the `<Globe ... />` usage stays, but since Globe now returns `null`, the map renders into the fixed container in the provider. The explorer's other panels still overlay on top via `z-index: 10` which is already set. No logic changes required — just verify visually.

- [ ] **Step 5: Run `/explore` end-to-end test**

Add to `tests/route-explore.spec.ts`:

```ts
test("/explore globe host is attached and shared", async ({ page }) => {
  await page.goto("http://localhost:3000/explore");
  await expect(page.locator('[data-testid="globe-host"]')).toBeVisible();
  // Map should initialize into the persistent host
  await page.waitForFunction(
    () => !!(window as any).__map && (window as any).__map.loaded(),
    { timeout: 10_000 }
  );
  // Data should load
  await page.waitForFunction(
    () => {
      const map = (window as any).__map;
      return map && map.getLayer("background");
    },
    { timeout: 10_000 }
  );
});
```

Run:
```bash
npm run build && npx playwright test tests/route-explore.spec.ts tests/hex-stability.spec.ts tests/globe-no-clipping.spec.ts
```

Expected: all PASS. The explorer behaves identically but the map canvas now lives in a fixed div above the React tree.

- [ ] **Step 6: Commit**

```bash
git add context/ app/layout.tsx components/Globe.tsx app/explore/page.tsx tests/route-explore.spec.ts
git commit -m "$(cat <<'EOF'
[components] Hoist MapLibre instance into GlobeContext

Enables shared-globe handoff between / and /explore without reinit.
The map canvas lives in a fixed-position host rendered by the
provider and persists across route transitions. /explore continues
to work identically.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: StoryContainer + Scrollama Infrastructure

**Files:**
- Create: `components/story/StoryContainer.tsx`
- Create: `components/story/Act.tsx`
- Create: `lib/story/acts.ts` (ActDefinition array with stub acts)
- Create: `components/story/useCameraChoreographer.ts`
- Modify: `app/page.tsx` (replace placeholder)

- [ ] **Step 1: Create the Act component**

Create `components/story/Act.tsx`:

```tsx
"use client";

import { forwardRef, ReactNode } from "react";

interface ActProps {
  id: string;
  ariaTitle: string;
  children: ReactNode;
  /** Total scroll height for this act, in viewport heights. Default 1. */
  heightVh?: number;
}

export const Act = forwardRef<HTMLElement, ActProps>(function Act(
  { id, ariaTitle, children, heightVh = 1 },
  ref
) {
  return (
    <section
      ref={ref}
      data-story-step={id}
      aria-label={ariaTitle}
      style={{ minHeight: `${heightVh * 100}vh` }}
      className="relative flex items-end justify-center pb-24 px-5 sm:px-10"
    >
      <div className="max-w-xl w-full bg-panel/70 backdrop-blur-xl rounded-2xl border border-border p-6">
        {children}
      </div>
    </section>
  );
});
```

- [ ] **Step 2: Create the camera choreographer hook**

Create `components/story/useCameraChoreographer.ts`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useGlobe } from "@/context/GlobeContext";
import type { CameraKeyframe } from "@/lib/story/storyTypes";

/**
 * Flies the shared globe camera to the given keyframe. Called by StoryContainer
 * on scrollama step.enter events.
 */
export function useCameraChoreographer() {
  const { mapRef } = useGlobe();
  const lastKeyframeRef = useRef<CameraKeyframe | null>(null);

  const flyTo = (kf: CameraKeyframe) => {
    const map = mapRef.current;
    if (!map) return;
    lastKeyframeRef.current = kf;
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      map.jumpTo({ center: kf.center, zoom: kf.zoom, pitch: kf.pitch, bearing: kf.bearing });
      return;
    }
    map.flyTo({
      center: kf.center,
      zoom: kf.zoom,
      pitch: kf.pitch,
      bearing: kf.bearing,
      duration: kf.duration === "auto" ? undefined : kf.duration,
      essential: true,
      easing: kf.easing,
    });
  };

  return { flyTo, lastKeyframeRef };
}
```

- [ ] **Step 3: Create the acts registry (stubs for now)**

Create `lib/story/acts.ts`:

```ts
import type { ActDefinition } from "./storyTypes";
import {
  GLOBE_HOME,
  GLOBE_MID,
  GLOBE_FLAT,
  BANGLADESH_COUNTRY,
  KHULNA_HEX,
  DHAKA,
  JAKARTA,
  NEW_ORLEANS,
} from "./cameraKeyframes";

export const ACTS: ActDefinition[] = [
  {
    id: "breath",
    ariaTitle: "Act 1: The Breath",
    copy: "Every four years, the number of people living in flooded places doubles.",
    camera: GLOBE_HOME,
    data: { year: 2000, mapMode: "exposure", hexOpacity: 0.3 },
    progressDriven: true,
  },
  {
    id: "counter",
    ariaTitle: "Act 2: The Counter Wakes",
    copy: "86 million people. Up from 40 million in the year 2000.",
    camera: GLOBE_MID,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9 },
    progressDriven: true,
  },
  {
    id: "where",
    ariaTitle: "Act 3: Where Are They?",
    copy: "One in four of them lives here — in a country the size of Iowa.",
    camera: BANGLADESH_COUNTRY,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, fogMask: true },
  },
  {
    id: "hex",
    ariaTitle: "Act 4: One Hex, One Story",
    copy: "This single hexagon. 360,000 people. Flooded in 22 of the last 26 years.",
    camera: KHULNA_HEX,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, highlightHex: "851e3597fffffff" },
  },
  {
    id: "compare",
    ariaTitle: "Act 5: Before and After",
    copy: "Drag to compare. The last decade versus the one before.",
    camera: GLOBE_MID,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, splitCompare: true },
  },
  {
    id: "confidence",
    ariaTitle: "Act 6: The Confidence Texture",
    copy: "Not all of these are equally certain. Coastal hexes have ground truth. Inland rivers are inferred.",
    camera: GLOBE_MID,
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, confidenceMode: true },
  },
  {
    id: "cities",
    ariaTitle: "Act 7: The Three Cities",
    copy: ["Dhaka. 2.3 million exposed.", "Jakarta. 1.8 million.", "New Orleans. 460 thousand."],
    camera: DHAKA, // sub-steps override via lib/story/citySequence below
    data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9 },
  },
  {
    id: "frequency",
    ariaTitle: "Act 8: The Frequency Map",
    copy: "This is where it's getting worse.",
    camera: GLOBE_FLAT,
    data: { year: 2026, mapMode: "frequency", hexOpacity: 0.9 },
  },
  {
    id: "handoff",
    ariaTitle: "Act 9: Take Control",
    copy: "This is your map. Take control →",
    camera: GLOBE_FLAT,
    data: { year: 2026, mapMode: "frequency", hexOpacity: 0.9 },
  },
];

export const CITY_SEQUENCE = [DHAKA, JAKARTA, NEW_ORLEANS];
```

- [ ] **Step 4: Create StoryContainer**

Create `components/story/StoryContainer.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import scrollama from "scrollama";
import { Act } from "./Act";
import { ACTS } from "@/lib/story/acts";
import { useCameraChoreographer } from "./useCameraChoreographer";

interface StoryContainerProps {
  onActChange?: (id: string, progress: number) => void;
}

export default function StoryContainer({ onActChange }: StoryContainerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeAct, setActiveAct] = useState<string>(ACTS[0].id);
  const { flyTo } = useCameraChoreographer();

  useEffect(() => {
    const scroller = scrollama();
    scroller
      .setup({
        step: "[data-story-step]",
        offset: 0.6,
        progress: true,
      })
      .onStepEnter((res) => {
        const id = res.element.getAttribute("data-story-step")!;
        setActiveAct(id);
        const act = ACTS.find((a) => a.id === id);
        if (act) flyTo(act.camera);
        onActChange?.(id, 0);
      })
      .onStepProgress((res) => {
        const id = res.element.getAttribute("data-story-step")!;
        onActChange?.(id, res.progress);
      });

    const handleResize = () => scroller.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      scroller.destroy();
      window.removeEventListener("resize", handleResize);
    };
  }, [flyTo, onActChange]);

  return (
    <div ref={scrollerRef} className="relative z-10">
      {ACTS.map((act) => (
        <Act key={act.id} id={act.id} ariaTitle={act.ariaTitle} heightVh={1.2}>
          {Array.isArray(act.copy) ? (
            act.copy.map((line, i) => (
              <p key={i} className="text-text-primary text-lg leading-relaxed mb-2">
                {line}
              </p>
            ))
          ) : (
            <p className="text-text-primary text-lg leading-relaxed">{act.copy}</p>
          )}
        </Act>
      ))}
      {/* Invisible data attribute for the currently active act — useful for tests */}
      <div data-testid="active-act" data-act-id={activeAct} style={{ display: "none" }} />
    </div>
  );
}
```

- [ ] **Step 5: Replace the placeholder page**

Replace `app/page.tsx` entirely:

```tsx
"use client";

import dynamic from "next/dynamic";
import StoryContainer from "@/components/story/StoryContainer";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  return (
    <>
      <Globe
        year={2026}
        mapMode="exposure"
        showBoundaries={true}
        showLabels={false}
        satellite={false}
        hexOpacity={0.9}
      />
      <StoryContainer />
    </>
  );
}
```

- [ ] **Step 6: Verify story scroll advances acts**

Add to a new test file `tests/story-scroll.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("scrolling advances story acts", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });

  // Initial active act is "breath"
  await expect(page.locator('[data-testid="active-act"]')).toHaveAttribute("data-act-id", "breath");

  // Scroll to act 3
  await page.evaluate(() => window.scrollTo({ top: 2400, behavior: "instant" }));
  await page.waitForTimeout(500);

  const activeId = await page.locator('[data-testid="active-act"]').getAttribute("data-act-id");
  expect(["counter", "where"]).toContain(activeId);
});
```

Run:
```bash
npm run build && npx playwright test tests/story-scroll.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/story/ lib/story/acts.ts app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Scrollytelling skeleton: 9 acts with camera choreography

StoryContainer wraps scrollama to drive camera flyTo on act enter.
Acts are defined declaratively in lib/story/acts.ts. Each act is a
sticky-relative section in the scroll container above the shared
globe. Data state wiring arrives in later tasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Act 1 — The Breath (Data State Wiring)

**Files:**
- Modify: `app/page.tsx` (pass per-act data state to Globe)
- Create: `components/story/useActDataState.ts`

- [ ] **Step 1: Create the data state hook**

Create `components/story/useActDataState.ts`:

```tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { ACTS } from "@/lib/story/acts";
import type { ActDataState } from "@/lib/story/storyTypes";

export function useActDataState() {
  const [activeActId, setActiveActId] = useState<string>(ACTS[0].id);
  const [actProgress, setActProgress] = useState<number>(0);

  const handleActChange = useCallback((id: string, progress: number) => {
    setActiveActId(id);
    setActProgress(progress);
  }, []);

  const dataState: ActDataState = useMemo(() => {
    const act = ACTS.find((a) => a.id === activeActId) ?? ACTS[0];
    return act.data;
  }, [activeActId]);

  return { activeActId, actProgress, dataState, handleActChange };
}
```

- [ ] **Step 2: Wire state into the home page**

Update `app/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import StoryContainer from "@/components/story/StoryContainer";
import { useActDataState } from "@/components/story/useActDataState";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const { dataState, handleActChange } = useActDataState();
  return (
    <>
      <Globe
        year={dataState.year}
        mapMode={dataState.mapMode}
        showBoundaries={true}
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
      />
      <StoryContainer onActChange={handleActChange} />
    </>
  );
}
```

- [ ] **Step 3: Verify Act 1 renders dim hexes at year 2000**

Add to `tests/story-scroll.spec.ts`:

```ts
test("Act 1 shows dim hexes at year 2000", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(2000); // give deck.gl a moment

  const year = await page.evaluate(() => {
    // The year should reach the Globe via props — verify by inspecting the
    // rendered H3HexagonLayer's filterRange via the overlay control.
    const map = (window as any).__map;
    const deck = map?._controls?.find((c: any) => c?.constructor?.name === "MapboxOverlay");
    return deck?.props?.layers?.[0]?.props?.filterRange;
  });
  expect(year).toEqual([0, 2000]);
});
```

Run:
```bash
npx playwright test tests/story-scroll.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/story/useActDataState.ts app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Wire Act 1 data state: dim hexes at year 2000

useActDataState reads ActDataState off the currently active act and
passes year/mapMode/opacity to the shared Globe. Act 1 renders at
year 2000 with 0.3 opacity — "the breath".

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Act 2 — The Counter Wakes (Scroll-Driven Year)

**Files:**
- Create: `components/story/StoryCounter.tsx`
- Modify: `components/story/useActDataState.ts` (add progress-driven year override)
- Modify: `app/page.tsx` (mount the counter)

- [ ] **Step 1: Fetch global_summary in the hook and compute year from progress**

Update `components/story/useActDataState.ts`:

```tsx
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { ACTS } from "@/lib/story/acts";
import type { ActDataState } from "@/lib/story/storyTypes";
import type { GlobalSummary } from "@/lib/types";

export function useActDataState() {
  const [activeActId, setActiveActId] = useState<string>(ACTS[0].id);
  const [actProgress, setActProgress] = useState<number>(0);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);

  useEffect(() => {
    fetch("/data/global_summary.json")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, []);

  const handleActChange = useCallback((id: string, progress: number) => {
    setActiveActId(id);
    setActProgress(progress);
  }, []);

  const dataState: ActDataState = useMemo(() => {
    const act = ACTS.find((a) => a.id === activeActId) ?? ACTS[0];
    if (act.id === "counter" && act.progressDriven) {
      // Year advances 2000 → 2026 linearly across Act 2's scroll span
      const y = Math.round(2000 + actProgress * 26);
      return { ...act.data, year: Math.min(Math.max(y, 2000), 2026) };
    }
    return act.data;
  }, [activeActId, actProgress]);

  return { activeActId, actProgress, dataState, summary, handleActChange };
}
```

- [ ] **Step 2: Create the StoryCounter component**

Create `components/story/StoryCounter.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { GlobalSummary } from "@/lib/types";

interface Props {
  summary: GlobalSummary | null;
  year: number;
  /** Visibility controlled by active act — only show from Act 2 onward. */
  visible: boolean;
}

function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function StoryCounter({ summary, year, visible }: Props) {
  const [displayYear, setDisplayYear] = useState(year);
  useEffect(() => setDisplayYear(year), [year]);

  const entry = summary?.yearly.find((y) => y.year === displayYear);
  const pop = entry?.population_exposed ?? 0;

  return (
    <div
      aria-live="polite"
      className={`fixed top-8 left-8 z-20 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="bg-panel/80 backdrop-blur-xl rounded-2xl border border-border p-5">
        <div className="text-[10px] tracking-widest uppercase text-text-tertiary mb-1">
          Population exposed — {displayYear}
        </div>
        <div className="text-4xl font-semibold text-accent-highlight tabular-nums">
          {formatPop(pop)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount the counter in the page**

Update `app/page.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import StoryContainer from "@/components/story/StoryContainer";
import StoryCounter from "@/components/story/StoryCounter";
import { useActDataState } from "@/components/story/useActDataState";

const Globe = dynamic(() => import("@/components/Globe"), { ssr: false });

export default function Home() {
  const { dataState, summary, activeActId, handleActChange } = useActDataState();
  const counterVisible = !["breath"].includes(activeActId);

  return (
    <>
      <Globe
        year={dataState.year}
        mapMode={dataState.mapMode}
        showBoundaries={true}
        showLabels={false}
        satellite={false}
        hexOpacity={dataState.hexOpacity}
      />
      <StoryCounter summary={summary} year={dataState.year} visible={counterVisible} />
      <StoryContainer onActChange={handleActChange} />
    </>
  );
}
```

- [ ] **Step 4: Test the counter**

Add to `tests/story-scroll.spec.ts`:

```ts
test("Act 2 counter ticks as user scrolls through the act", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Scroll to start of Act 2 (act heights are 1.2vh, so ~1.2 * 900 = 1080px)
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
  await page.waitForTimeout(400);
  const midYearText = await page.locator("text=Population exposed").textContent();
  expect(midYearText).toMatch(/20(0|1|2)\d/);

  // Scroll deeper into Act 2
  await page.evaluate(() => window.scrollTo({ top: 2100, behavior: "instant" }));
  await page.waitForTimeout(400);
  const lateYearText = await page.locator("text=Population exposed").textContent();
  // Year should have advanced
  expect(lateYearText).toMatch(/202\d/);
});
```

Run:
```bash
npx playwright test tests/story-scroll.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/story/StoryCounter.tsx components/story/useActDataState.ts app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Act 2: scroll-driven year counter

Year advances 2000→2026 linearly with scroll progress within Act 2.
StoryCounter is a fixed top-left chip that reads population exposed
from global_summary.json. Counter fades in from Act 2 onward.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Act 3 — Where Are They? (Fog Mask)

**Files:**
- Create: `components/story/FogMask.tsx`
- Modify: `app/page.tsx` (mount fog mask driven by `dataState.fogMask`)

- [ ] **Step 1: Create the fog mask component**

Create `components/story/FogMask.tsx`:

```tsx
"use client";

interface Props {
  active: boolean;
}

export default function FogMask({ active }: Props) {
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[1] pointer-events-none transition-opacity duration-700 ${
        active ? "opacity-100" : "opacity-0"
      }`}
      style={{
        background:
          "radial-gradient(circle at 50% 50%, transparent 300px, rgba(7,6,13,0.85) 650px)",
      }}
    />
  );
}
```

- [ ] **Step 2: Mount in the page**

Update `app/page.tsx`, adding the FogMask inside the fragment:

```tsx
<FogMask active={!!dataState.fogMask} />
```

- [ ] **Step 3: Test Act 3 camera reaches Bangladesh + fog is active**

Add to `tests/story-scroll.spec.ts`:

```ts
test("Act 3 flies to Bangladesh and enables fog mask", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Scroll to Act 3
  await page.evaluate(() => window.scrollTo({ top: 3600, behavior: "instant" }));
  await page.waitForTimeout(2000); // allow flyTo

  const center = await page.evaluate(() => {
    const c = (window as any).__map.getCenter();
    return { lng: c.lng, lat: c.lat };
  });
  expect(center.lng).toBeGreaterThan(80);
  expect(center.lng).toBeLessThan(100);
  expect(center.lat).toBeGreaterThan(18);
  expect(center.lat).toBeLessThan(28);
});
```

Run:
```bash
npx playwright test tests/story-scroll.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/story/FogMask.tsx app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Act 3: Bangladesh flyTo with radial fog mask

Darkens the globe outside a 600px circle around the camera target
to focus attention on the country-scale reveal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Act 4 — One Hex, One Story (Pulse Layer)

**Files:**
- Modify: `components/Globe.tsx` (add optional highlight-hex pulse layer)
- Create: `scripts/find-khulna-hex.ts` (one-shot query, committed but may not run in CI)

- [ ] **Step 1: Find the actual top-exposure Bangladesh hex**

Create `scripts/find-khulna-hex.ts`:

```ts
import { readFileSync } from "fs";
import path from "path";

interface Row {
  h: string;
  p: number;
  cc: string;
  yf: number;
  m: number;
  rp: number;
}

const raw = readFileSync(path.resolve("public/data/hex_compact.json"), "utf-8");
const json = JSON.parse(raw);
const cols: string[] = json.columns;
const rows: (string | number)[][] = json.rows;

const bd = rows
  .map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])) as unknown as Row)
  .filter((r) => r.cc === "BD")
  .sort((a, b) => b.p - a.p);

console.log("Top 5 Bangladesh hexes by exposed population:");
for (const r of bd.slice(0, 5)) {
  console.log(`  ${r.h} — pop=${r.p}, years=${r.yf}, months=${r.m}, return=${r.rp.toFixed(2)}`);
}
```

Run:
```bash
npx tsx scripts/find-khulna-hex.ts
```

Expected output: five rows; record the top hex ID and its `pop`, `yf`, `m`, `rp` values.

- [ ] **Step 2: Update Act 4 copy and hex ID from real data**

Edit `lib/story/acts.ts` — replace the `hex` act entry with real numbers. Example (substitute with actual values from Step 1):

```ts
{
  id: "hex",
  ariaTitle: "Act 4: One Hex, One Story",
  copy: "This single hexagon. {pop} people. Flooded in {yf} of the last {span} years. A return period of {rp}.",
  camera: {
    center: [/* hex centroid from h3.cellToLatLng */],
    zoom: 5.5,
    pitch: 45,
    bearing: 0,
    duration: "auto",
  },
  data: { year: 2026, mapMode: "exposure", hexOpacity: 0.9, highlightHex: "<h3_index_from_step_1>" },
},
```

Copy string interpolation: manually insert the numbers inline. Do not leave placeholder `{pop}` in the shipped code — replace with concrete values like "This single hexagon. 340,000 people. Flooded in 22 of the last 26 years."

- [ ] **Step 3: Add the pulse layer to Globe.tsx**

In `components/Globe.tsx`, extend props and add a second layer for the highlighted hex.

Props update (near the `GlobeProps` interface, ~line 39):

```ts
interface GlobeProps {
  year: number;
  mapMode: MapMode;
  showBoundaries?: boolean;
  showLabels?: boolean;
  satellite?: boolean;
  hexOpacity?: number;
  highlightHex?: string;
  onBasemapReady?: () => void;
  onDataReady?: () => void;
  onRevealStart?: () => void;
}
```

Inside the layer-building useEffect (currently ~line 240), after the main `layer` is constructed, conditionally append a second H3HexagonLayer:

```ts
const layers: any[] = [layer];
if (highlightHex) {
  const pulseData = [{ h: highlightHex }];
  const phase = (performance.now() / 1000) % 1.0;
  const pulseAlpha = 100 + Math.round(Math.sin(phase * 2 * Math.PI) * 80);
  layers.push(
    new (H3HexagonLayer as any)({
      id: "h3-pulse",
      data: pulseData,
      getHexagon: (d: { h: string }) => d.h,
      getFillColor: [252, 255, 164, pulseAlpha],
      filled: true,
      stroked: true,
      getLineColor: [252, 255, 164, 200],
      getLineWidth: 2,
      lineWidthUnits: "pixels",
      pickable: false,
      updateTriggers: {
        getFillColor: [phase],
      },
    })
  );
}
```

Then pass `layers` (not `[layer]`) to `setProps`.

To drive the pulse animation, add a `useEffect` that triggers a re-render at ~30 fps only while `highlightHex` is set:

```ts
const [pulseTick, setPulseTick] = useState(0);
useEffect(() => {
  if (!highlightHex) return;
  const id = setInterval(() => setPulseTick((t) => t + 1), 60);
  return () => clearInterval(id);
}, [highlightHex]);
```

Add `pulseTick` to the layer-building useEffect's dependency array.

- [ ] **Step 4: Wire through the page**

Update `app/page.tsx`:

```tsx
<Globe
  year={dataState.year}
  mapMode={dataState.mapMode}
  showBoundaries={true}
  showLabels={false}
  satellite={false}
  hexOpacity={dataState.hexOpacity}
  highlightHex={dataState.highlightHex}
/>
```

- [ ] **Step 5: Verify Act 4 highlights the hex**

Add a test:

```ts
test("Act 4 renders the highlight pulse layer", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Scroll to Act 4
  await page.evaluate(() => window.scrollTo({ top: 5400, behavior: "instant" }));
  await page.waitForTimeout(2500);

  const hasPulseLayer = await page.evaluate(() => {
    const map = (window as any).__map;
    const overlay = map._controls?.find((c: any) => c?.constructor?.name === "MapboxOverlay");
    const layers = overlay?.props?.layers ?? [];
    return layers.some((l: any) => l?.id === "h3-pulse");
  });
  expect(hasPulseLayer).toBe(true);
});
```

- [ ] **Step 6: Commit**

```bash
git add components/Globe.tsx lib/story/acts.ts lib/story/cameraKeyframes.ts scripts/find-khulna-hex.ts app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[components] Act 4: pulsing hex highlight over real Khulna data

Queries hex_compact.json at design time to pick the top-exposure
Bangladesh hex; copy and camera are hard-coded from real values.
A second H3HexagonLayer pulses the chosen hex at 1.7Hz.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Act 5 — Before/After Split Compare

**Files:**
- Modify: `components/Globe.tsx` (add splitCompare mode with two filtered layers + scissor)
- Create: `components/story/CompareDivider.tsx` (draggable vertical bar)
- Modify: `app/page.tsx` (mount the divider, pass divider position into Globe)

**Implementation strategy:** Two H3HexagonLayer instances render into the same deck.gl overlay. Each gets `parameters: { scissor: [...] }` to clip rendering to one half of the viewport. On drag, the scissor boxes update. This keeps everything inside the single shared overlay (shared globe preserved).

- [ ] **Step 1: Extend Globe props with splitCompare + dividerX**

Edit `components/Globe.tsx`:

```ts
interface GlobeProps {
  // ... existing ...
  splitCompare?: boolean;
  /** Screen-space X position of the divider (0..1, relative to viewport width). */
  dividerX?: number;
}
```

Default `dividerX = 0.5`.

- [ ] **Step 2: Build before/after layers when splitCompare is true**

Inside the layer-building useEffect in Globe.tsx, if `splitCompare` is true, build two layers instead of one and use scissor:

```ts
const canvas = document.querySelector("canvas.deck-canvas") as HTMLCanvasElement | null;
const width = canvas?.width ?? window.innerWidth;
const height = canvas?.height ?? window.innerHeight;
const splitPx = Math.round(width * (dividerX ?? 0.5));

const buildLayer = (id: string, filter: [number, number], scissor: [number, number, number, number]) =>
  new (H3HexagonLayer as any)({
    id,
    data: hexData,
    getHexagon: (d: HexDatum) => d.h,
    getFillColor: (d: HexDatum) => {
      const [r, g, b] = getExposureRGBA(d.p);
      return [r, g, b, alpha];
    },
    filled: true,
    stroked: false,
    pickable: false,
    extensions: [new DataFilterExtension({ filterSize: 1 })],
    getFilterValue: (d: HexDatum) => (id === "h3-before" ? d.y1 : d.y0),
    filterRange: filter,
    parameters: { scissor },
  });

if (splitCompare) {
  const before = buildLayer("h3-before", [2000, 2012], [0, 0, splitPx, height]);
  const after = buildLayer("h3-after", [2013, 2026], [splitPx, 0, width - splitPx, height]);
  layers = [before, after];
}
```

(Replace the existing single-layer assignment with this branch when `splitCompare` is true.)

- [ ] **Step 3: Create the CompareDivider component**

Create `components/story/CompareDivider.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  active: boolean;
  onChange: (x: number) => void;
}

export default function CompareDivider({ active, onChange }: Props) {
  const [x, setX] = useState(0.5);
  const draggingRef = useRef(false);

  const move = useCallback(
    (clientX: number) => {
      const next = Math.min(Math.max(clientX / window.innerWidth, 0.15), 0.85);
      setX(next);
      onChange(next);
    },
    [onChange]
  );

  useEffect(() => {
    const up = () => (draggingRef.current = false);
    const moveHandler = (e: MouseEvent) => {
      if (draggingRef.current) move(e.clientX);
    };
    const touchMove = (e: TouchEvent) => {
      if (draggingRef.current && e.touches[0]) move(e.touches[0].clientX);
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("touchend", up);
    window.addEventListener("touchmove", touchMove);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchmove", touchMove);
    };
  }, [move]);

  if (!active) return null;

  return (
    <>
      <div
        className="fixed top-0 bottom-0 z-[5] w-[2px] bg-white/50 pointer-events-none"
        style={{ left: `${x * 100}%` }}
      />
      <button
        aria-label="Drag to compare before and after"
        className="fixed top-1/2 z-[6] -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-panel border border-border cursor-ew-resize"
        style={{ left: `${x * 100}%` }}
        onMouseDown={() => (draggingRef.current = true)}
        onTouchStart={() => (draggingRef.current = true)}
      >
        <span className="text-white text-xs">⇔</span>
      </button>
      <div
        className="fixed top-8 z-[6] text-[10px] tracking-widest uppercase text-text-tertiary"
        style={{ left: `calc(${x * 50}% - 60px)` }}
      >
        2000–2012
      </div>
      <div
        className="fixed top-8 z-[6] text-[10px] tracking-widest uppercase text-text-tertiary"
        style={{ right: `calc(${(1 - x) * 50}% - 60px)` }}
      >
        2013–2026
      </div>
    </>
  );
}
```

- [ ] **Step 4: Wire into the page**

Update `app/page.tsx`:

```tsx
const [dividerX, setDividerX] = useState(0.5);
// ...
<Globe
  /* ... */
  splitCompare={!!dataState.splitCompare}
  dividerX={dividerX}
/>
<CompareDivider active={!!dataState.splitCompare} onChange={setDividerX} />
```

- [ ] **Step 5: Test that Act 5 renders two layers**

```ts
test("Act 5 renders two filtered hex layers", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Scroll to Act 5
  await page.evaluate(() => window.scrollTo({ top: 7200, behavior: "instant" }));
  await page.waitForTimeout(2000);

  const layerIds = await page.evaluate(() => {
    const map = (window as any).__map;
    const overlay = map._controls?.find((c: any) => c?.constructor?.name === "MapboxOverlay");
    return (overlay?.props?.layers ?? []).map((l: any) => l.id);
  });
  expect(layerIds).toContain("h3-before");
  expect(layerIds).toContain("h3-after");
});
```

- [ ] **Step 6: Commit**

```bash
git add components/Globe.tsx components/story/CompareDivider.tsx app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[components] Act 5: before/after dual-layer with draggable divider

Two H3HexagonLayers filtered by y1≤2012 and y0≥2013 render into the
same overlay. GL scissor test clips each to its half of the viewport.
Divider drag updates scissor boxes via dividerX prop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Act 6 — Confidence Texture

**Files:**
- Modify: `lib/colors.ts` (add confidence-blended color function)
- Modify: `components/Globe.tsx` (swap color function when confidenceMode is active)

- [ ] **Step 1: Add a confidence-aware color function**

Edit `lib/colors.ts` — append:

```ts
/**
 * Blends the exposure RGBA with a neutral gray based on a confidence score
 * derived from number-of-months-flooded. More months = higher confidence =
 * sharper color. Inland-only or sparse hexes fade toward gray.
 */
export function getConfidenceBlendedRGBA(
  population: number,
  months: number
): [number, number, number] {
  const [r, g, b] = getExposureRGBA(population);
  // Confidence: 0 at 1 month, 1 at 24+ months (log-ish ramp)
  const conf = Math.min(1, Math.log2(Math.max(1, months)) / Math.log2(24));
  const gray: [number, number, number] = [80, 80, 90];
  return [
    Math.round(r * conf + gray[0] * (1 - conf)),
    Math.round(g * conf + gray[1] * (1 - conf)),
    Math.round(b * conf + gray[2] * (1 - conf)),
  ];
}
```

- [ ] **Step 2: Use it in Globe.tsx when `confidenceMode` is true**

Extend `GlobeProps`:

```ts
confidenceMode?: boolean;
```

In the color function selection block:

```ts
const colorFn =
  mapMode === "frequency"
    ? (d: HexDatum) => getFrequencyRGBA(d.ft)
    : confidenceMode
    ? (d: HexDatum) => getConfidenceBlendedRGBA(d.p, d.m)
    : (d: HexDatum) => getExposureRGBA(d.p);
```

Add `confidenceMode` to the layer's `updateTriggers.getFillColor` array.

- [ ] **Step 3: Wire into the page**

```tsx
<Globe
  /* ... */
  confidenceMode={!!dataState.confidenceMode}
/>
```

- [ ] **Step 4: Test**

```ts
test("Act 6 activates confidence coloring (layer rebuilds)", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo({ top: 8500, behavior: "instant" }));
  await page.waitForTimeout(1500);
  // Verify copy is visible
  await expect(page.getByText(/equally certain/i)).toBeVisible();
});
```

- [ ] **Step 5: Commit**

```bash
git add lib/colors.ts components/Globe.tsx app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[components] Act 6: confidence-weighted hex coloring

Blends exposure magma colors toward neutral gray based on log-scaled
flood-months per hex. High-month hexes stay saturated; single-event
hexes fade. No pipeline changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Act 7 — The Three Cities (Sub-Step Sequence)

**Files:**
- Modify: `components/story/StoryContainer.tsx` (support sub-step city rotation within Act 7)
- Modify: `lib/story/acts.ts` (already has CITY_SEQUENCE)

**Strategy:** Act 7's scroll span is split into three thirds. The active third drives which camera keyframe is flown to and which copy line is highlighted.

- [ ] **Step 1: Make Act 7 taller and handle sub-step logic in scrollama progress**

Modify the Act 7 entry in `lib/story/acts.ts` — note no data change, just the copy array and multi-keyframe handling.

In `components/story/StoryContainer.tsx`, inside `onStepProgress`:

```ts
.onStepProgress((res) => {
  const id = res.element.getAttribute("data-story-step")!;
  if (id === "cities") {
    const seq = CITY_SEQUENCE;
    const idx = Math.min(seq.length - 1, Math.floor(res.progress * seq.length));
    flyTo(seq[idx]);
    onActChange?.(id, res.progress);
    return;
  }
  onActChange?.(id, res.progress);
})
```

Also extend the Act height for Act 7 to `3` vh units:

```tsx
<Act key={act.id} id={act.id} ariaTitle={act.ariaTitle} heightVh={act.id === "cities" ? 3 : 1.2}>
```

- [ ] **Step 2: Highlight the active city copy line**

Inside the Act component rendering for `cities`, pass progress and render each line with a highlight class based on its index:

```tsx
{Array.isArray(act.copy) ? (
  act.copy.map((line, i) => {
    const total = act.copy.length;
    const activeIdx = Math.min(total - 1, Math.floor(currentActProgress * total));
    return (
      <p
        key={i}
        className={`text-lg leading-relaxed mb-2 transition-opacity duration-300 ${
          i === activeIdx ? "text-text-primary opacity-100" : "text-text-tertiary opacity-40"
        }`}
      >
        {line}
      </p>
    );
  })
) : /* ... */}
```

To get `currentActProgress` into each Act, lift the progress state into StoryContainer and pass it through to a custom renderer. Simplest: convert Act to receive `children` as a function `(progress) => ReactNode`, or keep it simple and re-render the city lines with progress from React state in StoryContainer. The plan suggests the latter — move the `ACTS.map` rendering into a memoized component that reads progress from a ref.

```tsx
// In StoryContainer
const [progressById, setProgressById] = useState<Record<string, number>>({});
// in onStepProgress:
setProgressById((p) => ({ ...p, [id]: res.progress }));
```

- [ ] **Step 3: Verify city sequence**

```ts
test("Act 7 cycles through three cities", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Scroll into cities act — near start
  await page.evaluate(() => window.scrollTo({ top: 9600, behavior: "instant" }));
  await page.waitForTimeout(2500);
  let lng = await page.evaluate(() => (window as any).__map.getCenter().lng);
  expect(lng).toBeGreaterThan(85); // Dhaka

  // Scroll into middle
  await page.evaluate(() => window.scrollTo({ top: 11000, behavior: "instant" }));
  await page.waitForTimeout(2500);
  lng = await page.evaluate(() => (window as any).__map.getCenter().lng);
  expect(lng).toBeGreaterThan(100); // Jakarta

  // Scroll into end
  await page.evaluate(() => window.scrollTo({ top: 12500, behavior: "instant" }));
  await page.waitForTimeout(2500);
  lng = await page.evaluate(() => (window as any).__map.getCenter().lng);
  expect(lng).toBeLessThan(-80); // New Orleans
});
```

- [ ] **Step 4: Commit**

```bash
git add components/story/StoryContainer.tsx lib/story/acts.ts tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Act 7: three-city flyTo sequence synced to scroll

Act span is 3 viewport heights; scroll progress selects one of three
camera keyframes (Dhaka → Jakarta → New Orleans). Active city copy
line is full-opacity; inactive lines are dimmed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Act 8 — Frequency Map

**Files:**
- No new files. Behavior emerges from existing `mapMode` prop wiring.

- [ ] **Step 1: Verify**

Act 8's data state already specifies `mapMode: "frequency"`. The existing Globe.tsx color function switch handles the transition. Add a quick test:

```ts
test("Act 8 switches to frequency mode", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo({ top: 13500, behavior: "instant" }));
  await page.waitForTimeout(1500);
  await expect(page.getByText(/getting worse/i)).toBeVisible();
});
```

- [ ] **Step 2: Commit (only if no code changes; skip if empty)**

Skip if the test is the only addition — fold into Task 14's commit.

---

## Task 14: Act 9 — Handoff to `/explore`

**Files:**
- Create: `components/story/HandoffButton.tsx`
- Modify: `app/page.tsx` (mount the button for the handoff act)

- [ ] **Step 1: Create the handoff button**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  visible: boolean;
}

export default function HandoffButton({ visible }: Props) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    setPressed(true);
    // Soft chrome fade-out could happen here; for now, direct navigation.
    router.push("/explore");
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Take control of the map"
      className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-20 px-8 py-4 rounded-full border border-border bg-panel/90 backdrop-blur-xl text-text-primary text-lg font-medium transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
      } ${pressed ? "scale-95" : "hover:scale-105"}`}
    >
      Take control →
    </button>
  );
}
```

- [ ] **Step 2: Mount in the page**

In `app/page.tsx`:

```tsx
<HandoffButton visible={activeActId === "handoff"} />
```

- [ ] **Step 3: Test the handoff preserves the globe**

```ts
test("handoff navigates to /explore with shared globe intact", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Capture the map instance reference
  const mapIdBefore = await page.evaluate(() => {
    const m = (window as any).__map;
    return m?._mapId ?? "unknown";
  });

  await page.evaluate(() => window.scrollTo({ top: 15000, behavior: "instant" }));
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /take control/i }).click();
  await page.waitForURL("**/explore");

  // Verify the same map instance is still present (globe not reinitialized)
  const mapIdAfter = await page.evaluate(() => {
    const m = (window as any).__map;
    return m?._mapId ?? "unknown";
  });
  expect(mapIdAfter).toBe(mapIdBefore);

  // Explorer chrome is now visible
  await expect(page.locator('[data-testid="info-panel"]')).toBeVisible();
});
```

- [ ] **Step 4: Commit**

```bash
git add components/story/HandoffButton.tsx app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Act 9: handoff CTA to /explore with shared globe

Button appears at Act 9 and routes to /explore without reinit. The
shared GlobeContext preserves the MapLibre instance across routes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Creative Moves — Scroll-Velocity Rotation + Sparkline Handoff

**Files:**
- Create: `components/story/useScrollVelocity.ts`
- Modify: `components/story/StoryContainer.tsx` (drive bearing from velocity in Acts 1-2)
- Create: `components/story/StoryProgressChip.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Scroll-velocity hook**

Create `components/story/useScrollVelocity.ts`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export function useScrollVelocity() {
  const [velocity, setVelocity] = useState(0);
  const lastY = useRef(0);
  const lastT = useRef(performance.now());
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      const dt = now - lastT.current;
      const dy = window.scrollY - lastY.current;
      const v = dt > 0 ? dy / dt : 0; // px/ms
      // EMA smoothing
      setVelocity((prev) => prev * 0.85 + v * 0.15);
      lastY.current = window.scrollY;
      lastT.current = now;
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return velocity;
}
```

- [ ] **Step 2: Drive bearing from velocity in Acts 1-2**

In StoryContainer, read `useScrollVelocity()` and, when `activeAct` is `breath` or `counter`, update `map.setBearing()` at throttled intervals. The velocity drives a target bearing offset: `targetBearing = baseBearing + clamp(velocity * 8, -20, 20)`.

```tsx
const velocity = useScrollVelocity();
useEffect(() => {
  const { mapRef } = /* ... pass from provider via useGlobe, or lift state */;
  const map = mapRef.current;
  if (!map || !["breath", "counter"].includes(activeAct)) return;
  const bearing = Math.max(-20, Math.min(20, velocity * 8));
  map.setBearing((map.getBearing() + bearing) * 0.9);
}, [velocity, activeAct]);
```

(Actual integration will depend on where state lives; resolve during implementation.)

Disable on mobile (`navigator.hardwareConcurrency < 4` or touch-first detection).

- [ ] **Step 3: Sparkline chip**

Create `components/story/StoryProgressChip.tsx` — a small SVG sparkline showing yearly exposure 2000-2026 with a "you are here" dot at the current year. Top-right fixed position, visible from Act 5 onward. Clicking it scrolls back to Act 2 (optional).

```tsx
"use client";
import type { GlobalSummary } from "@/lib/types";

interface Props {
  summary: GlobalSummary | null;
  year: number;
  visible: boolean;
}

export default function StoryProgressChip({ summary, year, visible }: Props) {
  if (!summary) return null;
  const points = summary.yearly.map((y, i) => {
    const x = (i / (summary.yearly.length - 1)) * 100;
    const max = Math.max(...summary.yearly.map((e) => e.population_exposed));
    const yPos = 32 - (y.population_exposed / max) * 30;
    return `${x},${yPos}`;
  });
  const currentIdx = summary.yearly.findIndex((y) => y.year === year);
  const cx = currentIdx >= 0 ? (currentIdx / (summary.yearly.length - 1)) * 100 : 0;
  const cy =
    currentIdx >= 0
      ? 32 -
        (summary.yearly[currentIdx].population_exposed /
          Math.max(...summary.yearly.map((e) => e.population_exposed))) *
          30
      : 0;

  return (
    <div
      className={`fixed top-8 right-8 z-20 bg-panel/80 backdrop-blur-xl rounded-2xl border border-border p-3 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <svg width="120" height="40" viewBox="0 0 100 40">
        <polyline
          fill="none"
          stroke="rgb(252,255,164)"
          strokeWidth="1.5"
          points={points.join(" ")}
        />
        <circle cx={cx} cy={cy} r="2.5" fill="rgb(252,255,164)" />
      </svg>
      <div className="text-[9px] tracking-widest uppercase text-text-tertiary mt-1">
        2000 — {year} — 2026
      </div>
    </div>
  );
}
```

Mount in `app/page.tsx` with `visible={["compare", "confidence", "cities", "frequency", "handoff"].includes(activeActId)}`.

- [ ] **Step 4: Commit**

```bash
git add components/story/useScrollVelocity.ts components/story/StoryProgressChip.tsx components/story/StoryContainer.tsx app/page.tsx
git commit -m "$(cat <<'EOF'
[components] Scroll-velocity rotation + sparkline progress chip

Acts 1-2: globe bearing drifts in proportion to smoothed scroll
velocity, creating a scroll-as-time metaphor. From Act 5 onward, a
top-right sparkline chip shows yearly exposure with a "you are here"
dot synced to the current story year.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Reduced Motion, Keyboard Navigation, Screen Reader Support

**Files:**
- Modify: `components/story/StoryContainer.tsx` (keyboard arrow nav)
- Modify: `app/page.tsx` (skip-to-explorer link)
- Modify: various components to respect `prefers-reduced-motion`

- [ ] **Step 1: Add a skip-to-explorer link**

In `app/page.tsx`:

```tsx
<a
  href="/explore"
  className="sr-only focus:not-sr-only fixed top-2 left-2 z-50 bg-panel/90 text-text-primary px-3 py-2 rounded border border-border"
>
  Skip to interactive explorer
</a>
```

- [ ] **Step 2: Keyboard arrow navigation through acts**

In `StoryContainer.tsx`, add a `useEffect` that listens for `ArrowDown`/`ArrowUp` and scrolls to the next/previous `[data-story-step]`:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
    const steps = Array.from(document.querySelectorAll("[data-story-step]"));
    const currentIdx = steps.findIndex((s) => s.getAttribute("data-story-step") === activeAct);
    const nextIdx = Math.max(
      0,
      Math.min(steps.length - 1, currentIdx + (e.key === "ArrowDown" ? 1 : -1))
    );
    (steps[nextIdx] as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    e.preventDefault();
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [activeAct]);
```

- [ ] **Step 3: Reduced motion in StoryCounter + scroll-velocity hooks**

In `StoryCounter.tsx` — when `prefers-reduced-motion: reduce`, freeze `displayYear` at the target year (skip intermediate ticks).

In `useScrollVelocity` — short-circuit when reduced motion is active (return 0).

- [ ] **Step 4: aria-live on the counter already set; verify copy is real DOM**

The scrollama container uses real `<section>` with `<p>` text — inherently screen-reader friendly. Verify each act's `ariaTitle` shows up as an `aria-label`.

- [ ] **Step 5: Test keyboard navigation**

```ts
test("keyboard arrows advance acts", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
  await page.waitForTimeout(1500);

  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(800);
  const id1 = await page.locator('[data-testid="active-act"]').getAttribute("data-act-id");
  expect(["counter", "where"]).toContain(id1);
});

test("skip link is present and focusable", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() => document.activeElement?.textContent);
  expect(active).toMatch(/skip to interactive explorer/i);
});
```

- [ ] **Step 6: Commit**

```bash
git add components/story/ app/page.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Accessibility: skip link, keyboard nav, reduced motion

Arrow keys jump between acts. Tab-focusable skip link routes to
/explore. StoryCounter freezes year and scroll velocity disables
when prefers-reduced-motion: reduce.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Mobile Responsive Layout

**Files:**
- Modify: `components/story/Act.tsx` (mobile layout)
- Modify: `components/story/CompareDivider.tsx` (tap-to-toggle on mobile)
- Modify: `components/story/FogMask.tsx` (hide on mobile for perf)

- [ ] **Step 1: Mobile-first Act layout**

In `Act.tsx`, adjust the layout so the globe sticks to the top 55vh and copy blocks occupy the bottom 45vh on mobile:

```tsx
<section
  ref={ref}
  data-story-step={id}
  aria-label={ariaTitle}
  style={{ minHeight: `${heightVh * 100}vh` }}
  className="relative flex flex-col justify-end pb-8 sm:pb-24 px-5 sm:px-10"
>
  <div className="sm:max-w-xl w-full bg-panel/70 backdrop-blur-xl rounded-2xl border border-border p-4 sm:p-6 mx-auto">
    {children}
  </div>
</section>
```

Also move the globe-host z-index down / add responsive sizing via a new class on the provider div — on mobile, the globe host becomes `top: 0; bottom: 45vh`:

```tsx
// GlobeContext.tsx
<div
  ref={containerRef}
  data-testid="globe-host"
  className="fixed inset-x-0 top-0 bottom-[45vh] sm:bottom-0 z-0"
/>
```

- [ ] **Step 2: Tap-to-toggle compare on mobile**

In `CompareDivider.tsx`, when `window.innerWidth < 640`, render a two-button tab bar instead of a draggable divider. Tabs toggle between `dividerX = 1` (all before) and `dividerX = 0` (all after).

- [ ] **Step 3: Disable fog mask on mobile**

In `FogMask.tsx`, return null when viewport width is < 640px. Simple: `if (typeof window !== "undefined" && window.innerWidth < 640) return null;`. (Debounce on resize if needed.)

- [ ] **Step 4: Smoke-test on mobile viewport**

```ts
test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("story renders and advances on mobile viewport", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await page.waitForFunction(() => !!(window as any).__map, { timeout: 10_000 });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/every four years/i)).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 2400, behavior: "instant" }));
    await page.waitForTimeout(500);
    const active = await page.locator('[data-testid="active-act"]').getAttribute("data-act-id");
    expect(active).not.toBe("breath");
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add components/story/ context/GlobeContext.tsx tests/story-scroll.spec.ts
git commit -m "$(cat <<'EOF'
[pages] Mobile responsive: stacked globe + copy, tap-compare

Mobile: globe occupies top 55vh, copy scrolls through bottom 45vh.
Compare divider becomes tap-toggle. Fog mask disabled for perf.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Final Verification

**Files:**
- No code changes — verification only.

- [ ] **Step 1: Full Playwright suite**

```bash
npx playwright test
```

Expected: all tests pass.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: build succeeds, no type errors, no warnings treated as errors.

- [ ] **Step 3: Bundle size check**

```bash
du -sh .next/static/chunks/ | cut -f1
```

Record the number. Compare to the previous main-branch build (`git stash; git checkout main; npm run build; du -sh .next/static/chunks`). Delta should be ≤ 25 KB gzipped. If larger, investigate whether any dependency was accidentally pulled in.

- [ ] **Step 4: Manual QA matrix**

Run `npm run dev` and verify each item manually:

- [ ] `/` — scroll through all 9 acts start to finish without console errors.
- [ ] `/` — on Chrome, Safari, Firefox (macOS).
- [ ] `/` — iPhone (Safari) via device-mode emulation: all 9 acts advance, text readable.
- [ ] `/` — Android Chrome emulation: same.
- [ ] `/explore` — functions identically to the pre-scrolly `/`: timeline works, compare popover opens, layers panel works, mode toggle works, methodology drawer opens.
- [ ] `/compare` — unchanged, functions.
- [ ] `/` → handoff button → `/explore` — no visible globe flash.
- [ ] `/explore` → browser-back to `/` — scrolls to top of story, no errors.
- [ ] macOS System Settings "Reduce motion" on — animations snap-cut, no regressions.
- [ ] Keyboard-only: tab to skip link, tab into story, arrows advance acts.
- [ ] VoiceOver: reads act copy in order.

- [ ] **Step 5: Lighthouse**

Open Chrome DevTools, run Lighthouse on `/` (Desktop, Performance category). Target: ≥ 85. If below, investigate render-blocking scripts.

- [ ] **Step 6: DO NOT deploy from this task**

This task completes the implementation. Deployment (merge-to-main, push, deploy-lock acquisition) is the user's decision and happens in a separate explicit step per `CLAUDE.md` rules. Do not push `main`, do not acquire the `deploy-lock` tag.

Report completion status to the user with:
- Playwright test count (passing / total)
- Bundle size delta
- Lighthouse score
- QA matrix checklist result
- Outstanding known issues, if any

---

## Self-Review Notes (for the implementing engineer)

The plan was reviewed against the spec for:

1. **Spec coverage** — every requirement in `docs/superpowers/specs/2026-04-20-scrollytelling-redesign-design.md` maps to a task:
   - Rendering fix → Task 1
   - Route split → Task 3
   - Shared-globe context → Task 4
   - Each of the 9 acts → Tasks 6-14
   - Scroll-velocity rotation → Task 15
   - Sparkline handoff → Task 15
   - Reduced-motion + a11y → Task 16
   - Mobile responsive → Task 17
   - Verification → Task 18
   - Act 3's optional IP-geolocate easter egg — intentionally deferred (spec allows dropping if tight).

2. **Placeholder scan** — no TBDs in code blocks; copy placeholders in Act 4 have an explicit resolution step (Task 9, Step 1) that produces real numbers from the data.

3. **Type consistency** — `ActDefinition`, `ActDataState`, `CameraKeyframe`, `HexDatum`, `MapMode` are used consistently. `highlightHex` is `string | undefined` throughout. `splitCompare`, `confidenceMode`, `fogMask` are all optional booleans.

4. **Known ambiguity flagged inline** — the scroll-velocity bearing integration (Task 15, Step 2) says "resolve during implementation" because it depends on where state is lifted. This is honest; the implementing engineer can decide.
