"use client";

import type { DruckDeckblatt, Reiseplan } from "@/lib/druck/types";
import { APP_NAME } from "@/lib/marke";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import { CompassIcon } from "@/components/compass-icon";
import { KiBildMarke } from "@/components/ki-bild-marke";
import styles from "./reiseplan-druck.module.css";

/**
 * Der Reiseplan zum Ausdrucken (req-080) -- das Heft, das der Reiseleiter vor
 * der Reise verschickt und aushaendigt.
 *
 * Gesetzt fuer **A4 hoch, randlos**: Farbflaechen und Fotos laufen bis an die
 * Blattkante, der Textsatz haelt 15 mm Sicherheitsrand. Das PDF entsteht ueber
 * die Druckfunktion des Browsers -- serverseitig erzeugt wird in diesem
 * Schritt keines (req-080, Constraints).
 *
 * Was auf den Seiten steht, rechnet lib/druck/; diese Datei zeichnet es. Die
 * verbindliche Vorlage fuer das Aussehen ist das Mockup
 * (delivery/design/reiseplan-druck/variante-c-magazin.mockup.html).
 */

/**
 * Seite 1 -- Bild und Dashboard. Das Foto nimmt die oberen zwei Drittel,
 * randlos bis an drei Kanten; Titel und Ort liegen darauf, wo ein Verlauf
 * fuer Lesbarkeit sorgt. Das untere Drittel traegt Beschreibung, vier Zahlen
 * und die Eckdaten.
 */
function Deckblatt({ deckblatt }: { deckblatt: DruckDeckblatt }) {
  return (
    <section
      className={`${styles.seite} ${styles.deckblatt}`}
      data-testid="druck-deckblatt"
    >
      <div className={styles.titelBild}>
        {deckblatt.titelFoto && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- siehe Bild() */}
            <img
              className={styles.titelBildFoto}
              src={poiFotoUrl(deckblatt.titelFoto.id)}
              alt={`Foto zu ${deckblatt.titel}`}
            />
            {deckblatt.titelFoto.istKiBild && <KiBildMarke />}
          </>
        )}
        <div className={styles.titelBildSchleier} aria-hidden="true" />
      </div>

      <div className={styles.titelMarke}>
        <span className={styles.kompass}>
          <CompassIcon size={18} />
        </span>
        <span>
          <span className={styles.wort}>{APP_NAME}</span>
          <br />
          <span className={styles.unter}>Reiseplan</span>
        </span>
      </div>

      <div className={styles.titelText}>
        {/* Der handschriftliche Satz ueber dem Titel ist der Anlass; er kommt
            aus der Beschreibung der Reise. Hat sie nur einen Satz, steht
            dieser im Dashboard und hier nichts. */}
        {deckblatt.vorspann && (
          <div className={styles.titelVorspann} data-testid="druck-vorspann">
            {deckblatt.vorspann}
          </div>
        )}
        <h1 className={styles.titelHaupt}>{deckblatt.titel}</h1>
        <div className={styles.titelOrt}>{deckblatt.ort}</div>
      </div>

      <div className={styles.dashboard}>
        {deckblatt.beschreibung && (
          <p
            className={styles.dashBeschreibung}
            data-testid="druck-beschreibung"
          >
            {deckblatt.beschreibung}
          </p>
        )}

        <div className={styles.dashZahlen} data-testid="druck-zahlen">
          {deckblatt.zahlen.map((zahl) => (
            <div
              key={zahl.bezeichnung}
              className={`${styles.zahlBlock} ${zahl.warm ? styles.warm : ""}`.trim()}
            >
              <span className={styles.wert}>
                {zahl.wert}
                {zahl.einheit && (
                  <span className={styles.einheit}> {zahl.einheit}</span>
                )}
              </span>
              <span className={styles.bez}>{zahl.bezeichnung}</span>
            </div>
          ))}
        </div>

        <div className={styles.dashZeilen} data-testid="druck-eckdaten">
          {deckblatt.eckdaten.map((zeile) => (
            <div key={zeile.label} className={styles.dashZeile}>
              <span className={styles.zeileLinks}>{zeile.label}</span>
              <span
                className={`${styles.zeileRechts} ${zeile.warm ? styles.warm : ""}`.trim()}
              >
                {zeile.wert}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Der Hinweis, wie aus der Seite ein PDF wird. Er steht nur am Bildschirm:
 * ohne die Einstellung "Hintergrundgrafiken" bleiben die Farbflaechen weiss
 * -- eine Eigenheit des Browsers, kein Fehler der Vorlage.
 */
function DruckHinweis() {
  return (
    <div className={styles.nurBildschirm} data-testid="druck-hinweis">
      <h2>Reiseplan zum Ausdrucken</h2>
      <p>
        Drucken mit <strong>Strg+P</strong> (Mac: <strong>Cmd+P</strong>), dort
        <strong> A4 hoch</strong>, Ränder <strong>„keine“</strong> und{" "}
        <strong>Hintergrundgrafiken</strong> einschalten. „Als PDF speichern“
        ergibt die Datei zum Verschicken.
      </p>
      <p>Dieser Hinweis wird nicht mitgedruckt.</p>
    </div>
  );
}

export function ReiseplanDruck({ reiseplan }: { reiseplan: Reiseplan }) {
  return (
    <div className={styles.heft}>
      <DruckHinweis />
      <Deckblatt deckblatt={reiseplan.deckblatt} />
    </div>
  );
}
