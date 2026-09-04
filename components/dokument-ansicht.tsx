"use client";

import { useState } from "react";
import type { TripDocument } from "@/lib/documents/types";
import { documentUrl } from "@/lib/documents/save-document";
import { isPdf } from "@/lib/documents/file-name";
import styles from "./dokument-ansicht.module.css";

/**
 * Die Vollbildansicht eines Dokuments (req-034): formatfuellend ueber der
 * Seite, mit abgedunkeltem Hintergrund. Ein Klick daneben oder auf
 * "Schliessen" beendet sie. Sie folgt dem Beleg-Overlay der Vorlage
 * (`delivery/design/design 1.0/Reise Companion.dc.html`, Abschnitt
 * "3. Kosten").
 *
 * Sie wird vom Planer und vom Begleiter benutzt und liegt deshalb hier und
 * nicht in einem der beiden Bereiche (siehe delivery/stack.md,
 * Conventions). Ihre Farben stehen bewusst fuer sich: ueber der
 * abgedunkelten Seite gilt weder die Palette des Planers noch die des
 * Begleiters.
 *
 * Bei mehrseitigen PDF-Dateien laesst sich blaettern -- die Seitenzahl
 * steht beim Datensatz, die Anzeige uebernimmt der Betrachter des Browsers.
 */
export function DokumentAnsicht({
  document,
  onClose,
}: {
  document: TripDocument;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const pages = document.pageCount ?? 1;
  const mehrseitig = isPdf(document.contentType) && pages > 1;

  return (
    <div
      className={styles.overlay}
      // Ein Klick daneben beendet die Ansicht (req-034). Klicks im Inneren
      // erreichen diese Flaeche nicht.
      onClick={onClose}
      data-testid="dokument-ansicht-hintergrund"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={document.name}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.bar}>
          <span className={styles.name}>{document.name}</span>
          {mehrseitig && (
            <span className={styles.pager}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Zurück
              </button>
              <span className={styles.pageLabel}>
                Seite {page} von {pages}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() =>
                  setPage((current) => Math.min(pages, current + 1))
                }
                disabled={page >= pages}
              >
                Weiter
              </button>
            </span>
          )}
          <button type="button" className={styles.close} onClick={onClose}>
            Schließen
          </button>
        </div>
        {isPdf(document.contentType) ? (
          <iframe
            key={page}
            className={styles.frame}
            title={document.name}
            src={`${documentUrl(document.id)}#page=${page}`}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element --
             Die Datei kommt aus der eigenen Schnittstelle und wird
             unveraendert gezeigt; die Bildoptimierung von Next.js braucht
             es dafuer nicht. */
          <img
            className={styles.image}
            src={documentUrl(document.id)}
            alt={document.name}
          />
        )}
      </div>
    </div>
  );
}
