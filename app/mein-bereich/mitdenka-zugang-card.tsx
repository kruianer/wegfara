"use client";

import { useState } from "react";
import type { MitdenkaZugangStand } from "@/lib/werkzeuge/zugang";
import styles from "./zugangsschluessel-card.module.css";
import eigen from "./mitdenka-zugang-card.module.css";

const MITDENKA_ZUGANG_API = "/api/mitdenka-zugang";

/** Was die Karte sagt, wenn etwas nicht geklappt hat. */
export const MITDENKA_ZUGANG_FEHLER = {
  erzeugen: "Der Schlüssel konnte nicht erzeugt werden.",
  widerrufen: "Der Schlüssel konnte nicht widerrufen werden.",
} as const;

/** Der Hinweis neben dem frisch erzeugten Schlüssel (req-104, GUI). */
export const MITDENKA_EINMAL_HINWEIS =
  "Kopiere ihn jetzt in mitdenka — danach ist er hier nicht mehr zu sehen.";

/** "5 von 50" -- die Abfragen bei Google heute über diese Schnittstelle. */
export function googleStandText(stand: MitdenkaZugangStand): string {
  return `${stand.googleAbfragenHeute} von ${stand.googleGrenze}`;
}

/**
 * Die Karte "Zugang fuer mitdenka" in "Mein Bereich" (req-104): ein
 * Schluessel je Account, mit dem mitdenka die Reisen des Accounts lesen
 * kann -- nur lesen.
 *
 * Der Schluessel steht genau einmal da, direkt nach dem Erzeugen, mit einem
 * Knopf zum Kopieren. Danach kennt ihn die App nicht mehr: nach dem Neuladen
 * steht nur noch, dass es einen gibt, wann er zuletzt benutzt wurde und wie
 * viele Google-Abfragen heute ueber ihn liefen.
 *
 * Die Karte sieht nur ein Account-Admin (siehe MeinBereichView); die
 * Schnittstelle prueft dasselbe noch einmal serverseitig.
 */
export function MitdenkaZugangCard({
  stand: anfangsStand,
}: {
  stand: MitdenkaZugangStand;
}) {
  const [stand, setStand] = useState(anfangsStand);
  const [schluessel, setSchluessel] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function anfrage(
    method: "POST" | "DELETE",
    fehlerText: string,
  ): Promise<{ schluessel?: string; stand?: MitdenkaZugangStand } | null> {
    setBusy(true);
    setFehler(null);
    try {
      const response = await fetch(MITDENKA_ZUGANG_API, { method });
      if (!response.ok) throw new Error(`http-${response.status}`);
      return (await response.json()) as {
        schluessel?: string;
        stand?: MitdenkaZugangStand;
      };
    } catch {
      setFehler(fehlerText);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function erzeugen() {
    const antwort = await anfrage("POST", MITDENKA_ZUGANG_FEHLER.erzeugen);
    if (!antwort?.schluessel || !antwort.stand) {
      if (antwort) setFehler(MITDENKA_ZUGANG_FEHLER.erzeugen);
      return;
    }
    setKopiert(false);
    setSchluessel(antwort.schluessel);
    setStand(antwort.stand);
  }

  async function widerrufen() {
    const antwort = await anfrage("DELETE", MITDENKA_ZUGANG_FEHLER.widerrufen);
    if (!antwort?.stand) {
      if (antwort) setFehler(MITDENKA_ZUGANG_FEHLER.widerrufen);
      return;
    }
    setSchluessel(null);
    setStand(antwort.stand);
  }

  async function kopieren() {
    if (!schluessel) return;
    try {
      await navigator.clipboard.writeText(schluessel);
      setKopiert(true);
    } catch {
      // Ohne Zugriff auf die Zwischenablage bleibt der Schluessel markierbar
      // stehen -- er laesst sich dann von Hand kopieren.
      setKopiert(false);
    }
  }

  return (
    <section className={styles.card} aria-label="Zugang für mitdenka">
      <h2 className={styles.cardTitle}>Zugang für mitdenka</h2>
      <p className={styles.intro}>
        Mit diesem Schlüssel liest mitdenka die Reisen dieses Accounts — nur
        lesen, ändern kann es nichts. Es gibt höchstens einen; ein neuer ersetzt
        den alten.
      </p>

      {schluessel && (
        <div className={eigen.einmal} data-testid="mitdenka-schluessel">
          <code className={eigen.schluessel}>{schluessel}</code>
          <p className={eigen.hinweis}>{MITDENKA_EINMAL_HINWEIS}</p>
          <button
            type="button"
            className={`${styles.actionButton} ${eigen.knopf}`}
            onClick={() => void kopieren()}
          >
            {kopiert ? "Kopiert" : "Kopieren"}
          </button>
        </div>
      )}

      <dl className={eigen.angaben}>
        <div className={eigen.angabe}>
          <dt>Schlüssel</dt>
          <dd>{stand.vorhanden ? "Erzeugt" : "Keiner erzeugt"}</dd>
        </div>
        <div className={eigen.angabe}>
          <dt>Zuletzt benutzt</dt>
          <dd data-testid="mitdenka-zuletzt-benutzt">
            {stand.vorhanden ? (stand.zuletztBenutzt ?? "noch nie") : "—"}
          </dd>
        </div>
        <div className={eigen.angabe}>
          <dt>Google-Abfragen heute</dt>
          <dd data-testid="mitdenka-google-stand">{googleStandText(stand)}</dd>
        </div>
      </dl>

      <div className={eigen.aktionen}>
        <button
          type="button"
          className={`${styles.actionButton} ${eigen.knopf}`}
          onClick={() => void erzeugen()}
          disabled={busy}
        >
          {stand.vorhanden ? "Neuen Schlüssel erzeugen" : "Schlüssel erzeugen"}
        </button>
        {stand.vorhanden && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.dangerButton} ${eigen.knopf}`}
            onClick={() => void widerrufen()}
            disabled={busy}
          >
            Widerrufen
          </button>
        )}
      </div>

      {fehler && (
        <p className={styles.notice} role="alert">
          {fehler}
        </p>
      )}
    </section>
  );
}
