"use client";

import MetricExplainer from "./MetricExplainer";

interface MethodologyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MethodologyDrawer({ open, onOpenChange }: MethodologyDrawerProps) {
  const setOpen = onOpenChange;

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
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

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
