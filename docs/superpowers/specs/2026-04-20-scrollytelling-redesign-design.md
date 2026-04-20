# FloodPulse Scrollytelling Redesign — Design Spec

**Date:** 2026-04-20
**Author:** Michael Sparks + Claude
**Status:** Draft for review

## Summary

Two connected changes to FloodPulse:

1. **Fix the globe-projection rendering bug** where rectangular black regions appear in the hex layer at tilt + zoom. Root cause: deck.gl `interleaved: true` rendering shares MapLibre's depth buffer, and MapLibre's globe horizon clipping plane z-kills hex fragments. Fix: force `interleaved: false` (overlaid canvas).

2. **Reframe the home page as a 9-act scrollytelling narrative.** The existing interactive explorer moves to `/explore`. `/` becomes a cinematic scroll-driven story that hands off seamlessly to the explorer without reloading the globe. Shared camera, shared data layer, two UI modes.

Decisions made upfront: **Option B** (story as front door, explorer as destination); rendering **fix #1 alone** (no belt-and-suspenders); **all 9 acts** retained.

## Goals

- Eliminate the rectangular hex-clipping artifact at all zoom and tilt angles.
- Convert the first-visit experience from "dashboard" to "narrative → dashboard."
- Preserve the existing explorer wholesale — do not regress any current functionality.
- Ship a piece that passes a grading bar set by an Airbnb design exec and a Google staff SWE.
- Keep data pipeline untouched. No changes to `hex_compact.json`, the Python ETL, or any parquet outputs.

## Non-Goals

- No changes to the H3 pipeline (`pipeline/01–05_*.py`).
- No changes to the comparison page (`/compare`).
- No changes to the methodology drawer content.
- No new data fetches beyond what `/explore` already loads.
- No CMS or editable-story backend. Copy is in-repo as TypeScript constants.
- No per-user personalization beyond an optional IP geolocation easter egg (Act 3 enhancement — see Act 3 notes).

## Part 1 — The Rendering Fix

### Root Cause

MapLibre 5.x globe projection uses `u_projection_clipping_plane` to clip fragments behind the horizon. deck.gl's shaders don't compute their `gl_Position.z` against this plane. In `interleaved: true` mode, deck.gl writes into MapLibre's shared depth buffer, so whole screen-space regions of the H3 hex layer get fragment-discarded at certain tilt/zoom combinations — producing the rectangular black artifacts.

Tracked upstream: [mapbox-gl-js#13574](https://github.com/mapbox/mapbox-gl-js/issues/13574), [deck.gl#7920](https://github.com/visgl/deck.gl/issues/7920), [deck.gl#9554](https://github.com/visgl/deck.gl/issues/9554).

### The Fix

One-line change in `components/Globe.tsx` around line 344. Replace the current try/fallback with unconditional overlaid mode:

```ts
// Before
const overlay = new MapboxOverlay({ interleaved: true, layers: [layer] });

// After
const overlay = new MapboxOverlay({ interleaved: false, layers: [layer] });
```

Delete the `interleaved: true` try-block and the fallback try-block. Replace with a single construction.

### Consequences

- Lose 3D-terrain occlusion (we don't use 3D terrain → no visible change).
- Lose `beforeId` layer slotting (we don't slot deck.gl between MapLibre layers → no visible change).
- Pick/hover/click behavior is unchanged.
- Render order becomes: MapLibre basemap → MapLibre country borders → MapLibre labels → **separate deck.gl canvas on top**. No z-fighting possible.

### Verification

- Run the existing Playwright `tests/hex-stability.spec.ts` suite — must still pass.
- Manual: load the globe at zoom 2.5, tilt 20°, rotate through all continents. Screenshot each cardinal view. No rectangular black regions.
- Manual: zoom to 5.5 on Bangladesh, tilt 40°. No clipping.

## Part 2 — The Scrollytelling Narrative

### Architecture: Option B (Shared-Globe Handoff)

- `/` — new scrollytelling narrative (this work).
- `/explore` — the existing home page moves here, unchanged except for route.
- A shared globe instance lives in a React context (`GlobeContext`) above both routes so that navigating from `/` → `/explore` does not destroy and recreate the MapLibre map.
- `/compare` — unchanged.

```
app/
  layout.tsx              # wraps children in <GlobeProvider>
  page.tsx                # NEW — scrollytelling route
  explore/
    page.tsx              # MOVED from app/page.tsx, unchanged logic
  compare/page.tsx        # unchanged
components/
  Globe.tsx               # unchanged except: interleaved:false
  story/
    StoryContainer.tsx    # scroll container + sticky globe slot
    Act.tsx               # single act with scrollama hook
    ActCopy.tsx           # typography + entry animations
    StoryProgress.tsx     # top-of-page progress chip
    HandoffButton.tsx     # final "Take control →" CTA
  [existing components preserved]
lib/
  story/
    acts.ts               # array of ActDefinition — copy + keyframes
    cameraKeyframes.ts    # viewState interpolation targets per act
    storyTypes.ts         # TypeScript types for acts + keyframes
context/
  GlobeContext.tsx        # shared MapLibre instance + hex data cache
```

### Shared-Globe Handoff Mechanism

Current `components/Globe.tsx` owns its own MapLibre instance in a `useRef` inside the component. To enable the handoff we hoist that instance into `GlobeContext`:

- `GlobeProvider` (mounted in `app/layout.tsx`) owns:
  - `mapRef` — the `maplibregl.Map` instance
  - `overlayRef` — the deck.gl `MapboxOverlay`
  - `hexDataRef` — the parsed hex data array
  - `containerRef` — a div portal where the map canvas is attached
- The provider renders a single fixed-position `<div>` at `z-index: 0, inset: 0` that acts as the canvas host.
- Both `/` and `/explore` render a positioning shell that styles/moves the provider div via CSS classes, but never unmounts it.
- Route transitions animate the viewState (via deck.gl transitions) + the chrome. The map never reinitializes.

**Rationale:** This is the move that makes the piece feel seamless — no map-tile reflash between story and explorer. It's also the single highest-risk part of the architecture. See "Risks" below.

### Scrollytelling Library Choice

**`scrollama.js`** (~2 KB, single-purpose, battle-tested at ProPublica/WaPo/NYT).

- `step.enter` / `step.exit` → trigger act transitions
- `progress: true` → gives 0–1 scroll progress per step, used for continuous camera interpolation and scroll-velocity rotation
- `offset: 0.5` → steps fire at viewport center (standard)
- IntersectionObserver under the hood; no scroll-event spam

Alternatives considered and rejected:
- Framer Motion scroll-linked animations: heavier, more opinionated, conflicts with deck.gl transitions.
- Custom IntersectionObserver: rebuilds what scrollama already gives us.
- GSAP ScrollTrigger: overkill + license concerns for a portfolio piece.

### Camera Choreography

Each act defines a `CameraKeyframe`:

```ts
type CameraKeyframe = {
  center: [number, number];   // lng, lat
  zoom: number;
  pitch: number;
  bearing: number;
  duration: number | 'auto';  // 'auto' scales by great-circle distance
  easing?: (t: number) => number;
};
```

On `step.enter`, fire `map.flyTo(keyframe)` and let MapLibre handle the tween. For `progress`-driven camera motion (scroll-velocity rotation, Act 2's year advance), update `map.jumpTo()` only for rotation bearing and drive the `year` state directly from progress.

### The 9 Acts — Exact Definitions

Each act has: **trigger** (scroll position), **copy** (exact text), **camera** (keyframe), **data state** (year / mode / highlighted hex), **motion** (progress-driven animations).

#### Act 1 — The Breath
- **Copy:** "Every four years, the number of people living in flooded places doubles."
- **Camera:** `{ center: [20, 15], zoom: 0.8, pitch: 15, bearing: 0 }` with continuous 0.1°/s rotation driven by scroll progress.
- **Data:** exposure mode, year = 2000, opacity = 0.3.
- **Chrome:** no UI. Just the globe and one line of copy bottom-center.

#### Act 2 — The Counter Wakes ⭐ signature moment
- **Copy:** "86 million people. Up from 40 million in the year 2000."
- **Camera:** `{ center: [20, 15], zoom: 1.6, pitch: 10, bearing: scrollProgress * 20 }`.
- **Data:** year advances 2000 → 2026 linearly with scroll progress within this act. Hexes ignite chronologically via existing `filterRange: [0, year]` mechanism.
- **UI:** animated counter top-left tied to `year`. Counter reads `summary.yearly[year].population_exposed`.
- **Motion:** scroll-velocity modulates both globe rotation and counter tick rate.

#### Act 3 — Where Are They?
- **Copy:** "One in four of them lives here — in a country the size of Iowa."
- **Camera:** `{ center: [90, 23.7], zoom: 4.5, pitch: 30, bearing: 0, duration: 'auto' }` → Bangladesh.
- **Data:** year = 2026, opacity = 0.9.
- **Chrome:** radial fog mask darkens everything outside a 600px circle around the camera target (SVG overlay, pointer-events: none).
- **Easter egg (optional, can drop if tight):** IP-geolocate the visitor on page load. If they're within a flood-exposed hex, show a small "Or your home" link that jumps to Act 4 centered on their hex.

#### Act 4 — One Hex, One Story
- **Copy:** "This single hexagon. 360,000 people. Flooded in 22 of the last 26 years. A return period under 1.2."
- **Camera:** `{ center: <Khulna hex centroid>, zoom: 5.5, pitch: 45, bearing: 0, duration: 'auto' }`.
- **Data:** highlight one specific H3 index (`851e3597fffffff` — Khulna; exact index selected at spec-review time by querying the top-exposure hex in Bangladesh from `hex_compact.json`).
- **Motion:** target hex pulses at 1.2 Hz via a sine-driven opacity modulation on a second H3HexagonLayer containing just that one hex.

#### Act 5 — The Before / After
- **Copy:** "Drag to compare. The last decade versus the one before."
- **Camera:** `{ center: [20, 15], zoom: 1.6, pitch: 0, bearing: 0, duration: 'auto' }` — back to globe view.
- **Data:** two H3HexagonLayer instances, one filtered to `y1 <= 2012`, one filtered to `y0 >= 2013`. Both render simultaneously. SVG clip-path or CSS mask splits them left/right based on a draggable divider (React-controlled, horizontal).
- **Interaction:** divider draggable; when released, animates back to 50/50.

#### Act 6 — The Confidence Texture
- **Copy:** "Not all of these are equally certain. Coastal hexes have ground truth. Inland rivers are inferred."
- **Camera:** held on globe view.
- **Data:** a blur/noise shader tints hexes by proximity-to-coast and event density. Implementation: add a new numeric field `confidence` to the in-memory HexDatum (computed client-side once from `yf` and `m` — more flood-months = higher confidence), and use it to drive alpha via `getFillColor`. No pipeline change.
- **Motion:** 1.5-second cross-fade from standard coloring to confidence coloring and back.

#### Act 7 — The Three Cities
- **Copy:** three stats, each revealed at its own scroll sub-step:
  - "Dhaka. 2.3 million exposed."
  - "Jakarta. 1.8 million."
  - "New Orleans. 460 thousand."
- **Camera:** sequence of three flyTos, 2.5 seconds each.
  - Dhaka: `[90.4, 23.8], zoom 6.5`
  - Jakarta: `[106.8, -6.2], zoom 6.5`
  - New Orleans: `[-90.1, 29.95], zoom 6.5`
- **Data:** unchanged — just camera motion. Nearest hex auto-highlights on each arrival.

#### Act 8 — The Frequency Map
- **Copy:** "This is where it's getting worse."
- **Camera:** `{ center: [20, 15], zoom: 1.4, pitch: 0, bearing: 0, duration: 'auto' }`.
- **Data:** `mapMode` flips from `"exposure"` to `"frequency"`. Cross-fade duration 1 second (existing `updateTriggers.getFillColor` handles the transition).

#### Act 9 — Now You Try.
- **Copy:** "This is your map. Take control →"
- **Camera:** held.
- **Chrome:** UI chrome for the full explorer fades in over 600ms (timeline, layers panel, compare/methodology buttons, mode toggle).
- **Interaction:** `HandoffButton` triggers `router.push('/explore')`. The `GlobeContext` persists the map instance, so the transition is chrome-only. URL changes, React tree swaps, MapLibre keeps running.

### Additional Creative Moves

These are in-scope for this spec (not future work):

1. **Scroll-velocity globe rotation (Act 1 & 2 only).** Track `d(scrollProgress)/dt` via a 100ms EMA. Map to globe bearing velocity. When reader pauses, decay to a slow drift (0.05°/s). Implementation: a `useScrollVelocity()` hook reads scrollama's progress stream.

2. **Sparkline handoff (Acts 5 → 9).** After Act 5's before/after collapses, the divergence between the two halves morphs into a small sparkline that parks in the top-right as a persistent chip. From Act 6 onward, the chip is the reader's "you are here" indicator. Implementation: a shared `<StoryProgress>` component in the top-right, rendered by `/` only.

3. **Reduced motion fallback.** `prefers-reduced-motion: reduce` converts all flyTo animations to `jumpTo`, disables the breath rotation, freezes the counter at final value, and removes the pulse in Act 4. Scroll steps still advance; the reader just sees snap-cut transitions.

## Part 3 — Responsive & Accessibility

### Mobile (< 760px)

- Globe: 55vh, sticky top.
- Copy: 45vh, scrolls beneath.
- Before/after divider (Act 5) becomes a tap-to-toggle between "before" and "after" layers rather than a drag.
- Three cities (Act 7) becomes vertical stack with short hold times (1.8s each).
- Hide radial fog mask on mobile (performance).

### Accessibility

- All act copy present in the DOM as real text (scrollable, screen-reader accessible). Not inside canvas.
- `aria-live="polite"` on the counter.
- Keyboard users: arrow keys advance one act (`keydown` handler that triggers the next scrollama step programmatically).
- Skip-to-explorer link always present at top of the page (visually hidden until focused).
- No reliance on color alone; mode labels ("Exposure" / "Frequency") always visible in chrome.

### Performance

- Bundle target: current + < 20 KB gzipped for scrollama + story code.
- No new network requests beyond what `/explore` already does.
- Act 6's blur shader is a CSS `filter: blur()` on a second canvas-sized overlay, not a WebGL shader — keeps GPU budget for deck.gl.
- Act 5's dual-layer rendering: reuse the same `hexDataRef` across both layers; only the `getFilterValue` differs. ~30k hexes × 2 layers is still well under GPU budget.

## Part 4 — Copy & Data Accuracy

All copy numbers in the 9 acts must be sourced from `public/data/global_summary.json` or computed at build time from `hex_compact.json`. Hard-coded stats are marked with `{{ TODO: verify from data }}` in the implementation plan and must be replaced before merge.

Specifically:
- Act 1: "doubles every four years" — verify from `summary.yearly[]` series.
- Act 2: 2000 and 2026 exposure numbers — read directly from `summary.yearly`.
- Act 3: "1 in 4 in Bangladesh" — verify from `country_timeseries.json`.
- Act 4: specific hex stats — verify at spec-review time by querying `hex_compact.json` for the top-exposure Bangladesh hex.
- Act 7: three-city stats — compute from hex centroid proximity.

If any copy claim cannot be supported by the data, the copy gets rewritten to match the data. **The data is the source of truth, not the narrative.**

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Shared-globe handoff leaks or re-renders | Medium | High | Feature-flag the shared-globe approach; fallback is to reinitialize on route change (accepts a 1s flash). |
| Scroll velocity rotation feels janky on low-end devices | Medium | Medium | Disable on devices reporting `navigator.hardwareConcurrency < 4` or mobile. |
| Act 4's exact hex has weaker data than the copy suggests | Low | Medium | Spec requires querying the actual hex data before writing copy. Copy adapts to data. |
| Act 5's clip-path divider has cross-browser quirks | Medium | Low | Tested path: SVG `<clipPath>` with `clipPathUnits="objectBoundingBox"`. Known to work Safari 14+. |
| Rendering fix #1 breaks an edge case we didn't screenshot | Low | High | Playwright suite + manual QA pass across zoom/tilt matrix before merge. |
| Users who want the explorer get stuck in the story | Medium | Medium | Persistent "Skip to explore →" link top-right on every act. |

## Test Plan

### Rendering fix
- [ ] Playwright `hex-stability.spec.ts` passes.
- [ ] Manual: 8 cardinal views at zoom 2.5, pitch 20 — no black rectangles.
- [ ] Manual: Bangladesh at zoom 5.5, pitch 40 — no clipping.
- [ ] Manual: satellite mode + globe tilt — no regression.

### Scrollytelling
- [ ] Scroll through all 9 acts on desktop Chrome, Safari, Firefox.
- [ ] Scroll through all 9 acts on iPhone Safari + Android Chrome.
- [ ] `prefers-reduced-motion: reduce` — all transitions are snap-cuts, no crashes.
- [ ] Keyboard-only navigation: arrow keys advance acts.
- [ ] Screen reader (VoiceOver) reads all copy in order.
- [ ] Handoff to `/explore` — globe does not flash, no visible reload.
- [ ] "Skip to explore" link works from every act.
- [ ] `/explore` functions identically to current `/`.
- [ ] `/compare` functions identically.
- [ ] Production build passes (`npm run build`).
- [ ] Lighthouse Performance ≥ 85 on `/` desktop.
- [ ] Bundle size delta ≤ 25 KB gzipped.

## Out of Scope (for this spec)

- Audio / ambient sound.
- Video backgrounds.
- Social sharing cards (OG images for each act).
- Analytics event tracking per act (easy to add later).
- A/B testing the story vs. explorer front door.
- Localizing the copy.

## Open Questions

None — the three decision points (Option, rendering fix scope, acts) are resolved. Implementation plan will handle the remaining technical choices (exact hex for Act 4, progress-driven animation curves, mobile breakpoint specifics).

## Acceptance

This spec is ready for implementation planning. The next step is the `superpowers:writing-plans` skill to produce a sequenced implementation plan.
