"use client";

import { useEffect, useRef } from "react";
import styles from "./trenner.module.css";

/**
 * Der Trenner zwischen zwei Spalten, an dem sich ziehen laesst -- in den
 * Bereichen POIs und Chat (SplitView) und seit req-109 zweimal in der
 * Planung. Er steht an genau einer Stelle: zwei Fassungen desselben Trenners
 * liefen auseinander (vgl. req-082, bug-048 gegen bug-065).
 *
 * Er weiss nichts von Breiten. Er meldet, dass gezogen wird, und um wie viele
 * Pixel der Zeiger seit dem Anfassen gewandert ist; was daraus folgt,
 * entscheidet, wer ihn setzt -- und merkt sich dafuer beim Anfassen, wie die
 * Spalten standen.
 */
export function Trenner({
  label,
  onZugBeginn,
  onZiehen,
  onZugEnde,
  testId,
}: {
  /** Was der Trenner einteilt -- fuer Vorlesehilfen (req-109). */
  label: string;
  onZugBeginn?: () => void;
  /** Wie weit der Zeiger seit dem Anfassen gewandert ist, nach rechts positiv. */
  onZiehen: (versatzPx: number) => void;
  onZugEnde?: () => void;
  testId?: string;
}) {
  // Der laufende Zug steht in einer Referenz und nicht im Zustand: er aendert
  // sich mit jedem Zeigerschritt, und neu gezeichnet wird dafuer nichts.
  const zugRef = useRef<{ pointerId: number; startX: number } | null>(null);
  // Die Rueckmeldungen ebenso: die Fenster-Ereignisse sollen nicht bei jedem
  // Zeichnen ab- und wieder angemeldet werden, aber stets die neuesten rufen.
  const meldeRef = useRef({ onZiehen, onZugEnde });
  useEffect(() => {
    meldeRef.current = { onZiehen, onZugEnde };
  });

  // Gezogen wird ueber Zeiger-Ereignisse und nicht ueber Maus-Ereignisse
  // (bug-031): Safari auf dem iPad schickt zu einem Finger keine
  // `mousemove`-Ereignisse, die Leiste liess sich dort also gar nicht
  // verschieben. Zeiger-Ereignisse kommen von Maus, Finger und Stift
  // gleichermassen -- wie beim Ziehen der POIs (bug-017).
  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const zug = zugRef.current;
      if (!zug || zug.pointerId !== e.pointerId) return;
      meldeRef.current.onZiehen(e.clientX - zug.startX);
    }
    // Loslassen und Abbrechen enden gleich: der Zug ist vorbei. Abgebrochen
    // wird er, wenn der Browser den Zeiger an sich nimmt.
    function handlePointerEnd(e: PointerEvent) {
      if (zugRef.current?.pointerId === e.pointerId) {
        zugRef.current = null;
        meldeRef.current.onZugEnde?.();
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
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Nur der erste Finger bzw. die Haupttaste zieht; ein zweiter Zeiger
    // wuerde den laufenden Zug sonst uebernehmen.
    if (zugRef.current || e.button !== 0) return;
    zugRef.current = { pointerId: e.pointerId, startX: e.clientX };
    onZugBeginn?.();
    // Ab hier gehoeren alle Zeiger-Ereignisse der Leiste, auch wenn der
    // Finger sie laengst verlassen hat (jsdom kennt das nicht).
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  return (
    <div
      className={styles.trenner}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      data-testid={testId}
      onPointerDown={handlePointerDown}
    >
      <span className={styles.grip} aria-hidden="true" />
    </div>
  );
}
