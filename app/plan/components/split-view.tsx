"use client";

import { useEffect, useRef, useState } from "react";
import { FullscreenExitIcon, FullscreenIcon } from "@/components/icons";
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
  const [collapsed, setCollapsed] = useState(false);
  // Der laufende Zug steht in einer Referenz und nicht im Zustand: er aendert
  // sich mit jedem Zeigerschritt, und neu gezeichnet wird dafuer nichts.
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const leftWidth = leftWidthOverride ?? windowWidth / 2;

  // Gezogen wird ueber Zeiger-Ereignisse und nicht ueber Maus-Ereignisse
  // (bug-031): Safari auf dem iPad schickt zu einem Finger keine
  // `mousemove`-Ereignisse, die Leiste liess sich dort also gar nicht
  // verschieben. Zeiger-Ereignisse kommen von Maus, Finger und Stift
  // gleichermassen -- wie beim Ziehen der POIs (bug-017).
  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const maxWidth = windowWidth - RIGHT_MARGIN_PX;
      const next = drag.startWidth + (e.clientX - drag.startX);
      setLeftWidthOverride(
        Math.max(MIN_LEFT_WIDTH_PX, Math.min(maxWidth, next)),
      );
    }
    // Loslassen und Abbrechen enden gleich: der Zug ist vorbei. Abgebrochen
    // wird er, wenn der Browser den Zeiger an sich nimmt.
    function handlePointerEnd(e: PointerEvent) {
      if (dragStateRef.current?.pointerId === e.pointerId) {
        dragStateRef.current = null;
      }
    }
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [windowWidth]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Nur der erste Finger bzw. die Haupttaste zieht; ein zweiter Zeiger
    // wuerde den laufenden Zug sonst uebernehmen.
    if (dragStateRef.current || e.button !== 0) return;
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: leftWidth,
    };
    // Ab hier gehoeren alle Zeiger-Ereignisse der Leiste, auch wenn der
    // Finger sie laengst verlassen hat (jsdom kennt das nicht).
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  // Was die Schaltflaeche tut -- seit bug-042 traegt sie nur noch ein Symbol,
  // der Satz steht in ihrem Tooltip und ihrem aria-label.
  const umschaltenLabel = collapsed ? "Liste einblenden" : "Liste ausblenden";

  return (
    <div className={styles.split}>
      {!collapsed && (
        <div
          className={styles.pane}
          data-testid="split-pane-left"
          style={{ width: leftWidth }}
        >
          {left}
        </div>
      )}
      {!collapsed && (
        <div
          className={styles.divider}
          role="separator"
          aria-orientation="vertical"
          aria-label="Spaltenbreite anpassen"
          onPointerDown={handlePointerDown}
        >
          <span className={styles.grip} aria-hidden="true" />
        </div>
      )}
      {/* Klappt die linke Spalte weg, damit die Karte die ganze Breite
          bekommt -- zum Zeichnen des Suchgebiets (bug-011). Seit bug-042 ein
          Vollbild-Symbol statt Text: es sagt, was geschieht; im
          ausgeblendeten Zustand zeigt es das Gegenteil. Was der Knopf tut,
          nennt weiterhin sein Tooltip („title") und, fuer Vorlesegeraete,
          sein „aria-label". */}
      <button
        type="button"
        className={styles.collapseToggle}
        aria-pressed={collapsed}
        title={umschaltenLabel}
        aria-label={umschaltenLabel}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span className={styles.collapseChip}>
          {collapsed ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </span>
      </button>
      <div className={styles.pane} data-testid="split-pane-right">
        {right}
      </div>
    </div>
  );
}
