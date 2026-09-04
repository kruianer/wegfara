"use client";

import { useId, useMemo, useRef, useState } from "react";
import { participantDisplayName } from "@/lib/participants/display-name";
import type { TripDocument } from "@/lib/documents/types";
import { formatDocumentMeta } from "@/lib/documents/format";
import { documentExtensionLabel } from "@/lib/documents/file-name";
import { uploadDocument } from "@/lib/documents/save-document";
import { DokumentAnsicht } from "@/components/dokument-ansicht";
import styles from "./documents-view.module.css";

/**
 * Die Dokumente der geoeffneten Reise im Begleiter (req-034): eine
 * einspaltige Liste, das Fotografieren als Schaltflaeche oben -- unterwegs
 * am Bahnhof ist das Abfotografieren eines Tickets der Normalfall.
 *
 * Ansehen geht wie im Planer ueber die Vollbildansicht; geteilt wird sie
 * ueber components/, nicht durch einen Import aus dem Planer (siehe
 * delivery/stack.md, Conventions).
 */
export function DocumentsView({
  tripId,
  documents,
  participants = [],
  onDocumentSaved,
}: {
  tripId: string;
  documents: TripDocument[];
  /** Die Personen des Accounts -- zum Benennen dessen, der abgelegt hat. */
  participants?: { id: string; name: string; nickname: string | null }[];
  onDocumentSaved: (document: TripDocument) => void;
}) {
  const inputId = useId();
  const [viewing, setViewing] = useState<TripDocument | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const busy = useRef(false);

  const uploaderNames = useMemo(
    () =>
      new Map(
        participants.map((person) => [
          person.id,
          participantDisplayName(person),
        ]),
      ),
    [participants],
  );

  async function ablegen(file: File | undefined) {
    if (!file || busy.current) return;
    busy.current = true;
    setUploading(true);
    setProblem(null);

    const result = await uploadDocument(tripId, file);
    busy.current = false;
    setUploading(false);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    onDocumentSaved(result.document);
  }

  return (
    <section className={styles.view} aria-label="Dokumente">
      <div className={styles.actions}>
        {/* Oben und zuerst: unterwegs wird fotografiert, nicht gesucht. */}
        <label className={styles.primaryButton} htmlFor={`${inputId}-foto`}>
          Fotografieren
        </label>
        <input
          id={`${inputId}-foto`}
          className={styles.hiddenInput}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Fotografieren"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void ablegen(file);
          }}
        />
        <label className={styles.secondaryButton} htmlFor={`${inputId}-datei`}>
          Datei wählen
        </label>
        <input
          id={`${inputId}-datei`}
          className={styles.hiddenInput}
          type="file"
          accept="image/*,application/pdf"
          aria-label="Datei wählen"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void ablegen(file);
          }}
        />
      </div>
      {problem && (
        <p className={styles.error} role="alert" data-testid="dokument-hinweis">
          {problem}
        </p>
      )}
      {documents.length === 0 ? (
        <p className={styles.empty}>Noch keine Dokumente abgelegt</p>
      ) : (
        <ul className={styles.list}>
          {documents.map((document) => (
            <li key={document.id}>
              <button
                type="button"
                className={styles.row}
                aria-label={`Dokument ansehen: ${document.name}`}
                onClick={() => setViewing(document)}
              >
                <span className={styles.fileIcon} aria-hidden="true">
                  {documentExtensionLabel(document.name, document.contentType)}
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.name}>{document.name}</span>
                  <span className={styles.meta}>
                    {formatDocumentMeta(
                      document.sizeBytes,
                      document.createdAt,
                      document.uploadedById
                        ? (uploaderNames.get(document.uploadedById) ?? null)
                        : null,
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {viewing && (
        <DokumentAnsicht document={viewing} onClose={() => setViewing(null)} />
      )}
    </section>
  );
}
