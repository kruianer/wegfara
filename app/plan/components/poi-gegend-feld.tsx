"use client";

import { useRef, useState } from "react";
import {
  GEGEND_MAX_LAENGE,
  gegendInDerListe,
  gegendZuLang,
  normalisiereGegend,
} from "@/lib/pois/gegenden";
import styles from "./poi-list.module.css";

/** Was die Liste sagt, wenn eine Gegend zu lang ist (req-101, req-107). */
export const GEGEND_ZU_LANG_TEXT = `Eine Gegend ist ein Kürzel aus höchstens ${GEGEND_MAX_LAENGE} Zeichen.`;

/**
 * Die Gegend in der Zeile der POI-Liste (req-107) -- mit einem Griff zu
 * setzen wie der Status daneben. Vorgeschlagen werden die Gegenden der Reise
 * (die Datenliste unter `vorschlaegeId`); eine neue entsteht einfach durch
 * Eintippen, denn benannt wird sie immer von Hand (req-101).
 *
 * Gespeichert wird beim Verlassen des Feldes und mit der Eingabetaste. Was
 * GEGEND_MAX_LAENGE uebersteigt, wird abgewiesen und nie gekuerzt; ein leeres
 * Feld nimmt die Gegend. Scheitert das Speichern, bleibt die Eingabe stehen --
 * gesagt wird es von der Liste (bug-021).
 */
export function PoiGegendFeld({
  poiId,
  poiName,
  gegend,
  vorschlaegeId,
  onSpeichern,
  onZuLang,
}: {
  poiId: string;
  poiName: string;
  gegend: string | null | undefined;
  /** Die Kennung der Datenliste mit den Gegenden der Reise. */
  vorschlaegeId: string;
  /** Liefert, ob die Gegend angekommen ist. null nimmt sie. */
  onSpeichern: (gegend: string | null) => Promise<boolean>;
  /** Ob gerade eine zu lange Eingabe abgewiesen ist -- die Liste sagt es. */
  onZuLang: (zuLang: boolean) => void;
}) {
  const gespeichert = normalisiereGegend(gegend ?? null);
  // Was im Feld steht, solange es vom Gespeicherten abweicht -- beim Tippen,
  // bei einer abgewiesenen und bei einer nicht angekommenen Eingabe. null
  // heisst: das Feld zeigt die gespeicherte Gegend.
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  // Ob der Platzhalter ohne Gegend gerade zum Feld geworden ist.
  const [bearbeiten, setBearbeiten] = useState(false);
  // Die Eingabe, die gerade gespeichert wird -- die Eingabetaste und das
  // Verlassen danach speichern sie nicht zweimal.
  const unterwegs = useRef<string | null | undefined>(undefined);

  async function uebernehmen(wert: string) {
    if (gegendZuLang(wert)) {
      setFehler(true);
      onZuLang(true);
      return;
    }
    onZuLang(false);
    const neu = normalisiereGegend(wert);
    if (neu === gespeichert && !fehler) {
      setEntwurf(null);
      return;
    }
    if (unterwegs.current === neu) return;
    unterwegs.current = neu;
    const angekommen = await onSpeichern(neu);
    unterwegs.current = undefined;
    if (angekommen) {
      setEntwurf(null);
      setFehler(false);
      return;
    }
    // Die Eingabe bleibt stehen -- wer es nochmal versucht, muss nicht
    // neu tippen.
    setEntwurf(wert);
    setFehler(true);
  }

  if (gespeichert === null && entwurf === null && !bearbeiten) {
    const leer = gegendInDerListe({ gegend: undefined });
    return (
      <button
        type="button"
        className={styles.gegendPlatzhalter}
        data-testid={`poi-gegend-${poiId}`}
        aria-label={`Gegend von ${poiName}`}
        title={leer.titel}
        onClick={() => setBearbeiten(true)}
      >
        <span className={`${styles.gegend} ${styles.gegendLeer}`}>
          {leer.text}
        </span>
      </button>
    );
  }

  return (
    <input
      className={`${styles.gegend} ${styles.gegendFeld}`}
      data-testid={`poi-gegend-${poiId}`}
      aria-label={`Gegend von ${poiName}`}
      aria-invalid={fehler || undefined}
      type="text"
      autoComplete="off"
      // Der Platzhalter ist eben angetippt worden -- man will gleich tippen.
      autoFocus={bearbeiten}
      list={vorschlaegeId}
      value={entwurf ?? gespeichert ?? ""}
      onChange={(event) => setEntwurf(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        void uebernehmen(event.currentTarget.value);
      }}
      onBlur={(event) => {
        const wert = event.currentTarget.value;
        setBearbeiten(false);
        void uebernehmen(wert);
      }}
    />
  );
}
