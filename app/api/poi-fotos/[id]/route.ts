import { getPool } from "@/lib/db/pool";
import { findPhotoFileName } from "@/lib/db/poi-photos";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";

/**
 * Liefert ein gespeichertes POI-Foto aus (req-026). Die Dateien liegen
 * ausserhalb des Repos im Bildverzeichnis und damit nicht im oeffentlich
 * ausgelieferten Teil der Anwendung — sie gehen nur ueber diese
 * Schnittstelle heraus, und nur an eine angemeldete Person des Accounts,
 * zu dem der POI gehoert (req-024).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const fileName = await findPhotoFileName(getPool(), session.accountId, id);
  // Ein Foto eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!fileName) return new Response(null, { status: 404 });

  let data: Uint8Array | null;
  try {
    data = await fileSystemPhotoStore().read(fileName);
  } catch {
    data = null;
  }
  // Ein Datensatz ohne Datei ist ein Fehlerzustand (siehe stack.md) und
  // wird hier sichtbar, statt still ein leeres Bild zu liefern.
  if (!data) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(data.byteLength),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
