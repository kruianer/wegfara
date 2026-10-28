"use client";

import { useState } from "react";
import type { DruckTageszeile } from "@/lib/druck/types";
import {
  TAGES_UEBERSCHRIFT_MAX_LENGTH,
  type TagesUeberschrift,
} from "@/lib/druck/ueberschriften";
import {
  erzeugeUeberschriften,
  setzeUeberschrift,
  type UeberschriftenErgebnis,
} from "@/lib/druck/save-ueberschriften";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import styles from "./reiseplan-druck.module.css";

/**
 * Die Ueberschriften der Reisetage fuer Seite 2 (req-103) -- nur am
 * Bildschirm, neben dem Heft, wie die Kennzeichen der Programmpunkte.
 *
 * Die KI schlaegt sie auf Knopfdruck vor, einmal, und das Ergebnis wird
 * gespeichert. Jede laesst sich ueberschreiben; was von Hand geschrieben ist,
 * ruehrt die KI danach nicht mehr an. Ohne Ueberschrift stehen die Orte des
 * Tages da -- auch ohne Zugangsschluessel ist der Plan vollstaendig.
 */
export function UeberschriftenSteuerung({
  tripId,
  zeilen,
  ueberschriften,
  hasAiKey,
  onChange,
}: {
  tripId: string;
  /** Die Zeilen der Tagesliste -- ihre Ueberschrift ist der Platzhalter. */
  zeilen: DruckTageszeile[];
  ueberschriften: TagesUeberschrift[];
  hasAiKey: boolean;
  onChange: (ueberschriften: TagesUeberschrift[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>({});
  const nachDatum = new Map(ueberschriften.map((u) => [u.datum, u]));

  async function fuehreAus(schritt: () => Promise<UeberschriftenErgebnis>) {
    setBusy(true);
    setProblem(null);
    const ergebnis = await schritt();
    setBusy(false);
    if (!ergebnis.ok) {
      setProblem(ergebnis.error);
      return false;
    }
    onChange(ergebnis.ueberschriften);
    return true;
  }

  function erzeuge() {
    if (!hasAiKey) {
      setProblem(apiKeyMissingHint("ki_suche"));
      return;
    }
    void fuehreAus(() => erzeugeUeberschriften(tripId));
  }

  /** Der Entwurf eines Tages ist erledigt -- das Feld zeigt wieder den Stand. */
  function verwirf(datum: string) {
    setEntwuerfe((alt) => {
      const rest = { ...alt };
      delete rest[datum];
      return rest;
    });
  }

  async function speichere(datum: string) {
    const entwurf = entwuerfe[datum];
    if (entwurf === undefined) return;
    const bisher = nachDatum.get(datum)?.text ?? "";
    if (entwurf.trim() === bisher) {
      verwirf(datum);
      return;
    }
    if (await fuehreAus(() => setzeUeberschrift(tripId, datum, entwurf))) {
      verwirf(datum);
    }
  }

  return (
    <div
      className={styles.nurBildschirm}
      data-testid="ueberschriften-steuerung"
    >
      <h2>Überschriften der Tage</h2>
      <p>
        Auf Seite 2 steht je Reisetag eine Überschrift. Die KI schlägt sie
        einmal vor, gespeichert wird das Ergebnis — jede lässt sich hier
        überschreiben, und was von Hand geschrieben ist, bleibt stehen. Ohne
        Überschrift stehen die Orte des Tages da.
      </p>
      <button
        type="button"
        className={styles.steuerungKnopf}
        disabled={busy}
        onClick={erzeuge}
      >
        {busy
          ? "Wird erzeugt …"
          : "Überschriften von der KI vorschlagen lassen"}
      </button>
      {problem && (
        <p className={styles.steuerungFehler} role="alert">
          {problem}
        </p>
      )}
      {zeilen.map((zeile) => {
        const gespeichert = nachDatum.get(zeile.datum);
        return (
          <label key={zeile.datum} className={styles.steuerungZeile}>
            <span className={styles.steuerungZeit}>Tag {zeile.nummer}</span>
            <input
              className={styles.steuerungFeld}
              data-testid={`ueberschrift-${zeile.datum}`}
              aria-label={`Überschrift von Tag ${zeile.nummer}`}
              maxLength={TAGES_UEBERSCHRIFT_MAX_LENGTH}
              placeholder={zeile.ueberschrift}
              value={entwuerfe[zeile.datum] ?? gespeichert?.text ?? ""}
              disabled={busy}
              onChange={(event) =>
                setEntwuerfe((alt) => ({
                  ...alt,
                  [zeile.datum]: event.target.value,
                }))
              }
              onBlur={() => void speichere(zeile.datum)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className={styles.steuerungHerkunft}>
              {gespeichert ? (gespeichert.vonHand ? "von Hand" : "KI") : ""}
            </span>
          </label>
        );
      })}
    </div>
  );
}
