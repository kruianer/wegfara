"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./split-view.module.css";

const MIN_LEFT_WIDTH_PX = 410;
const RIGHT_MARGIN_PX = 480;

export function SplitView({
  windowWidth,
  left,
  right,
}: {
  windowWidth: number;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  // `null` heisst: noch nie gezogen, die Breite folgt der Fensterbreite
  // (50 %). Erst ein Zug am Trenner legt einen festen Wert fest.
  const [leftWidthOverride, setLeftWidthOverride] = useState<number | null>(
    null,
  );
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const leftWidth = leftWidthOverride ?? windowWidth / 2;

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const drag = dragStateRef.current;
      if (!drag) return;
      const maxWidth = windowWidth - RIGHT_MARGIN_PX;
      const next = drag.startWidth + (e.clientX - drag.startX);
      setLeftWidthOverride(
        Math.max(MIN_LEFT_WIDTH_PX, Math.min(maxWidth, next)),
      );
    }
    function handleMouseUp() {
      dragStateRef.current = null;
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [windowWidth]);

  function handleMouseDown(e: React.MouseEvent) {
    dragStateRef.current = { startX: e.clientX, startWidth: leftWidth };
  }

  return (
    <div className={styles.split}>
      <div
        className={styles.pane}
        data-testid="split-pane-left"
        style={{ width: leftWidth }}
      >
        {left}
      </div>
      <div
        className={styles.divider}
        role="separator"
        aria-orientation="vertical"
        aria-label="Spaltenbreite anpassen"
        onMouseDown={handleMouseDown}
      >
        <span className={styles.grip} aria-hidden="true" />
      </div>
      <div className={styles.pane} data-testid="split-pane-right">
        {right}
      </div>
    </div>
  );
}
