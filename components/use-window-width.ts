"use client";

import { useEffect, useState } from "react";

/**
 * Die Breite des Fensters, gemessen im Geraet. Sie liegt hier und nicht in
 * `app/plan/`, weil beide Bereiche sie brauchen: der Planer, um auf einen
 * breiteren Bildschirm zu verweisen (req-049), und der Begleiter, um den
 * Wechsel dorthin nur anzubieten, wo der Planer benutzbar ist (bug-035).
 * Aus `app/plan/` nach `app/go/` importiert wird nichts (siehe
 * delivery/stack.md, Conventions).
 *
 * `initialWidth` gilt beim serverseitigen Rendern und beim ersten Rendern im
 * Client (kein Zugriff auf `window`); erst nach dem Mounten wird die
 * tatsaechliche Breite uebernommen. So bleiben Server und Client beim ersten
 * Rendern gleich -- ein Hydration-Mismatch entstuende sonst (siehe
 * go-view.tsx, Themenwahl). Wer annimmt, was auf seinem Geraet der Normalfall
 * ist, vermeidet zugleich ein kurzes Aufblitzen der falschen Ansicht.
 */
export function useWindowWidth(initialWidth: number): number {
  const [width, setWidth] = useState(initialWidth);

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
