"use client";

import { useRef, useState } from "react";
import type { Poi } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import {
  eigenesTitelfotoUrl,
  TITELFOTO_VORGABE_HINWEIS,
  type TripTitelfoto,
} from "@/lib/trips/titelfoto";
import { titelfotoKandidaten } from "@/lib/druck/titelfoto";
import {
  erzeugeTitelfoto,
  ladeTitelfotoHoch,
  waehleTitelfoto,
  type TitelfotoErgebnis,
} from "@/lib/trips/save-titelfoto";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import { ALLOWED_POI_PHOTO_TYPES } from "@/lib/pois/photo-upload";
import { KiBildMarke } from "@/components/ki-bild-marke";
import cards from "@/components/cards.module.css";
import styles from "./titelfoto-card.module.css";

/**
 * Das Feld "Titelfoto" in den Reisedetails (req-103): welches Bild auf dem
 * Deckblatt des gedruckten Plans steht.
 *
 * Es steht hier und nicht im Druck: das Titelfoto ist eine Angabe ueber die
 * Reise wie Titel und Zeitraum. Drei Quellen -- die Fotos der POIs im Gitter,
 * ein hochgeladenes Bild und eines von der KI (req-072). Gewaehlt werden muss
 * nichts: ohne Wahl gilt die Vorgabe (req-080).
 *
 * Gespeichert wird sofort beim Antippen; schlaegt es fehl, bleibt die
 * bisherige Wahl stehen und der Grund steht da (bug-021).
 */
export function TitelfotoCard({
  trip,
  pois,
  titelfoto,
  hasAiKey,
  onChange,
}: {
  trip: Trip;
  /** Die POIs dieser Reise -- ihre Fotos stehen zur Wahl. */
  pois: Poi[];
  titelfoto: TripTitelfoto | null;
  /** Ob ein Zugangsschluessel fuer die KI hinterlegt ist (req-028). */
  hasAiKey: boolean;
  onChange: (titelfoto: TripTitelfoto | null) => void;
}) {
  const [busy, setBusy] = useState<"wahl" | "hochladen" | "ki" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);
  const kandidaten = titelfotoKandidaten(pois);
  const gewaehltePhotoId = titelfoto?.art === "poi" ? titelfoto.photoId : null;

  async function fuehreAus(
    art: "wahl" | "hochladen" | "ki",
    schritt: () => Promise<TitelfotoErgebnis>,
  ) {
    if (busy) return;
    setBusy(art);
    setProblem(null);
    const ergebnis = await schritt();
    setBusy(null);
    if (!ergebnis.ok) {
      setProblem(ergebnis.error);
      return;
    }
    onChange(ergebnis.titelfoto);
  }

  function waehle(photoId: string) {
    // Ein zweites Antippen des gewaehlten Fotos nimmt die Wahl zurueck.
    const neu = photoId === gewaehltePhotoId ? null : photoId;
    void fuehreAus("wahl", () => waehleTitelfoto(trip.id, neu));
  }

  function erzeuge() {
    if (!hasAiKey) {
      setProblem(apiKeyMissingHint("ki_suche"));
      return;
    }
    void fuehreAus("ki", () => erzeugeTitelfoto(trip.id));
  }

  return (
    <section className={cards.card} aria-label="Titelfoto">
      <div className={styles.kopf}>
        <h2 className={cards.cardTitle}>Titelfoto</h2>
        <span className={styles.wofuer}>für den gedruckten Plan</span>
      </div>

      {titelfoto?.art === "eigen" && (
        <div className={styles.eigenes} data-testid="titelfoto-eigenes">
          <div className={`${styles.wahl} ${styles.an}`}>
            {/* eslint-disable-next-line @next/next/no-img-element --
                Die Datei kommt aus der eigenen Schnittstelle (siehe
                lib/trips/titelfoto.ts). */}
            <img
              className={styles.foto}
              src={eigenesTitelfotoUrl(titelfoto.tripId, titelfoto.stand)}
              alt="Eigenes Titelfoto"
            />
            {titelfoto.istKiBild && <KiBildMarke />}
          </div>
          <span className={styles.herkunft}>
            {titelfoto.istKiBild ? "Von der KI erzeugt" : "Hochgeladen"}
          </span>
        </div>
      )}

      {kandidaten.length > 0 ? (
        <ul className={styles.gitter} data-testid="titelfoto-gitter">
          {kandidaten.map((kandidat) => {
            const an = kandidat.photoId === gewaehltePhotoId;
            return (
              <li key={kandidat.photoId}>
                <button
                  type="button"
                  className={`${styles.wahl} ${an ? styles.an : ""}`.trim()}
                  aria-pressed={an}
                  aria-label={`Titelfoto: ${kandidat.herkunft}`}
                  data-testid={`titelfoto-wahl-${kandidat.photoId}`}
                  disabled={busy !== null}
                  onClick={() => waehle(kandidat.photoId)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      siehe oben */}
                  <img
                    className={styles.foto}
                    src={poiFotoUrl(kandidat.photoId)}
                    alt=""
                  />
                  {an && (
                    <span className={styles.haken} aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {/* Ein KI-Bild traegt sein Zeichen auch hier (req-072). */}
                  {kandidat.istKiBild && <KiBildMarke />}
                </button>
                <span className={styles.herkunft}>{kandidat.herkunft}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={cards.hint}>
          Die POIs dieser Reise haben noch keine Fotos.
        </p>
      )}

      <div className={styles.wege}>
        <button
          type="button"
          className={styles.weg}
          disabled={busy !== null}
          onClick={() => dateiFeld.current?.click()}
        >
          {busy === "hochladen"
            ? "Wird hochgeladen …"
            : "Eigenes Bild hochladen"}
        </button>
        <input
          ref={dateiFeld}
          type="file"
          hidden
          accept={ALLOWED_POI_PHOTO_TYPES.join(",")}
          data-testid="titelfoto-datei"
          onChange={(event) => {
            const datei = event.target.files?.[0];
            event.target.value = "";
            if (datei) {
              void fuehreAus("hochladen", () =>
                ladeTitelfotoHoch(trip.id, datei),
              );
            }
          }}
        />
        <button
          type="button"
          className={`${styles.weg} ${styles.ki}`}
          disabled={busy !== null}
          onClick={erzeuge}
        >
          {busy === "ki"
            ? "Wird erzeugt …"
            : "Titelbild von der KI erzeugen lassen"}
        </button>
        {titelfoto && (
          <button
            type="button"
            className={styles.weg}
            disabled={busy !== null}
            onClick={() =>
              void fuehreAus("wahl", () => waehleTitelfoto(trip.id, null))
            }
          >
            Wahl zurücknehmen
          </button>
        )}
      </div>

      {problem && (
        <p className={cards.error} role="alert">
          {problem}
        </p>
      )}
      <p className={`${cards.hint} ${styles.vorgabe}`}>
        {TITELFOTO_VORGABE_HINWEIS}
      </p>
    </section>
  );
}
