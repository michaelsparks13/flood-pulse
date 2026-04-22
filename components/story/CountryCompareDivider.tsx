"use client";

interface Props {
  visible: boolean;
}

/**
 * Vertical divider for Act 6's split-screen old-vs-new country comparison.
 * Sits on top of the globe at screen center; labels the left half (traditional
 * catalogs, cyan) and the right half (Flood Pulse, orange). Invisible outside
 * the three-stories act.
 */
export default function CountryCompareDivider({ visible }: Props) {
  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        bottom: 0,
        width: 0,
        zIndex: 15,
        opacity: visible ? 1 : 0,
        transition: "opacity 350ms ease",
        pointerEvents: "none",
      }}
    >
      {/* vertical hairline */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          bottom: "10%",
          left: "-0.5px",
          width: "1px",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 20%, rgba(255,255,255,0.22) 80%, rgba(255,255,255,0) 100%)",
        }}
      />
      {/* left label */}
      <div
        style={{
          position: "absolute",
          top: "18px",
          left: "-12px",
          transform: "translateX(-100%)",
          whiteSpace: "nowrap",
        }}
        className="text-[11px] uppercase tracking-[0.18em] text-[#22d3ee]"
      >
        Traditional catalogs
      </div>
      {/* right label */}
      <div
        style={{
          position: "absolute",
          top: "18px",
          right: "-12px",
          transform: "translateX(100%)",
          whiteSpace: "nowrap",
        }}
        className="text-[11px] uppercase tracking-[0.18em] text-[#ef8a62]"
      >
        Flood Pulse
      </div>
    </div>
  );
}
