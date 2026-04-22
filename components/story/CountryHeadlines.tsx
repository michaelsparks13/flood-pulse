"use client";

import { useEffect, useState } from "react";

interface Headline {
  date: string;
  headline: string;
  source: string;
  url: string;
}

interface HeadlinesFile {
  generated: string;
  note: string;
  headlines: Record<string, Headline[]>;
}

interface CountryHeadlinesProps {
  iso3: string | null;
  visible: boolean;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function CountryHeadlines({ iso3, visible }: CountryHeadlinesProps) {
  const [data, setData] = useState<HeadlinesFile | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/country_headlines.json")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const items = iso3 && data?.headlines[iso3] ? data.headlines[iso3] : [];
  const show = visible && items.length > 0;

  return (
    <div
      aria-hidden={!show}
      style={{
        position: "fixed",
        top: "336px",
        right: "32px",
        zIndex: 20,
        width: "min(320px, 80vw)",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 350ms ease, transform 350ms ease",
        pointerEvents: show ? "auto" : "none",
      }}
      className="bg-panel/75 backdrop-blur-md rounded-2xl border border-border p-4"
    >
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary mb-3">
        News the model reads
      </div>
      <ul className="space-y-3">
        {items.map((h) => (
          <li key={h.url} className="text-[12px] leading-snug">
            <a
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-text-primary hover:text-text-secondary transition-colors"
            >
              {h.headline}
            </a>
            <div className="mt-1 text-[10px] text-text-tertiary">
              {h.source} · {formatDate(h.date)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
