# FloodPulse — *The Invisible 90%* Narrative Redesign

**Date:** 2026-04-21
**Author:** Michael Sparks + Claude
**Status:** Draft for review
**Supersedes (narrative only):** `docs/superpowers/specs/2026-04-20-scrollytelling-redesign-design.md`

## Summary

Reframe `/` from the current "population exposed to floods" narrative into a dataset-comparison narrative titled *The Invisible 90%*. The new story argues that Ground Source (Google's flood dataset underpinning FloodPulse) finds roughly ten times more flood-exposed people than the prior gold-standard flood datasets, and that the gap concentrates in the Global South.

Decisions locked upfront:
- **Thesis:** A+C hybrid — *"Satellites saw 913 floods. The world saw 2.6 million. In the same 19 years the old map watched, Ground Source found ten times more flood-exposed people — and most of them live in places the old maps never looked."*
  - Data defence: over the matched window 2000–2018, GFD cumulative PE ≈ 290M; FloodPulse cumulative PE ≈ 2.88B. Ratio ≈ 10×. This is the headline the piece must stand behind. "Ten times more" is the data-supported claim, not "2 billion."
- **Narrative choice:** Option B — keep the `StoryContainer` / `Act` / scrollama infrastructure, retire the current 9 acts, author a new 7-act story in 5 chapters.
- **Data scope:** Build a real per-country comparison pipeline step (`05c_country_comparison.py`) that joins FloodPulse per-country PE to GFD (Tellman 2021) and EM-DAT (Hu 2024) per-country totals.
- **Signature moment:** The Reveal Wipe — globe starts lit only with GFD-observed hexes; a scroll-driven radial wipe from the equator outward fills in the Ground-Source-only hexes, mostly across the Global South.

## Goals

- Pivot the home page narrative from "look at flooding" to "look at what the old flood datasets missed."
- Ship a piece that clears the grading bar set by an Airbnb design executive and a Google staff SWE.
- Add per-country comparison data to the pipeline so the Global South chapter rests on defensible numbers, not hand-waved anecdote.
- Preserve the shared-globe handoff to `/explore` and the `/compare` dashboard. Do not regress existing functionality.
- Data is the source of truth. If a numeric claim cannot be supported by `public/data/*.json`, the copy is rewritten.

## Non-Goals

- No change to `/explore`.
- No change to the H3 pipeline (`pipeline/01_…_04_*.py`).
- No change to the `hex_compact.json` format or the existing `comparison.json` output.
- `/compare` gains one new section (country comparison) but its existing charts are untouched.
- No CMS, no per-user personalization, no audio, no video.
- No localization, no A/B testing infrastructure.

## Narrative Arc — 7 acts in 5 chapters

### Chapter I — The old map

**Act 1: "What the satellites saw."**
- Globe dark. GFD-only hex layer ignites: sparse footprint, lopsided toward US, Europe, major rivers of Asia.
- Copy: *"For two decades, this was our picture of where floods hit people. 913 floods. 290 million people. Two billion missing."*
- Camera: `{ center: [0, 5], zoom: 1.3, pitch: 0, bearing: 0 }` — fully neutral global view.
- Data: GFD-only layer visible at α=0.65; FP-only layer α=0.
- Motion: slow 0.05°/s bearing drift.

### Chapter II — The new map

**Act 2: The Reveal Wipe (signature moment).**
- Ground Source hexes fade in across a scroll-driven radial wipe from the equator outward.
- Copy (reveals with scroll):
  - At 0%: *"Then we stopped asking satellites and started reading the news."*
  - At 50%: *"2.6 million local flood records."*
  - At 100%: *"2.88 billion flood-exposed people — ten times what the satellites found."* (Matched window 2000–2018. If the final build wants a larger/more current number, use 6.3B with "across 2000–2026" explicit in the copy.)
- Camera: held at `{ center: [20, 5], zoom: 1.4, pitch: 0 }`. No flyTo. The wipe is the motion.
- Data: FP-only layer α ramps 0→1 with scroll progress, gated through a radial mask.
- Counter: "290M → 2.88B" cumulative PE over 2000–2018 (matched window), tied to scroll velocity. The counter's label explicitly reads "cumulative PE, 2000–2018" to avoid time-window ambiguity.

### Chapter III — The gap

**Act 3: The ratio.**
- Camera unchanged. An SVG line chart overlays the lower-left quadrant of the viewport.
- Line draws left-to-right with scroll: FP/GFD ratio per year, 2000-2018, 1.0x → 32.3x.
- Low-confidence band (2000-2006) greyed out, matching `/compare`'s treatment.
- Copy: *"Every year the gap got bigger. By 2018, we were finding 32 times more flood-exposed people than satellites could see."*
- Source: `comparison.json.calibration_gfd.pe_ratio`.

**Act 4: Why satellites miss.**
- Camera flies to Congo basin: `{ center: [23, -2], zoom: 3.5, pitch: 30, duration: 'auto' }`.
- A cluster of FP-only hexes pulses. No GFD hexes in view.
- Copy: *"Clouds. Short floods. Small villages. All invisible from 500 miles up."*
- Brief mechanism callouts (3 short lines) appear as side annotations: cloud cover, sub-daily duration, low-contrast terrain.

### Chapter IV — Where the gap lives

**Act 5: The country ladder.**
- Camera pulls back: `{ center: [20, 0], zoom: 1.2, pitch: 0, duration: 'auto' }`.
- A ranked horizontal-bar list overlays the right half of the viewport (mobile: full-width, globe hidden).
- Top-10 countries by `fp_gfd_ratio` with minimum denominator 1M PE, sourced from `country_comparison.json.top_gap_countries`.
- Each bar ticks in sequentially (stagger 120ms).
- Each bar: flag, country name, ratio (e.g. *"47× more exposure found"*).
- Copy: *"The invisible floods cluster in the Global South."*

**Act 6: Three stories.**
- Camera flies to three countries in sequence, 2.5s each: DRC → Bangladesh → Mozambique.
  (Final choice of three countries is made at spec-review time from the actual top_gap_countries output — the three listed here are placeholders that are likely but not certain.)
- On each arrival, a `CountryGapCard` appears top-right: *"GFD saw X events covering Y people. Ground Source found N events covering M people."*
- Card numbers from `country_comparison.json.countries[ISO3]`.

### Chapter V — Take control

**Act 7: Handoff.**
- Camera held.
- Chrome for `/explore` fades in over 600ms.
- Copy: *"Explore the new map of flood exposure."*
- CTA `HandoffButton` → `/explore`.

## Architecture & File Layout

No route changes. `/`, `/explore`, `/compare` all stay. `GlobeContext` shared-globe handoff is preserved unchanged.

**New files:**

```
lib/story/
  acts.ts                         # REWRITTEN — 7 new acts, no backward compat
  cameraKeyframes.ts              # REWRITTEN — new camera targets
  datasetLayers.ts                # NEW — GFD-only vs FP-only layer configs
  countryComparison.ts            # NEW — typed loader for country_comparison.json

components/story/
  DatasetRevealLayer.tsx          # NEW — Act 2 dual-layer + radial wipe
  RatioLineChart.tsx              # NEW — Act 3 SVG line chart
  CountryGapBar.tsx               # NEW — Act 5 ranked bar list
  CountryGapCard.tsx              # NEW — Act 6 per-country stat card

pipeline/
  05c_country_comparison.py       # NEW — joins FP + GFD + EM-DAT per country

pipeline/data/reference/
  gfd_country_pe.csv              # NEW — curated from Tellman 2021 supplementary
  emdat_country_affected.csv      # NEW — curated from Hu 2024 Table 1
  gfd_observed_h3.json            # NEW — H3 r-5 cells touching any GFD event

public/data/
  country_comparison.json         # NEW — emitted by pipeline
  gfd_observed_h3.json            # NEW — served to the client for layer filtering

app/compare/
  page.tsx                        # LIGHT EDIT — append one country-comparison section
```

**Deleted / retired (git keeps history):**

```
components/story/CompareDivider.tsx   # superseded by DatasetRevealLayer
components/story/StoryCounter.tsx     # not used in new arc
lib/story/acts.ts (old content)       # replaced wholesale
```

## Data Pipeline — `05c_country_comparison.py`

**Inputs:**
- `public/data/country_timeseries.json` (existing, FloodPulse per-country-per-year PE).
- `pipeline/data/reference/gfd_country_pe.csv` — curated from Tellman 2021 supplementary Table S2. Columns: `iso3, gfd_pe_2000_2018, gfd_events_2000_2018`.
- `pipeline/data/reference/emdat_country_affected.csv` — curated from Hu 2024 Table 1. Columns: `iso3, emdat_affected_2000_2022`.
- `pipeline/data/reference/gfd_observed_h3.json` — generated once by a sub-script that reads GFD event polygons from the Tellman public GCS bucket and intersects with H3 r-5 cells.

**Output schema (`public/data/country_comparison.json`):**

```ts
{
  generated: string,                // "YYYY-MM-DD"
  floodpulse_data_through: string,  // "YYYY-MM"
  countries: {
    [iso3: string]: {
      name: string,
      region: "Global South" | "Global North",
      floodpulse_pe_2000_2018: number,
      floodpulse_pe_2000_latest: number,
      gfd_pe_2000_2018: number | null,
      gfd_events_2000_2018: number | null,
      emdat_affected_2000_2022: number | null,
      fp_gfd_ratio: number | null,
      fp_emdat_ratio: number | null,
      population_2020: number | null
    }
  },
  top_gap_countries: string[],       // top 10 by fp_gfd_ratio, min FP denominator 1M PE
  global_south_share: {
    floodpulse_pct: number,
    gfd_pct: number,
    emdat_pct: number
  }
}
```

**Region classification:** UN M49 "developing regions" list, hard-coded in the pipeline script (~150 ISO3 codes).

**Edge cases:**
- GFD null for a country → country excluded from `top_gap_countries` but present in `countries`.
- FP = 0 for a country with non-zero GFD → `fp_gfd_ratio: 0`, flagged via a `notes` field at root.
- Min denominator 1M FP PE on `top_gap_countries` to filter noise from tiny-event single-year spikes.

**Size target:** `country_comparison.json` ≤ 50KB gzipped. `gfd_observed_h3.json` ≤ 80KB gzipped.

## Signature Moment — Act 2 Reveal Wipe (detail)

**Two deck.gl H3HexagonLayers** mounted over the same hex dataset:
- `layer-gfd` — `getFilterValue: d => d.isGfdObserved ? 1 : 0`. Fill: cyan `#22d3ee` at α=0.6. Always visible in Acts 1 and 2.
- `layer-fp` — `getFilterValue: d => d.isGfdObserved ? 0 : 1`. Fill: warm orange `#ef8a62`. Opacity driven by Act 2 scroll progress.

**Hex enrichment:** on initial load, each `HexDatum` gets `isGfdObserved: boolean` by looking up its H3 index in the `gfd_observed_h3.json` set. Done once, memoised. Keeps `hex_compact.json` untouched.

**Scroll mechanic (scrollama progress within Act 2, 0→1):**
- 0.00–0.15 → FP layer α = 0. First copy line visible.
- 0.15–0.85 → FP layer α eases 0→1 via SVG radial wipe mask anchored at the equator. Mask circle radius scales viewport-diagonal × progress.
- 0.85–1.00 → All hexes full opacity. Counter completes 290M → 6.3B. Final copy line locks.

**Fallbacks:**
- Safari iOS / any browser where the SVG mask cost spikes: straight α fade, no mask. Detection: feature-detect `CSS.supports('mask-image', 'radial-gradient(...)')` is insufficient; use a runtime FPS sample during the first 200ms of Act 2 and disable the mask if <30fps observed.
- Reduced motion: instant crossfade, counter snaps to final, mask skipped.

**Camera during the wipe:** static `{ center: [20, 5], zoom: 1.4, pitch: 0, bearing: 0 }`. No flyTo.

**Mobile (<760px):** No mask. Straight α fade on FP layer. Camera drops to `zoom: 1.1`.

## Responsive & Accessibility

**Mobile (<760px):**
- Acts 1, 2, 3, 7: full-fidelity.
- Act 4: camera zoom capped at 3.0 to keep the Congo-basin cluster readable.
- Act 5: bars render full-width vertical, globe hidden behind a solid panel.
- Act 6: three countries presented as three scroll-snap cards; flyTo held 1.8s each.
- No radial wipe mask; no scroll-velocity rotation on devices with `hardwareConcurrency < 4`.

**Accessibility:**
- All act copy as real DOM text, screen-reader-ordered outside the canvas.
- `aria-live="polite"` on the Act 2 counter and all `CountryGapCard` numbers.
- Keyboard: arrow keys advance acts (reuse existing hook).
- Skip-to-explore link persistent top-right on every act.
- No color-only encoding: GFD layer carries a "Satellites" label chip (cyan); FP layer carries a "Ground Source" label chip (orange). Both always visible in chrome from Act 1 onward.
- Respects `prefers-reduced-motion: reduce` — wipes become crossfades, flyTos become jumpTos, bars appear instantly.

**Performance:**
- `country_comparison.json` ≤ 50KB gzipped.
- `gfd_observed_h3.json` ≤ 80KB gzipped.
- Dual H3 layers reuse one `hexDataRef`; only filters differ. GPU budget unchanged.
- No new npm dependencies.
- Lighthouse Performance targets: ≥85 desktop, ≥75 mobile.
- Bundle size delta from current state: ≤ 20KB gzipped.

## Copy & Data-Accuracy Contract

Every numeric claim in the 7 acts must be supported by a file in `public/data/`:

- Act 1 "913 floods / 290M people" — `comparison.json.benchmarks` (GFD row).
- Act 2 "2.6M events / 2.88B people / 10×" (matched window 2000–2018) — `comparison.json.annual_events.floodpulse_records` (sum); `comparison.json.cumulative_pe.floodpulse` at index for 2018; ratio computed client-side against `comparison.json.cumulative_pe.gfd` at index for 2018. If copy is rewritten to use the extended window, update both sides consistently.
- Act 3 "1× → 32×" — `comparison.json.calibration_gfd.pe_ratio[0]` and `[-1]`.
- Act 4 mechanism callouts — text only; sourced from methodology notes in spec.
- Act 5 ranked list — `country_comparison.json.top_gap_countries`.
- Act 6 three-country stats — `country_comparison.json.countries[ISO3]`.

The 2000-2006 low-confidence caveat for FloodPulse is rendered in Act 3's chart as a shaded band and called out in the methodology drawer. The thesis does not make claims about pre-2007 FloodPulse coverage.

## `/compare` — light addition

Append one new section to `app/compare/page.tsx`, above the existing "Literature Benchmarks" table:

**"Where the gap is biggest"** — a ranked table of the top 20 countries by `fp_gfd_ratio`, columns: country, Ground Source PE (2000-2018), GFD PE (2000-2018), ratio, EM-DAT affected (2000-2022). Reuses the existing `Section` component and styling tokens.

No other change to `/compare`.

## Test Plan

**Pipeline:**
- [ ] `05c_country_comparison.py` is idempotent across runs.
- [ ] Deterministic output (stable key ordering).
- [ ] pytest: row count matches input, `fp_gfd_ratio` nulls only where `gfd_pe_2000_2018` is null, `top_gap_countries` ordered by ratio desc with min-denominator enforced.

**Playwright (`tests/story.spec.ts`):**
- [ ] Scroll through all 7 acts on desktop viewport (1440×900).
- [ ] Scroll through all 7 acts on mobile viewport (iPhone 13).
- [ ] Act 2: snapshot the counter at scroll-end, assert text contains `6.3B` (or current value).
- [ ] Act 2: verify FP layer opacity is visually ≥90% at scroll-end via screenshot diff.
- [ ] Act 3: verify the ratio line chart ends at `32.3x` label visible.
- [ ] Act 5: verify at least 10 country bars rendered.
- [ ] Act 6: assert each flyTo target within ±1° of expected center (DRC, Bangladesh, Mozambique or whatever final three are chosen).
- [ ] Handoff: clicking the CTA navigates to `/explore` without MapLibre reinitializing (globe element retains same DOM id).

**Manual:**
- [ ] Reduced-motion mode: no flyTos, wipes become crossfades, no crashes.
- [ ] Keyboard-only nav across all 7 acts.
- [ ] VoiceOver reads copy in order.
- [ ] Safari 14+ desktop.
- [ ] iPhone Safari + Android Chrome.

**Regression:**
- [ ] Existing `hex-stability.spec.ts` still passes.
- [ ] `/explore` functions identically to current state.
- [ ] `/compare` existing charts render identically to current state.

**Build:**
- [ ] `npm run build` passes.
- [ ] Bundle delta ≤ 20KB gzipped.
- [ ] Lighthouse Performance ≥ 85 desktop, ≥ 75 mobile on `/`.

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GFD per-country data hard to parse / gated | Medium | Medium | Fallback: hand-curate top 20 countries from Tellman 2021 PDF tables; reduce Act 5 to top 5 |
| H3-to-GFD-polygon intersection misclassifies border hexes | Low | Low | Tolerant flag: `isGfdObserved = true` if any GFD event touches the cell (conservative on gap claims) |
| EM-DAT ratios overstate gap (EM-DAT excludes sub-threshold disasters) | Medium | Medium | Lead with GFD ratio; caveat EM-DAT in methodology drawer; render EM-DAT as secondary |
| Reveal wipe feels gimmicky | Medium | High | Usability-test with 3 people pre-merge; fall back to α crossfade with counter-tick as focal point if it lands flat |
| "Global South" framing is politically loaded | Low-Medium | Medium | Use UN M49 developing regions; acknowledge in methodology drawer; offer "See all countries" toggle on Act 5 |
| Shared-globe handoff regresses during rebuild of acts | Low | High | Touch `GlobeContext` only additively; keep one Playwright test that asserts the globe DOM node survives navigation |
| Dual H3 layers push GPU budget over on mid-range devices | Low | Medium | Share `hexDataRef`, use `updateTriggers` only on the isGfdObserved field, measure on iPhone 12 before merge |

## Out of Scope

- Per-event animation.
- Audio / video.
- Changes to `/explore`.
- Real-time data refresh.
- Localization.
- A/B test infrastructure.
- Any modification to `hex_compact.json` or the 01-04 pipeline steps.

## Open Questions

None blocking. The three "three-story" countries in Act 6 are placeholders (DRC / Bangladesh / Mozambique) — final selection happens at implementation time, driven by the actual top_gap_countries output from `05c_country_comparison.py`.

## Acceptance

This spec is ready for implementation planning. Next step: invoke `superpowers:writing-plans` to produce the sequenced implementation plan.
