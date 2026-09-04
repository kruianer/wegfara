import type { DocumentDraft, TripDocument } from "./types";
import { DOCUMENT_ERRORS, documentUploadProblem } from "./validate";

const DOCUMENTS_API = "/api/dokumente";

/**
 * Die Adresse, unter der ein Dokument angezeigt wird. Sie fuehrt ueber die
 * Anwendung und nie direkt ins Bildverzeichnis: ausgeliefert wird nur an
 * eine angemeldete Person des Accounts (req-034, Constraints).
 */
export function documentUrl(documentId: string): string {
  return `${DOCUMENTS_API}/${documentId}`;
}

export type UploadResult =
  | { ok: true; document: TripDocument }
  | { ok: false; error: string };

/**
 * Legt eine Datei bei der Reise ab (req-034) -- vom Geraet gewaehlt oder
 * mit der Kamera aufgenommen; fuer die Schnittstelle ist das dasselbe.
 *
 * Was nicht erlaubt ist, wird schon hier abgewiesen, damit der Hinweis
 * sofort erscheint. Dieselbe Pruefung findet noch einmal serverseitig
 * statt -- diese hier ist die Bequemlichkeit, jene der Schutz.
 */
export async function uploadDocument(
  tripId: string,
  file: File,
  link: { poiId?: string | null; transferId?: string | null } = {},
): Promise<UploadResult> {
  const problem = documentUploadProblem(file);
  if (problem) return { ok: false, error: problem };

  const body = new FormData();
  body.append("tripId", tripId);
  body.append("datei", file);
  if (link.poiId) body.append("poiId", link.poiId);
  if (link.transferId) body.append("transferId", link.transferId);

  let response: Response;
  try {
    response = await fetch(DOCUMENTS_API, { method: "POST", body });
  } catch {
    return { ok: false, error: DOCUMENT_ERRORS.failed };
  }

  let payload: { document?: TripDocument; error?: string } | null = null;
  try {
    payload = (await response.json()) as {
      document?: TripDocument;
      error?: string;
    };
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.document) {
    return { ok: false, error: payload?.error ?? DOCUMENT_ERRORS.failed };
  }
  return { ok: true, document: payload.document };
}

/**
 * Aendert Name und Verknuepfung (req-034). Liefert null, wenn es
 * fehlschlaegt -- die Eingabe bleibt dann stehen.
 */
export async function saveDocumentChanges(
  documentId: string,
  draft: DocumentDraft,
): Promise<TripDocument | null> {
  try {
    const response = await fetch(DOCUMENTS_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: documentId, ...draft }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { document?: TripDocument };
    return payload.document ?? null;
  } catch {
    return null;
  }
}

/** Entfernt ein Dokument samt seiner Datei (req-034). */
export async function removeDocument(documentId: string): Promise<boolean> {
  try {
    const response = await fetch(DOCUMENTS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: documentId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
