"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  visible: boolean;
}

export default function HandoffButton({ visible }: Props) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    setPressed(true);
    router.push("/explore");
  };

  return (
    <button
      onClick={handleClick}
      aria-label="Take control of the map"
      className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-20 px-8 py-4 rounded-full border border-border bg-panel/90 backdrop-blur-xl text-text-primary text-lg font-medium transition-all duration-500 cursor-pointer ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
      } ${pressed ? "scale-95" : "hover:scale-105"}`}
    >
      Take control →
    </button>
  );
}
