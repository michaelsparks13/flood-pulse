"use client";

/**
 * SVG diagram explaining the Population Exposed metric.
 * Shows three example hexagons that flooded in a given year,
 * each contributing their population to the annual total.
 */
export default function MetricExplainer() {
  // Flat-topped hexagon, radius 26
  const hex = "M26,0 L13,22.5 L-13,22.5 L-26,0 L-13,-22.5 L13,-22.5Z";

  const cols = [
    { x: 69, pop: "500K", fill: "#fdd162", label: "City" },
    { x: 206, pop: "200K", fill: "#f8945e", label: "Town" },
    { x: 343, pop: "50K", fill: "#e85a5a", label: "Rural" },
  ];

  return (
    <div
      className="mt-3 rounded-lg p-1"
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <svg
        viewBox="0 0 412 200"
        className="w-full"
        role="img"
        aria-label="Diagram: population exposed equals the sum of people in all flooded areas for a given year"
      >
        <defs>
          <filter
            id="hex-glow"
            x="-60%"
            y="-60%"
            width="220%"
            height="220%"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="6"
              result="blur"
            />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Title */}
        <text
          x="206"
          y="16"
          textAnchor="middle"
          fill="#64748b"
          fontSize="9.5"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.08em"
        >
          AREAS FLOODED IN 2024
        </text>

        {/* Three example hexagons */}
        {cols.map((c, i) => (
          <g key={i}>
            {/* Hex shape with glow */}
            <g transform={`translate(${c.x}, 58)`} filter="url(#hex-glow)">
              <path d={hex} fill={c.fill} opacity="0.85" />
            </g>
            <g transform={`translate(${c.x}, 58)`}>
              <path
                d={hex}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.75"
              />
            </g>

            {/* Area label */}
            <text
              x={c.x}
              y="58"
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(0,0,0,0.5)"
              fontSize="8"
              fontWeight="600"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {c.label}
            </text>

            {/* Population count */}
            <text
              x={c.x}
              y="100"
              textAnchor="middle"
              fill="#f1f5f9"
              fontSize="14"
              fontWeight="600"
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
            >
              {c.pop}
            </text>
            <text
              x={c.x}
              y="113"
              textAnchor="middle"
              fill="#64748b"
              fontSize="9"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              people
            </text>
          </g>
        ))}

        {/* Plus signs between columns */}
        <text
          x="137.5"
          y="104"
          textAnchor="middle"
          fill="#64748b"
          fontSize="16"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
        >
          +
        </text>
        <text
          x="274.5"
          y="104"
          textAnchor="middle"
          fill="#64748b"
          fontSize="16"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
        >
          +
        </text>

        {/* Separator */}
        <line
          x1="30"
          y1="130"
          x2="382"
          y2="130"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* Total */}
        <text
          x="206"
          y="155"
          textAnchor="middle"
          fill="#fcffa4"
          fontSize="16"
          fontWeight="700"
          fontFamily="'JetBrains Mono', ui-monospace, monospace"
        >
          750K
        </text>
        <text
          x="206"
          y="170"
          textAnchor="middle"
          fill="#94a3b8"
          fontSize="10"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          population exposed in 2024
        </text>

        {/* Annotation */}
        <text
          x="206"
          y="190"
          textAnchor="middle"
          fill="#475569"
          fontSize="8"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Summed across all flooded hexes worldwide, each person counted once per year
        </text>
      </svg>
    </div>
  );
}
