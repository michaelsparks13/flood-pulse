"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MetricExplainer from "./MetricExplainer";
import ComparisonChart from "./ComparisonChart";
import type { ComparisonData } from "@/lib/types";

interface MethodologyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MethodologyDrawer({ open, onOpenChange }: MethodologyDrawerProps) {
  const setOpen = onOpenChange;
  const [comparison, setComparison] = useState<ComparisonData | null>(null);

  useEffect(() => {
    if (open && !comparison) {
      fetch("/data/comparison.json")
        .then((r) => r.json())
        .then(setComparison)
        .catch(() => {});
    }
  }, [open, comparison]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-surface border border-border
                   text-text-tertiary text-xs hover:text-text-secondary
                   hover:bg-surface-hover transition-colors cursor-pointer"
      >
        Methodology
      </button>

      {/* Backdrop + modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-8"
        >
          {/* Backdrop — dedicated div with pointerdown for reliable mobile close */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onPointerDown={() => setOpen(false)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-xl max-h-[85vh] bg-panel-solid
                          rounded-2xl border border-border overflow-y-auto
                          shadow-[0_8px_48px_rgba(0,0,0,0.5)]
                          animate-[fadeScaleIn_0.2s_ease-out]"
          >
            {/* Header */}
            <div className="sticky top-0 bg-panel-solid/95 backdrop-blur-xl border-b border-border px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-text-primary font-semibold text-lg">
                Methodology
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-hover
                           flex items-center justify-center text-text-tertiary
                           hover:text-text-primary transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2l10 10M12 2L2 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-6 text-sm text-text-secondary leading-relaxed">
              <section>
                <h3 className="text-text-primary font-medium mb-2">Data Source</h3>
                <p>
                  This visualization uses{" "}
                  <a
                    href="https://research.google/blog/introducing-groundsource-turning-news-reports-into-data-with-gemini/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    Google Groundsource
                  </a>
                  , a dataset of 2.6 million flood events extracted from global
                  news articles using Gemini AI. Each record contains a geographic
                  polygon, start date, end date, and area estimate.
                </p>
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">
                  Deduplication via H3 Hexagons
                </h3>
                <p>
                  Multiple news articles about the same flood event produce
                  overlapping polygons. For example, Hurricane Harvey generated
                  over 1,000 separate records in the Houston area.
                </p>
                <p className="mt-2">
                  We convert each polygon to{" "}
                  <a
                    href="https://h3geo.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    H3 hexagonal cells
                  </a>{" "}
                  at resolution 5 (~252 km² each). If many overlapping polygons
                  cover the same hex in the same month, that hex is counted once.
                  This naturally deduplicates without expensive polygon union operations.
                </p>
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">
                  Population Exposed
                </h3>
                <p>
                  Population data comes from the{" "}
                  <a
                    href="https://ghsl.jrc.ec.europa.eu/ghs_pop2023.php"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    Global Human Settlement Layer (GHS-POP)
                  </a>{" "}
                  R2023A at 1 km resolution. We use six epoch rasters (2000,
                  2005, 2010, 2015, 2020, 2025) and linearly interpolate
                  population for each year, so a flood in 2003 uses 2003
                  population — not a static snapshot.
                </p>
                <p className="mt-2">
                  <strong className="text-text-primary">Population exposed</strong>{" "}
                  is the number of people living in areas that experienced
                  flooding in a given year. Each person is counted once per year
                  regardless of how many months their area flooded. This follows
                  the methodology established by{" "}
                  <a
                    href="https://www.nature.com/articles/s41586-021-03695-w"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    Tellman et&nbsp;al. (2021)
                  </a>{" "}
                  and the{" "}
                  <a
                    href="https://documents.worldbank.org/en/publication/documents-reports/documentdetail/669141603288540994/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    World Bank
                  </a>
                  .
                </p>
                <MetricExplainer />
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">
                  Area Weighting &amp; Inundation Ratio
                </h3>
                <p>
                  Groundsource polygons represent{" "}
                  <em className="text-text-primary">where flooding was reported</em>,
                  not{" "}
                  <em className="text-text-primary">what area was underwater</em>.
                  When Gemini extracts a flood event from a news article about
                  &ldquo;flooding in Houston,&rdquo; the polygon covers all of
                  Houston (~1,700 km²) — not just the streets and neighborhoods
                  that actually flooded.
                </p>
                <p className="mt-2">
                  Naively counting every person in a flooded hex as
                  &ldquo;exposed&rdquo; would count the entire population of
                  Houston for a flood that affected a few neighborhoods. At
                  scale, this produces implausible numbers — nearly the entire
                  world population in a single year.
                </p>
                <p className="mt-2">
                  To correct for this, we apply two adjustments:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-text-tertiary mt-2">
                  <li>
                    <span className="text-text-secondary">Area weighting:</span>{" "}
                    Each hex is weighted by{" "}
                    <span className="text-text-primary font-mono text-xs">
                      min(event_area / hex_area, 1.0)
                    </span>
                    {" "}so a 20 km² flood in a 252 km² hex only counts ~8%
                    of that hex&rsquo;s population — not all of it.
                  </li>
                  <li>
                    <span className="text-text-secondary">Inundation ratio (10%):</span>{" "}
                    Since the event polygon is an administrative boundary, not a
                    flood extent, we estimate that roughly 10% of the reported
                    area was actually inundated. This ratio is consistent with
                    flood inundation literature and produces annual exposure
                    estimates (400&ndash;600M in recent years) that align with
                    World Bank and UNDRR benchmarks.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">
                  Frequency Trend &amp; Return Period
                </h3>
                <p>
                  The <strong className="text-text-primary">frequency trend</strong>{" "}
                  answers: &ldquo;Are floods becoming more frequent here?&rdquo;
                  For each hex, we create a binary time series of yearly flood
                  occurrence (1&nbsp;=&nbsp;flooded, 0&nbsp;=&nbsp;not) across the
                  full 2000&ndash;2026 observation period, then fit an OLS linear
                  slope. Positive slope indicates increasing frequency. The
                  diverging blue&ndash;white&ndash;red color scale highlights
                  hexes where flooding is decreasing, stable, or increasing.
                </p>
                <p className="mt-2">
                  The <strong className="text-text-primary">return period</strong>{" "}
                  (shown on hover for hexes with 10+ flood months) estimates how
                  often a location floods: the span between first and last flood
                  year divided by the number of inter-event intervals. This is
                  the empirical return period per{" "}
                  <a
                    href="https://doi.org/10.5194/hess-17-1871-2013"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    Winsemius&nbsp;et&nbsp;al.&nbsp;(2013)
                  </a>
                  .
                </p>
                <p className="mt-2 px-3 py-2 rounded-lg bg-surface text-text-tertiary text-xs leading-relaxed">
                  <strong className="text-text-secondary">Temporal bias caveat:</strong>{" "}
                  Groundsource has significant temporal bias &mdash; 64% of all
                  records are from 2020&ndash;2025, reflecting the growth of online
                  news coverage rather than actual flood frequency. An &ldquo;increasing&rdquo;
                  trend at a location may partly reflect improved detection. The
                  frequency chart and trend layer should be interpreted alongside
                  this limitation.
                </p>
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">
                  Known Limitations
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-text-tertiary">
                  <li>
                    <span className="text-text-secondary">News bias:</span> The
                    dataset reflects news coverage, not all actual floods.
                    Wealthier, English-speaking countries with more digital news
                    are over-represented. The exponential growth in records is
                    primarily due to increased online news coverage.
                  </li>
                  <li>
                    <span className="text-text-secondary">Population interpolation:</span>{" "}
                    GHS-POP epochs are spaced five years apart. Population between
                    epochs is linearly interpolated, which may not capture rapid
                    urbanization or displacement events.
                  </li>
                  <li>
                    <span className="text-text-secondary">Spatial precision:</span>{" "}
                    Google reports 60% of events are spatially and temporally
                    accurate, 82% are &ldquo;practically useful.&rdquo; H3 res-5
                    hexagons (~252 km²) smooth over sub-hex errors.
                  </li>
                  <li>
                    <span className="text-text-secondary">No severity:</span>{" "}
                    Groundsource records presence of flooding, not depth,
                    duration, or damage. A minor street flood and a catastrophic
                    inundation are weighted equally.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">
                  Comparison with Existing Databases
                </h3>
                <p>
                  How do FloodPulse estimates compare with established flood
                  databases? The chart below plots annual population exposed
                  from FloodPulse alongside the{" "}
                  <a
                    href="https://doi.org/10.1038/s41586-021-03695-w"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    Global Flood Database
                  </a>{" "}
                  (913 satellite-observed events, 2000&ndash;2018) and{" "}
                  <a
                    href="https://www.emdat.be/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    EM-DAT
                  </a>{" "}
                  (curated disaster reports).
                </p>
                <div className="mt-3">
                  <ComparisonChart data={comparison} compact />
                </div>
                <p className="mt-2 px-3 py-2 rounded-lg bg-surface text-text-tertiary text-xs leading-relaxed">
                  <strong className="text-text-secondary">Why the gap?</strong>{" "}
                  GFD captures only large, satellite-visible floods (913 events).
                  EM-DAT requires severity thresholds (10+ deaths). FloodPulse
                  captures 2.6M events from news, including small and localized
                  floods invisible to satellites. The shaded early years
                  (2000&ndash;2006) have sparse Groundsource coverage and are
                  unreliable for comparison.
                </p>
                <div className="mt-2">
                  <Link
                    href="/compare"
                    className="text-accent-bright text-xs underline underline-offset-2
                               hover:text-accent-bright/80 transition-colors"
                  >
                    View detailed comparison &rarr;
                  </Link>
                </div>
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">
                  References
                </h3>
                <ul className="space-y-1.5 text-text-tertiary text-xs">
                  <li>
                    Tellman, B. et al. (2021). Satellite imaging reveals
                    increased proportion of population exposed to floods.{" "}
                    <em className="text-text-secondary">Nature</em> 596, 80-86.
                  </li>
                  <li>
                    Rentschler, J. et al. (2020). People in Harm&rsquo;s Way:
                    Flood Exposure and Poverty in 189 Countries.{" "}
                    <em className="text-text-secondary">World Bank Policy Research WPS 9447</em>.
                  </li>
                  <li>
                    Winsemius, H.C. et al. (2013). A framework for global river
                    flood risk assessments.{" "}
                    <em className="text-text-secondary">HESS</em> 17, 1871-1892.
                  </li>
                  <li>
                    Rentschler, J. et al. (2022). Flood exposure and poverty in
                    188 countries.{" "}
                    <em className="text-text-secondary">Nat Commun</em> 13, 3527.
                  </li>
                  <li>
                    Hu, P. et al. (2024). Global, regional and national trends
                    and impacts of natural floods, 1990&ndash;2022.{" "}
                    <em className="text-text-secondary">Sci Rep</em> 14, 11705.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-text-primary font-medium mb-2">Data Access</h3>
                <p>
                  The Groundsource dataset is available under CC-BY-4.0 at{" "}
                  <a
                    href="https://zenodo.org/records/18647054"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-bright underline underline-offset-2"
                  >
                    Zenodo (DOI: 10.5281/zenodo.18647054)
                  </a>
                  .
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
