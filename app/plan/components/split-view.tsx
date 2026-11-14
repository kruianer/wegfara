"use client";

import { useEffect, useRef, useState } from "react";
import { FullscreenExitIcon, FullscreenIcon } from "@/components/icons";
import {
  LISTE_UND_KARTE_NEBENEINANDER_AB_PX,
  SPALTEN_NEBENEINANDER_AB_PX,
} from "@/lib/plan/spalten";
import { SeitenUmschalter } from "./seiten-umschalter";
import styles from "./split-view.module.css";

type SplitSeite = "links" | "rechts";

/**
 * Die Mindestbreite der linken Seite: Darunter bricht die dreispaltige Zeile
 * der POI-Liste (req-097). Sie ist die Untergrenze beim Ziehen am Trenner --
 * die Breite, mit der die Liste startet, rechnet `listenBreite`.
 */
const MIN_LEFT_WIDTH_PX = 324;
const RIGHT_MARGIN_PX = 480;

/**
 * Welchen Anteil des Schirms die Liste nimmt, solange niemand am Trenner
 * gezogen hat (req-106). Auf dem iPad quer sind das rund 460 px -- dort darf
 * die Liste gross sein, weil sowieso nur eine Seite nach der anderen
 * betrachtet wird.
 */
const LISTE_ANTEIL = 0.45;

/**
 * Wie breit die Liste hoechstens startet (req-106). Die Zahl ist nicht
 * gewaehlt, sondern gerechnet: Bei 640 px bleiben der Mittelspalte 422 px,
 * das sind rund 73 Zeichen je Zeile und mit drei Zeilen 219 -- mehr als die
 * 200 Zeichen, die ein Kurztext hoechstens hat
 * (POI_SHORT_TEXT_MAX_LENGTH). Breiter zu werden zeigt also keinen Text
 * mehr, es fuellt nur Leerraum.
 *
 * Vorher waren es 324 bis 366 px (req-097). Dort passten 18 bis 25 Zeichen
 * in eine Zeile: vom Kurztext war gut ein Viertel zu sehen, der Rest stand
 * hinter dem Auslassungszeichen.
 *
 * Deshalb waechst die Liste nicht mit dem Schirm weiter: Bei 4K nimmt sie
 * 17 Prozent der Breite, und alles Uebrige geht an die Karte -- ohne dass
 * ein Zeichen Text verloren geht.
 */
const LISTE_MAX_BREITE_PX = 640;

/**
 * Wie breit die POI-Liste steht, solange niemand am Trenner gezogen hat
 * (req-106): ein Anteil des Schirms, bis der Kurztext ganz hineinpasst.
 *
 * | Schirm | Liste | Anteil |
 * | -----: | ----: | -----: |
 * |   1024 |   461 |    45% |
 * |   1280 |   576 |    45% |
 * |   1440 |   640 |    44% |
 * |   1920 |   640 |    33% |
 * |   3840 |   640 |    17% |
 */
export function listenBreite(fensterbreite: number): number {
  return Math.round(
    Math.max(
      MIN_LEFT_WIDTH_PX,
      Math.min(LISTE_MAX_BREITE_PX, fensterbreite * LISTE_ANTEIL),
    ),
  );
}

/**
 * Zwei Seiten nebeneinander, am Trenner verschiebbar -- in den Bereichen POIs
 * (Liste und Karte) und Chat (Chatfenster und Karte).
 *
 * Seit req-088 laeuft der Planer auch auf dem iPad hochkant, und dort haben
 * beide Seiten nicht nebeneinander Platz (lib/plan/spalten.ts). Darunter
 * steht deshalb eine Seite allein ueber die ganze Breite, und ein Umschalter
 * darueber waehlt, welche. Die POI-Liste steht seit req-097 schon ab 1024 px
 * neben der Karte (siehe `linksListe`).
 */
export function SplitView({
  windowWidth,
  left,
  right,
  leftLabel = "Liste",
  rightLabel = "Karte",
  rechtsZeigen = false,
  onLinksGewaehlt,
  linksListe = false,
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
  /**
   * Die linke Seite ist die POI-Liste (req-097): sie steht in ihrer eigenen,
   * kaum wachsenden Breite statt in der halben Fensterbreite, und weil sie so
   * schmal ist, schon ab dem iPad quer neben der Karte.
   */
  linksListe?: boolean;
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
  const leftWidth =
    leftWidthOverride ??
    (linksListe ? listenBreite(windowWidth) : windowWidth / 2);
  const nebeneinander =
    windowWidth >=
    (linksListe
      ? LISTE_UND_KARTE_NEBENEINANDER_AB_PX
      : SPALTEN_NEBENEINANDER_AB_PX);

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

  if (!nebeneinander) {
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
