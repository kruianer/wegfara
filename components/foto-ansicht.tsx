"use client";

import { useEffect, useState } from "react";
import styles from "./foto-ansicht.module.css";

/**
 * Die Grossansicht eines Fotos (bug-038): formatfuellend ueber der Seite, mit
 * abgedunkeltem Hintergrund. Heraus kommt man auf drei Wegen -- mit einem
 * Klick daneben, mit "Schliessen" und mit der Escape-Taste.
 *
 * Gehoeren zum Ort mehrere Fotos, laesst sich zwischen ihnen blaettern; bei
 * einem einzigen bleibt die Leiste leer bis auf "Schliessen".
 *
 * Sie folgt der Vollbildansicht eines Dokuments (`dokument-ansicht.tsx`,
 * req-034) und liegt aus demselben Grund hier und nicht im Planer: ein Foto
 * gross zu sehen ist nichts, was allein dorthin gehoert. Ihre Farben stehen
 * bewusst fuer sich -- ueber der abgedunkelten Seite gilt weder die Palette
 * des Planers noch die des Begleiters.
 */
export function FotoAnsicht({
  fotos,
  titel,
  onClose,
}: {
  /** Die Adressen der Fotos in ihrer Reihenfolge -- mindestens eine. */
  fotos: string[];
  /** Wozu die Fotos gehoeren; steht in der Leiste und im Alternativtext. */
  titel: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  // Kommt die Ansicht mit weniger Fotos zurueck als beim Blaettern erreicht
  // waren, bleibt der Zeiger trotzdem im Bestand.
  const aktuell = Math.min(index, fotos.length - 1);
  const mehrere = fotos.length > 1;

  useEffect(() => {
    // Die Escape-Taste schliesst (bug-038) -- wie beim Reisewechsler des
    // Planers (header.tsx) haengt sie am Dokument, nicht an der Flaeche:
    // sonst griffe sie erst, wenn etwas darin den Fokus hat.
    function schliesseBeiEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", schliesseBeiEscape);
    return () => document.removeEventListener("keydown", schliesseBeiEscape);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      // Ein Klick daneben beendet die Ansicht. Klicks im Inneren erreichen
      // diese Flaeche nicht.
      onClick={onClose}
      data-testid="foto-ansicht-hintergrund"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Fotos von ${titel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.bar}>
          <span className={styles.titel}>{titel}</span>
          {mehrere && (
            <span className={styles.pager}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setIndex(Math.max(0, aktuell - 1))}
                disabled={aktuell <= 0}
              >
                Zurück
              </button>
              <span className={styles.pageLabel}>
                Bild {aktuell + 1} von {fotos.length}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() =>
                  setIndex(Math.min(fotos.length - 1, aktuell + 1))
                }
                disabled={aktuell >= fotos.length - 1}
              >
                Weiter
              </button>
            </span>
          )}
          <button type="button" className={styles.close} onClick={onClose}>
            Schließen
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element --
            Die Datei kommt aus der eigenen Schnittstelle und wird
            unveraendert gezeigt; die Bildoptimierung von Next.js braucht es
            dafuer nicht. */}
        <img
          className={styles.image}
          src={fotos[aktuell]}
          alt={`Bild ${aktuell + 1} von ${titel}`}
        />
      </div>
    </div>
  );
}
