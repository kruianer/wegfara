"use client";

import { useEffect, useState } from "react";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";

// Serverseitig gerendert wird eine Breite oberhalb der Mindestbreite
// angenommen (kein Zugriff auf `window`); die tatsaechliche Fensterbreite
// wird erst nach dem Mounten im Client uebernommen, um einen
// Hydration-Mismatch zu vermeiden (siehe go-view.tsx, Themenwahl).
const INITIAL_WIDTH = PLANNER_MIN_WIDTH_PX * 2;

export function useWindowWidth(): number {
  const [width, setWidth] = useState(INITIAL_WIDTH);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}
