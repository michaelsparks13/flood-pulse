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
