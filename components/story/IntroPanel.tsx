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

  const offset = isMobile ? 12 : 32;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="About this project"
        title="About this project"
        style={{
          position: "fixed",
          top: offset,
          left: offset,
          zIndex: 20,
          width: 40,
          height: 40,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-8px)",
          transition: "opacity 400ms ease, transform 400ms ease",
          pointerEvents: visible ? "auto" : "none",
        }}
        className="bg-panel/85 backdrop-blur-xl rounded-full border border-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex items-center justify-center text-text-primary text-base font-semibold hover:bg-panel-solid/90 transition-colors"
      >
        ?
      </button>
    );
  }

  const containerStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed",
        left: offset,
        right: offset,
        top: offset,
        zIndex: 20,
        maxHeight: "70vh",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 400ms ease, transform 400ms ease",
        pointerEvents: visible ? "auto" : "none",
        overflow: "auto",
      }
    : {
        position: "fixed",
        top: offset,
        left: offset,
        zIndex: 20,
        width: "min(380px, calc(100vw - 64px))",
        maxHeight: "calc(100vh - 64px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 400ms ease, transform 400ms ease",
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
        <div className="flex items-center gap-3">
          <a
            href="https://portfolio-michaelsparks13s-projects.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors whitespace-nowrap"
          >
            by Michael Sparks ↗
          </a>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close"
            className="text-text-tertiary hover:text-text-primary transition-colors text-lg leading-none -mt-0.5"
          >
            ×
          </button>
        </div>
      </div>

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
    </div>
  );
}
