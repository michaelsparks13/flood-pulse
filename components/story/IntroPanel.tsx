"use client";

import { useEffect, useState } from "react";

interface IntroPanelProps {
  visible: boolean;
}

export default function IntroPanel({ visible }: IntroPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Desktop: fixed top-left card. Mobile: bottom sheet, collapsed by default.
  const mobileCollapsedHeight = 168;
  const mobileExpandedMaxHeight = "60vh";

  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: 12,
        right: 12,
        top: 12,
        zIndex: 20,
        maxHeight: expanded ? mobileExpandedMaxHeight : mobileCollapsedHeight,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-12px)",
        transition:
          "opacity 400ms ease, transform 400ms ease, max-height 350ms ease",
        pointerEvents: visible ? "auto" : "none",
        overflow: expanded ? "auto" : "hidden",
      }
    : {
        position: "fixed",
        top: 32,
        left: 32,
        zIndex: 20,
        width: "min(380px, calc(100vw - 64px))",
        maxHeight: "calc(100vh - 64px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 600ms ease, transform 600ms ease",
        pointerEvents: visible ? "auto" : "none",
        overflow: "auto",
      };

  return (
    <div
      aria-hidden={!visible}
      style={containerStyle}
      className="bg-panel/85 backdrop-blur-xl rounded-2xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] p-4 sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h1 className="text-text-primary text-lg sm:text-xl font-semibold tracking-tight">
          FloodPulse
        </h1>
        <a
          href="https://portfolio-michaelsparks13s-projects.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors whitespace-nowrap"
        >
          by Michael Sparks ↗
        </a>
      </div>

      {isMobile && !expanded ? (
        <>
          <p className="mt-2 text-[13px] leading-normal text-text-secondary">
            For 25 years, satellites and curators logged about 10,000 floods.{" "}
            <span className="text-text-primary">Groundsource</span> — a new
            dataset that reads local news — found 2.6 million.
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 text-[12px] text-text-primary underline underline-offset-2 decoration-text-tertiary hover:decoration-text-primary transition-colors"
          >
            More details ↓
          </button>
        </>
      ) : (
        <>
          <div className="mt-3 sm:mt-4 space-y-3 text-[13px] leading-[1.55] text-text-secondary">
            <p>
              Floods kill more people than any other natural disaster, and yet
              for decades our best record of them has been a patchwork. The{" "}
              <span className="text-text-primary">
                Dartmouth Flood Observatory
              </span>{" "}
              hand-curates large events from news and government reports. The{" "}
              <span className="text-text-primary">Global Flood Database</span>{" "}
              (Tellman et al., Nature 2021) stitches together satellite
              inundation footprints.{" "}
              <span className="text-text-primary">GDACS</span>, run jointly by
              the UN and European Commission, aggregates ~10,000 humanitarian
              alerts.
            </p>
            <p>
              Together these catalogs miss almost everything. Satellites
              can&rsquo;t see through clouds. Curators chase the events that
              make the news. Humanitarian systems trigger only once damage is
              severe enough to warrant a response.
            </p>
            <p>
              In 2026, Google Research released{" "}
              <span className="text-text-primary">Groundsource</span> — an
              experimental dataset that reads local news in dozens of languages
              and extracts flood events at the scale of individual villages.
              Where the traditional catalogs found a few thousand events,
              Groundsource found 2.6 million.
            </p>
            <p className="text-text-tertiary text-[12px] italic">
              This site compares them side-by-side: what the satellites missed,
              what the curators skipped, and the populations whose floods have
              never made it into a database.
            </p>
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-4 text-[12px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Collapse ↑
            </button>
          )}
        </>
      )}
    </div>
  );
}
