"use client";

import { useEffect, useRef, useState } from "react";
import { FullscreenExitIcon, FullscreenIcon } from "@/components/icons";
import { stehenSpaltenNebeneinander } from "@/lib/plan/spalten";
import { SeitenUmschalter } from "./seiten-umschalter";
import styles from "./split-view.module.css";

type SplitSeite = "links" | "rechts";

const MIN_LEFT_WIDTH_PX = 410;
const RIGHT_MARGIN_PX = 480;

/**
 * Zwei Seiten nebeneinander, am Trenner verschiebbar -- in den Bereichen POIs
 * (Liste und Karte) und Chat (Chatfenster und Karte).
 *
 * Seit req-088 laeuft der Planer auch auf dem iPad hochkant, und dort haben
 * beide Seiten nicht nebeneinander Platz (lib/plan/spalten.ts): die linke
 * verlangt beim Ziehen mindestens 410 px, und neben der Seitenleiste bleiben
 * bei 768 px nur 702. Darunter steht deshalb eine Seite allein ueber die ganze
 * Breite, und ein Umschalter darueber waehlt, welche.
 */
export function SplitView({
  windowWidth,
  left,
  right,
  leftLabel = "Liste",
  rightLabel = "Karte",
  rechtsZeigen = false,
  onLinksGewaehlt,
}: {
  windowWidth: number;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Wie die linke Seite im Umschalter heisst (req-088). */
  leftLabel?: string;
  /** Wie die rechte Seite im Umschalter heisst (req-088). */
  rightLabel?: string;
  /**
   * Haelt bei schmaler Breite die rechte Seite offen (req-088) -- solange auf
   * der Karte etwas zu tun ist, das in der linken Seite angestossen wurde,
   * etwa eine Position zu waehlen. Danach steht wieder die gewaehlte Seite.
   */
  rechtsZeigen?: boolean;
  /**
   * Die linke Seite wurde im Umschalter gewaehlt (req-088) -- wer die rechte
   * mit `rechtsZeigen` offen haelt, gibt sie damit frei.
   */
  onLinksGewaehlt?: () => void;
}) {
  // Die gewaehlte Seite, solange nicht beide Platz haben (req-088). Ein
  // Zustand der Ansicht -- gespeichert wird er nicht.
  const [gewaehlteSeite, setGewaehlteSeite] = useState<SplitSeite>("links");
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

  if (!stehenSpaltenNebeneinander(windowWidth)) {
    const seite = rechtsZeigen ? "rechts" : gewaehlteSeite;
    return (
      <div className={`${styles.split} ${styles.einzeln}`}>
        <SeitenUmschalter
          label={`${leftLabel} oder ${rightLabel}`}
          seiten={[
            { id: "links", label: leftLabel },
            { id: "rechts", label: rightLabel },
          ]}
          gewaehlt={seite}
          onWaehle={(neu) => {
            setGewaehlteSeite(neu);
            if (neu === "links") onLinksGewaehlt?.();
          }}
        />
        {/* Die linke Seite bleibt verborgen stehen, statt abgebaut zu werden:
            in ihr steht, was man gerade schreibt -- ein halb ausgefuelltes
            POI-Formular, waehrend man auf der Karte die Position setzt, oder
            die laufende Unterhaltung im Chat. */}
        <div
          className={`${styles.pane} ${styles.einzelnLinks}`}
          data-testid="split-pane-left"
          hidden={seite !== "links"}
        >
          {left}
        </div>
        {seite === "rechts" && (
          <div className={styles.pane} data-testid="split-pane-right">
            {right}
          </div>
        )}
      </div>
    );
  }

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
