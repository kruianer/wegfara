import { getPool } from "@/lib/db/pool";
import { findPhotoFileName } from "@/lib/db/poi-photos";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import {
  dateiAntwort,
  liesFoto,
  type AuszuliefernesBild,
} from "@/lib/images/bild-auslieferung";
import { willMiniatur } from "@/lib/pois/foto-url";

/**
 * Liefert ein gespeichertes POI-Foto aus (req-026). Die Dateien liegen
 * ausserhalb des Repos im Bildverzeichnis und damit nicht im oeffentlich
 * ausgelieferten Teil der Anwendung — sie gehen nur ueber diese
 * Schnittstelle heraus, und nur an eine angemeldete Person des Accounts,
 * zu dem der POI gehoert (req-024).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const fileName = await findPhotoFileName(getPool(), session.accountId, id);
  // Ein Foto eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!fileName) return new Response(null, { status: 404 });

  // Listen und Kacheln fragen nach der Miniatur (req-105); fehlt sie, kommt
  // das Original.
  let bild: AuszuliefernesBild | null;
  try {
    bild = await liesFoto(
      fileSystemPhotoStore(),
      fileName,
      willMiniatur(request),
    );
  } catch {
    bild = null;
  }
  // Ein Datensatz ohne Datei ist ein Fehlerzustand (siehe stack.md) und
  // wird hier sichtbar, statt still ein leeres Bild zu liefern.
  if (!bild) return new Response(null, { status: 404 });

  return dateiAntwort(request, bild.data, {
    // Die Art kommt seit req-105 aus dem Inhalt: eine Datei von Google
    // heisst immer ….jpg, auch wenn sie ein PNG ist.
    "Content-Type": bild.contentType,
    "Cache-Control": "private, max-age=86400",
  });
}
