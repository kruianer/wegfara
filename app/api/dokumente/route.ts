import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import {
  createDocument,
  deleteDocument,
  updateDocument,
  type DocumentFailure,
} from "@/lib/db/documents";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemDocumentStore } from "@/lib/images/document-store";
import { storedFileName } from "@/lib/documents/file-name";
import { pdfPageCount } from "@/lib/documents/pdf-pages";
import {
  DOCUMENT_ERRORS,
  documentContentType,
  documentName,
  documentNameProblem,
  documentUploadProblem,
  isAllowedDocumentType,
} from "@/lib/documents/validate";

/**
 * Dokumente einer Reise ablegen, aendern und entfernen (req-034). Ablegen
 * und Entfernen sind Vorgaenge, bei denen der Nutzer eine Bestaetigung
 * erwartet -- sie werden sofort geschrieben, nicht verzoegert (siehe
 * delivery/stack.md, Conventions).
 *
 * Datei und Datensatz muessen jederzeit zueinander passen (req-034):
 * - Beim Ablegen zuerst die Datei, dann der Datensatz. Scheitert der
 *   Datensatz, wird die Datei wieder entfernt.
 * - Beim Entfernen zuerst der Datensatz, dann die Datei. Scheitert die
 *   Datei, bleibt kein Datensatz zurueck, der ins Leere zeigt -- die
 *   verwaiste Datei raeumt die taegliche Pruefung.
 *
 * Reisen anderer Mandanten existieren fuer diese Sitzung nicht: der Account
 * kommt aus der Anmeldung, nie aus der Anfrage (req-024).
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalId(value: unknown): string | null {
  const text = textOf(value);
  return text.length > 0 ? text : null;
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

/** 404 fuer Unbekanntes, 409 fuer eine Verknuepfung ausserhalb der Reise. */
function failure(reason: DocumentFailure) {
  return reason === "notInTrip"
    ? Response.json({ error: "notInTrip" }, { status: 409 })
    : Response.json({ error: "unknown" }, { status: 404 });
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return invalidBody();
  }

  const tripId = textOf(form.get("tripId"));
  const datei = form.get("datei");
  if (tripId.length === 0 || !(datei instanceof File)) return invalidBody();

  // Erlaubt sind Bilder und PDF-Dateien, hoechstens 20 MB (req-034). Der
  // Hinweis nennt den Grund; dieselbe Pruefung laeuft schon im Browser.
  const problem = documentUploadProblem(datei);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const contentType = documentContentType(datei.type, datei.name);
  if (!isAllowedDocumentType(contentType)) {
    return Response.json({ error: DOCUMENT_ERRORS.type }, { status: 400 });
  }

  const data = new Uint8Array(await datei.arrayBuffer());
  // Die gemeldete Groesse wird nicht geglaubt -- gezaehlt wird, was ankommt.
  if (data.byteLength === 0) {
    return Response.json({ error: DOCUMENT_ERRORS.empty }, { status: 400 });
  }
  const zuGross = documentUploadProblem({
    name: datei.name,
    type: contentType,
    size: data.byteLength,
  });
  if (zuGross) return Response.json({ error: zuGross }, { status: 400 });

  // Der Ablageort ergibt sich aus einer Zufallskennung und der Art der
  // Datei, nie aus dem hochgeladenen Namen (req-034, Constraints).
  const fileName = storedFileName(randomUUID(), contentType);
  const store = fileSystemDocumentStore();

  // Zuerst die Datei, dann der Datensatz.
  try {
    await store.save(fileName, data);
  } catch {
    return Response.json({ error: DOCUMENT_ERRORS.failed }, { status: 500 });
  }

  let result;
  try {
    result = await createDocument(
      getPool(),
      session.accountId,
      tripId,
      {
        name: documentName(textOf(form.get("name")) || datei.name),
        fileName,
        contentType,
        sizeBytes: data.byteLength,
        pageCount:
          contentType === "application/pdf" ? pdfPageCount(data) : null,
        poiId: optionalId(form.get("poiId")),
        transferId: optionalId(form.get("transferId")),
        uploadedById: session.participant.id,
      },
      new Date(),
    );
  } catch {
    result = { ok: false, reason: "unknown" } as const;
  }

  // Scheitert der Datensatz, wird die Datei wieder entfernt -- sonst bliebe
  // sie verwaist zurueck (req-034).
  if (!result.ok) {
    await store.remove(fileName).catch(() => {});
    return failure(result.reason);
  }

  return Response.json({ document: result.document }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id);
  const name = textOf(body.name);
  if (id.length === 0) return invalidBody();

  const problem = documentNameProblem(name);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const result = await updateDocument(getPool(), session.accountId, id, {
    name: documentName(name),
    poiId: optionalId(body.poiId),
    transferId: optionalId(body.transferId),
  });
  if (!result.ok) return failure(result.reason);

  return Response.json({ document: result.document });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id);
  if (id.length === 0) return invalidBody();

  // Zuerst der Datensatz, dann die Datei (req-034).
  const entfernt = await deleteDocument(getPool(), session.accountId, id);
  if (!entfernt) return failure("unknown");

  try {
    await fileSystemDocumentStore().remove(entfernt.fileName);
  } catch {
    // Die Datei blieb liegen; der Datensatz ist weg. Die taegliche Pruefung
    // raeumt sie -- ein Datensatz, der ins Leere zeigt, entsteht dabei nie.
  }

  return Response.json({ status: "ok" });
}
