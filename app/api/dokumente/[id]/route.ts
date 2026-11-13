import { getPool } from "@/lib/db/pool";
import { findDocumentFile } from "@/lib/db/documents";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemDocumentStore } from "@/lib/images/document-store";
import { dateiAntwort } from "@/lib/images/bild-auslieferung";

/**
 * Liefert ein abgelegtes Dokument aus (req-034). Die Dateien liegen
 * ausserhalb des Repos im Bildverzeichnis und damit nicht im oeffentlich
 * ausgelieferten Teil der Anwendung -- sie gehen nur ueber diese
 * Schnittstelle heraus, und nur an eine angemeldete Person des Accounts,
 * zu dessen Reise das Dokument gehoert (req-024, siehe
 * delivery/security.md). Eine erratbare Adresse gibt es nicht.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const document = await findDocumentFile(getPool(), session.accountId, id);
  // Ein Dokument eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!document) return new Response(null, { status: 404 });

  let data: Uint8Array | null;
  try {
    data = await fileSystemDocumentStore().read(document.fileName);
  } catch {
    data = null;
  }
  // Ein Datensatz ohne Datei ist ein Fehlerzustand (siehe stack.md) und
  // wird hier sichtbar, statt still eine leere Datei zu liefern. Die
  // taegliche Pruefung meldet ihn (req-034).
  if (!data) return new Response(null, { status: 404 });

  // Mit ETag (req-105): nach Ablauf des Tages bestaetigt der Server die
  // Datei mit 304, statt sie noch einmal zu schicken.
  return dateiAntwort(request, data, {
    "Content-Type": document.contentType,
    // Im Browser anzeigen, nicht herunterladen -- die Vollbildansicht
    // zeigt die Datei ueber der Seite.
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=86400",
  });
}
