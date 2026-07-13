"use client";

import { useRef, useState } from "react";

export function useHoverDelay(delay = 300) {
  const [hovered, setHovered] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => {
    if (timer.current) clearTimeout(timer.current);
    setHovered(true);
  };
  const onLeave = () => {
    timer.current = setTimeout(() => setHovered(false), delay);
  };
  return { hovered, onEnter, onLeave };
}
