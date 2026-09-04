"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Transfer } from "@/lib/transfers/types";
import { participantDisplayName } from "@/lib/participants/display-name";
import type { TripDocument } from "@/lib/documents/types";
import {
  DEFAULT_DOCUMENT_FILTER,
  DOCUMENT_FILTERS,
  filterDocuments,
  type DocumentFilterId,
} from "@/lib/documents/filter";
import { documentLinkLabel, linkNames } from "@/lib/documents/link";
import { formatDocumentMeta } from "@/lib/documents/format";
import { documentExtensionLabel } from "@/lib/documents/file-name";
import {
  saveDocumentChanges,
  uploadDocument,
} from "@/lib/documents/save-document";
import {
  DOCUMENT_NAME_MAX_LENGTH,
  documentNameProblem,
} from "@/lib/documents/validate";
import { DokumentAnsicht } from "@/components/dokument-ansicht";
import { DokumentDeleteDialog } from "./dokument-delete-dialog";
import { PencilIcon, TrashIcon } from "./icons";
import styles from "./dokumente-view.module.css";

/** Womit ein Dokument verknüpft ist -- als Wert des Auswahlfelds. */
function linkValue(document: Pick<TripDocument, "poiId" | "transferId">) {
  if (document.poiId) return `poi:${document.poiId}`;
  if (document.transferId) return `transfer:${document.transferId}`;
  return "";
}

function linkFromValue(value: string): {
  poiId: string | null;
  transferId: string | null;
} {
  if (value.startsWith("poi:")) {
    return { poiId: value.slice(4), transferId: null };
  }
  if (value.startsWith("transfer:")) {
    return { poiId: null, transferId: value.slice(9) };
  }
  return { poiId: null, transferId: null };
}

/**
 * Das Formular zum Aendern eines Dokuments (req-034): Name und
 * Verknuepfung. Die Datei selbst wird nie ersetzt -- dafuer wird ein neues
 * Dokument abgelegt und das alte entfernt.
 */
function DokumentForm({
  document,
  pois,
  transfers,
  onSaved,
  onCancel,
}: {
  document: TripDocument;
  pois: Poi[];
  transfers: Transfer[];
  onSaved: (document: TripDocument) => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [name, setName] = useState(document.name);
  const [link, setLink] = useState(linkValue(document));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function submit() {
    if (saving) return;
    const found = documentNameProblem(name);
    setProblem(found);
    if (found) return;

    setSaving(true);
    const saved = await saveDocumentChanges(document.id, {
      name: name.trim(),
      ...linkFromValue(link),
    });
    setSaving(false);
    if (!saved) {
      setProblem("Das Dokument konnte nicht gespeichert werden.");
      return;
    }
    onSaved(saved);
  }

  return (
    <form
      className={styles.form}
      aria-label={`Dokument ändern: ${document.name}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${fieldId}-name`}>
          Name
        </label>
        <input
          id={`${fieldId}-name`}
          className={styles.input}
          type="text"
          autoComplete="off"
          maxLength={DOCUMENT_NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${fieldId}-link`}>
          Verknüpfung
        </label>
        <select
          id={`${fieldId}-link`}
          className={styles.input}
          value={link}
          onChange={(event) => setLink(event.target.value)}
        >
          <option value="">Keine Verknüpfung</option>
          {pois.length > 0 && (
            <optgroup label="POIs">
              {pois.map((poi) => (
                <option key={poi.id} value={`poi:${poi.id}`}>
                  {poi.name}
                </option>
              ))}
            </optgroup>
          )}
          {transfers.length > 0 && (
            <optgroup label="Transfers">
              {transfers.map((transfer) => (
                <option key={transfer.id} value={`transfer:${transfer.id}`}>
                  {transfer.title}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      {problem && (
        <p className={styles.error} role="alert">
          {problem}
        </p>
      )}
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={saving}
        >
          {saving ? "Speichert…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}

/**
 * Der Bereich "Dokumente" des Planers (req-034). Er zeigt die Dokumente der
 * geoeffneten Reise als Kachelraster nach der Vorlage
 * (`delivery/design/planer/README (1).md`, Abschnitt "5. Dokumente"):
 * Dateisymbol mit Endung, Name, "Größe · Datum · Uploader" und die
 * Verknuepfungs-Kennzeichnung, darueber die Filterleiste.
 *
 * Abgelegt wird auf zwei Wegen -- eine Datei vom Geraet oder ein Foto mit
 * der Kamera. Beides gibt es auch im Begleiter (siehe
 * app/go/components/documents-view.tsx); geteilt wird die Logik ueber
 * lib/documents, nicht ueber den jeweils anderen Bereich.
 */
export function DokumenteView({
  trip,
  documents,
  pois = [],
  transfers = [],
  participants = [],
  onDocumentSaved,
  onDocumentRemoved,
}: {
  trip: Trip;
  /** Die Dokumente der geoeffneten Reise, das neueste zuerst. */
  documents: TripDocument[];
  pois?: Poi[];
  transfers?: Transfer[];
  /** Die Personen des Accounts -- zum Benennen dessen, der abgelegt hat. */
  participants?: { id: string; name: string; nickname: string | null }[];
  onDocumentSaved: (document: TripDocument) => void;
  onDocumentRemoved: (document: TripDocument) => void;
}) {
  const inputId = useId();
  const [filter, setFilter] = useState<DocumentFilterId>(
    DEFAULT_DOCUMENT_FILTER,
  );
  const [viewing, setViewing] = useState<TripDocument | null>(null);
  const [editing, setEditing] = useState<TripDocument | null>(null);
  const [removing, setRemoving] = useState<TripDocument | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const busy = useRef(false);

  const names = useMemo(() => linkNames(pois, transfers), [pois, transfers]);
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

  const sichtbar = filterDocuments(documents, filter);

  async function ablegen(file: File | undefined) {
    if (!file || busy.current) return;
    busy.current = true;
    setUploading(true);
    setProblem(null);

    const result = await uploadDocument(trip.id, file);
    busy.current = false;
    setUploading(false);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    onDocumentSaved(result.document);
  }

  return (
    <section className={styles.area} aria-label="Dokumente">
      <div className={styles.head}>
        <h2 className={styles.title}>Dokumente</h2>
        <div className={styles.headActions}>
          {/* Zwei Wege, dieselbe Ablage: eine Datei vom Gerät oder ein Foto
              mit der Kamera (req-034). */}
          <label className={styles.primaryButton} htmlFor={`${inputId}-datei`}>
            Dokument hochladen
          </label>
          <input
            id={`${inputId}-datei`}
            className={styles.hiddenInput}
            type="file"
            accept="image/*,application/pdf"
            aria-label="Dokument hochladen"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void ablegen(file);
            }}
          />
          <label className={styles.secondaryButton} htmlFor={`${inputId}-foto`}>
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
        </div>
      </div>
      {problem && (
        <p className={styles.error} role="alert" data-testid="dokument-hinweis">
          {problem}
        </p>
      )}
      <div className={styles.filters} role="group" aria-label="Filter">
        {DOCUMENT_FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`${styles.chip} ${
              entry.id === filter ? styles.chipActive : ""
            }`}
            aria-pressed={entry.id === filter}
            onClick={() => setFilter(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {documents.length === 0 ? (
        <p className={styles.empty}>Noch keine Dokumente abgelegt</p>
      ) : sichtbar.length === 0 ? (
        <p className={styles.empty}>Zu diesem Filter gibt es kein Dokument.</p>
      ) : (
        <ul className={styles.grid}>
          {sichtbar.map((document) => {
            const link = documentLinkLabel(document, names);
            return (
              <li key={document.id} className={styles.card}>
                {editing?.id === document.id ? (
                  <DokumentForm
                    document={document}
                    pois={pois}
                    transfers={transfers}
                    onSaved={(saved) => {
                      onDocumentSaved(saved);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.open}
                      aria-label={`Dokument ansehen: ${document.name}`}
                      onClick={() => setViewing(document)}
                    >
                      <span className={styles.fileIcon} aria-hidden="true">
                        {documentExtensionLabel(
                          document.name,
                          document.contentType,
                        )}
                      </span>
                      <span className={styles.cardBody}>
                        <span className={styles.name}>{document.name}</span>
                        <span className={styles.meta}>
                          {formatDocumentMeta(
                            document.sizeBytes,
                            document.createdAt,
                            document.uploadedById
                              ? (uploaderNames.get(document.uploadedById) ??
                                  null)
                              : null,
                          )}
                        </span>
                      </span>
                    </button>
                    <div className={styles.cardFoot}>
                      <span
                        className={`${styles.linkChip} ${styles[link.kind]}`}
                      >
                        {link.text}
                      </span>
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={`Dokument ändern: ${document.name}`}
                          onClick={() => setEditing(document)}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.danger}`}
                          aria-label={`Dokument entfernen: ${document.name}`}
                          onClick={() => setRemoving(document)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {viewing && (
        <DokumentAnsicht document={viewing} onClose={() => setViewing(null)} />
      )}
      {removing && (
        <DokumentDeleteDialog
          document={removing}
          onDeleted={(deleted) => {
            onDocumentRemoved(deleted);
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
