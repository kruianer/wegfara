"use client";

import { useEffect, useId, useState } from "react";
import { API_KEY_LABEL } from "@/lib/api-keys/types";
import { holeKiModelle, speichereKiModell } from "@/lib/ki-modelle/karte";
import {
  KI_ZWECK_ERKLAERUNG,
  KI_ZWECK_LABEL,
  KI_ZWECK_SCHLUESSEL,
  type KiModellEintrag,
  type KiModellFeld,
} from "@/lib/ki-modelle/zwecke";
import styles from "./zugangsschluessel-card.module.css";
import eigen from "./ki-modelle-card.module.css";

const DATUM = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const ZEITPUNKT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

/** "2027-03-12" als "12.03.2027". */
export function abschaltDatumText(tag: string): string {
  return DATUM.format(new Date(`${tag}T00:00:00Z`));
}

/** Die Beschriftung in der Auswahl -- das Abschaltdatum steht daneben. */
export function kiModellBeschriftung(eintrag: KiModellEintrag): string {
  return eintrag.abschaltungAm === null
    ? eintrag.name
    : `${eintrag.name} — wird am ${abschaltDatumText(eintrag.abschaltungAm)} abgeschaltet`;
}

/** Der Hinweis, wenn der Schluessel fehlt -- er verweist auf die Karte darueber. */
export function kiModellSchluesselHinweis(feld: KiModellFeld): string {
  return `Für „${API_KEY_LABEL[KI_ZWECK_SCHLUESSEL[feld.zweck]]}“ ist kein Zugangsschlüssel hinterlegt. Hinterlege ihn in der Karte „Zugangsschlüssel“ darüber — dann stehen hier die Modelle des Dienstes.`;
}

/** Die Warnung, wenn der Dienst das eingestellte Modell nicht mehr nennt. */
export function kiModellVerschwundenText(modell: string): string {
  return `Das Modell „${modell}“ nennt der Dienst nicht mehr — damit kann diese Funktion nicht arbeiten. Wähle ein anderes.`;
}

function KiModellAuswahl({
  feld,
  onGespeichert,
}: {
  feld: KiModellFeld;
  onGespeichert: (felder: KiModellFeld[]) => void;
}) {
  const feldId = useId();
  const [entwurf, setEntwurf] = useState(feld.gewaehlt ?? "");
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const label = KI_ZWECK_LABEL[feld.zweck];

  async function speichern() {
    setSpeichert(true);
    setFehler(null);
    const ergebnis = await speichereKiModell(
      feld.zweck,
      entwurf === "" ? null : entwurf,
    );
    setSpeichert(false);
    // Scheitert es, bleibt die Wahl stehen und die Karte sagt es (bug-021).
    if (!ergebnis.ok) {
      setFehler(ergebnis.fehler);
      return;
    }
    onGespeichert(ergebnis.felder);
  }

  const modelle = feld.modelle ?? [];
  const gewaehltFehlt =
    feld.gewaehlt !== null &&
    !modelle.some((eintrag) => eintrag.id === feld.gewaehlt);

  return (
    <div className={eigen.feld} data-testid={`ki-modell-${feld.zweck}`}>
      <label className={styles.rowName} htmlFor={feldId}>
        {label}
      </label>
      <p className={eigen.zweck}>{KI_ZWECK_ERKLAERUNG[feld.zweck]}</p>
      {feld.verschwunden && (
        <p className={eigen.warnung} role="alert">
          {kiModellVerschwundenText(feld.verschwunden)}
        </p>
      )}
      <div className={eigen.zeile}>
        <select
          id={feldId}
          className={eigen.auswahl}
          value={entwurf}
          onChange={(event) => setEntwurf(event.target.value)}
        >
          <option value="">
            {feld.ohneWahl
              ? `Nichts gewählt — es gilt ${feld.ohneWahl}`
              : "Nichts gewählt"}
          </option>
          {gewaehltFehlt && feld.gewaehlt !== null && (
            <option value={feld.gewaehlt}>
              {`${feld.gewaehlt} — nicht mehr verfügbar`}
            </option>
          )}
          {modelle.map((eintrag) => (
            <option key={eintrag.id} value={eintrag.id}>
              {kiModellBeschriftung(eintrag)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.actionButton} ${eigen.knopf}`}
          aria-label={`${label}: Wahl speichern`}
          disabled={speichert || entwurf === (feld.gewaehlt ?? "")}
          onClick={() => void speichern()}
        >
          {speichert ? "Speichert…" : "Speichern"}
        </button>
      </div>
      {feld.gemerktAm && (
        <p className={eigen.hinweis} role="status">
          {`Der Dienst antwortet gerade nicht. Die Liste ist gemerkt — Stand ${ZEITPUNKT.format(new Date(feld.gemerktAm))}.`}
        </p>
      )}
      {fehler && (
        <p className={styles.notice} role="alert">
          {fehler}
        </p>
      )}
    </div>
  );
}

/**
 * Die Karte "KI-Modelle" in "Mein Bereich" (req-108), neben den
 * Zugangsschluesseln: sie betrifft dieselben Dienste und wird vom selben
 * Account bezahlt. Je Zweck ein Auswahlfeld mit den Modellen, die der Dienst
 * selbst nennt -- nie eine Liste aus dem Quelltext.
 *
 * Geholt wird beim Oeffnen und erneut, sobald sich die Zugangsschluessel
 * aendern (`schluesselStand`): ein neu hinterlegter Schluessel bringt seine
 * Modelle mit.
 */
export function KiModelleCard({
  schluesselStand,
}: {
  schluesselStand: string;
}) {
  const [felder, setFelder] = useState<KiModellFeld[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  useEffect(() => {
    let aktuell = true;
    void holeKiModelle().then((ergebnis) => {
      if (!aktuell) return;
      if (ergebnis.ok) {
        setFelder(ergebnis.felder);
        setLadeFehler(null);
      } else {
        setLadeFehler(ergebnis.fehler);
      }
    });
    return () => {
      aktuell = false;
    };
  }, [schluesselStand]);

  return (
    <section className={styles.card} aria-label="KI-Modelle">
      <h2 className={styles.cardTitle}>KI-Modelle</h2>
      <p className={styles.intro}>
        Welche Modelle die KI-Funktionen benutzen. Zur Wahl steht, was der
        Dienst selbst nennt. OpenAI trennt dabei Bild- und Textmodelle nicht —
        „Fragen“ und „Bilder“ zeigen deshalb dieselbe Liste; wähle für „Bilder“
        ein Modell, das Bilder erzeugt.
      </p>
      {felder === null && !ladeFehler && (
        <p className={styles.state} role="status">
          Die Modelle werden geholt…
        </p>
      )}
      {ladeFehler && (
        <p className={styles.notice} role="alert">
          {ladeFehler}
        </p>
      )}
      {felder && (
        <ul className={styles.list}>
          {felder.map((feld) => (
            // Aendert sich die Wahl, beginnt das Feld mit ihr neu; die
            // anderen behalten, was darin gerade ausgesucht ist.
            <li
              key={`${feld.zweck}:${feld.gewaehlt ?? ""}`}
              className={styles.item}
            >
              {feld.grund === "schluessel" ? (
                <div
                  className={eigen.feld}
                  data-testid={`ki-modell-${feld.zweck}`}
                >
                  <div className={styles.rowName}>
                    {KI_ZWECK_LABEL[feld.zweck]}
                  </div>
                  <p className={eigen.hinweis}>
                    {kiModellSchluesselHinweis(feld)}
                  </p>
                </div>
              ) : feld.grund === "dienst" ? (
                <div
                  className={eigen.feld}
                  data-testid={`ki-modell-${feld.zweck}`}
                >
                  <div className={styles.rowName}>
                    {KI_ZWECK_LABEL[feld.zweck]}
                  </div>
                  <p className={eigen.hinweis}>
                    Die Liste der Modelle ist gerade nicht zu holen — der Dienst
                    antwortet nicht. Es gilt weiter{" "}
                    {feld.gewaehlt ?? feld.ohneWahl ?? "der Standard"}.
                  </p>
                </div>
              ) : (
                <KiModellAuswahl feld={feld} onGespeichert={setFelder} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
