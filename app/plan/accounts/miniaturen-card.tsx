"use client";

import { useEffect, useRef, useState } from "react";
import {
  MINIATUREN_FEHLER,
  requestMiniaturenSchritt,
} from "@/lib/miniaturen/request-miniaturen";
import type {
  MiniaturenSchritt,
  MiniaturenStand,
} from "@/lib/miniaturen/types";
import cards from "./backups-card.module.css";
import styles from "./miniaturen-card.module.css";

export const MINIATUREN_HINWEIS =
  "Listen und Kacheln zeigen jedes Foto in einer verkleinerten Fassung, die " +
  "Vergrößerung das Original. Neue Fotos bekommen sie beim Speichern; für " +
  "die vorhandenen erzeugt dieser Lauf sie nachträglich. Er lässt sich " +
  "abbrechen und gefahrlos wiederholen — was schon eine hat, wird " +
  "übersprungen.";

export const MINIATUREN_OHNE_ABLAGE =
  "Das Bildverzeichnis ist nicht eingerichtet.";

interface Zaehler {
  geprueft: number;
  bilder: number;
  erzeugt: number;
  fehlgeschlagen: number;
}

function bilderText(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? "Bild" : "Bildern"}`;
}

function ergebnisText(zaehler: Zaehler, abgebrochen: boolean): string {
  const neu = `${zaehler.erzeugt} ${
    zaehler.erzeugt === 1 ? "Miniatur" : "Miniaturen"
  } neu erzeugt`;
  const fehl =
    zaehler.fehlgeschlagen > 0
      ? `, ${zaehler.fehlgeschlagen} nicht möglich — diese zeigen weiter das Original`
      : "";
  return abgebrochen
    ? `Abgebrochen nach ${zaehler.geprueft} von ${bilderText(zaehler.bilder)}: ${neu}${fehl}.`
    : `Fertig: ${neu}${fehl}.`;
}

/**
 * Die Miniaturen in der "Verwaltung" (req-105) -- der einmalige Lauf fuer
 * die Bilder, die schon vor den Miniaturen da waren.
 *
 * Den Lauf fuehrt die Karte selbst, Schritt fuer Schritt: jeder Schritt ist
 * eine eigene Anfrage, und zwischen zwei Schritten laesst er sich anhalten.
 * Der Server haelt nichts fest -- abgebrochen ist er, sobald nicht mehr
 * gefragt wird.
 */
export function MiniaturenCard({
  stand: initial,
  schritt = requestMiniaturenSchritt,
}: {
  /** null, wenn es kein Bildverzeichnis gibt. */
  stand: MiniaturenStand | null;
  /** Nur fuer den Test -- sonst die Anfrage an /api/miniaturen. */
  schritt?: (nach: string | null) => Promise<MiniaturenSchritt | null>;
}) {
  const [stand, setStand] = useState(initial);
  const [laeuft, setLaeuft] = useState(false);
  const [zaehler, setZaehler] = useState<Zaehler | null>(null);
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abbrechen = useRef(false);

  // Wer die Seite verlaesst, haelt den Lauf an -- es fragt dann niemand mehr.
  useEffect(
    () => () => {
      abbrechen.current = true;
    },
    [],
  );

  async function starten() {
    abbrechen.current = false;
    setLaeuft(true);
    setNotice(null);
    setErgebnis(null);
    let summe: Zaehler = {
      geprueft: 0,
      bilder: stand?.bilder ?? 0,
      erzeugt: 0,
      fehlgeschlagen: 0,
    };
    setZaehler(summe);

    let nach: string | null = null;
    for (;;) {
      const antwort = await schritt(nach);
      if (!antwort) {
        setNotice(MINIATUREN_FEHLER);
        break;
      }
      summe = {
        geprueft: antwort.geprueft,
        bilder: antwort.bilder,
        erzeugt: summe.erzeugt + antwort.erzeugt,
        fehlgeschlagen: summe.fehlgeschlagen + antwort.fehlgeschlagen,
      };
      setZaehler(summe);
      setStand({ bilder: antwort.bilder, mitMiniatur: antwort.mitMiniatur });

      if (antwort.weiter === null) {
        setErgebnis(ergebnisText(summe, false));
        break;
      }
      if (abbrechen.current) {
        setErgebnis(ergebnisText(summe, true));
        break;
      }
      nach = antwort.weiter;
    }
    setLaeuft(false);
  }

  return (
    <section className={cards.card} aria-label="Miniaturen">
      <h2 className={cards.cardTitle}>
        Miniaturen
        {stand && (
          <span className={cards.count} data-testid="miniaturen-stand">
            {` · ${stand.mitMiniatur} von ${bilderText(stand.bilder)}`}
          </span>
        )}
      </h2>
      <p className={styles.hint}>{MINIATUREN_HINWEIS}</p>

      {!stand && <p className={cards.empty}>{MINIATUREN_OHNE_ABLAGE}</p>}

      {zaehler && (
        <div data-testid="miniaturen-fortschritt">
          <progress
            className={styles.balken}
            aria-label="Fortschritt der Miniaturen"
            value={zaehler.geprueft}
            max={Math.max(zaehler.bilder, 1)}
          />
          <p className={styles.fortschritt}>
            {`Geprüft ${zaehler.geprueft} von ${bilderText(zaehler.bilder)} · ${zaehler.erzeugt} neu`}
            {zaehler.fehlgeschlagen > 0 &&
              ` · ${zaehler.fehlgeschlagen} nicht möglich`}
          </p>
        </div>
      )}

      {ergebnis && (
        <p className={styles.ergebnis} role="status">
          {ergebnis}
        </p>
      )}
      {notice && (
        <p className={cards.notice} role="alert">
          {notice}
        </p>
      )}

      <div className={cards.actions}>
        {laeuft ? (
          <button
            type="button"
            className={cards.addButton}
            onClick={() => {
              abbrechen.current = true;
            }}
          >
            Abbrechen
          </button>
        ) : (
          <button
            type="button"
            className={cards.addButton}
            disabled={!stand}
            onClick={() => void starten()}
          >
            Fehlende Miniaturen erzeugen
          </button>
        )}
      </div>
    </section>
  );
}
