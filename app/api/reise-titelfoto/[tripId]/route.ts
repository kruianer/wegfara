import { getPool } from "@/lib/db/pool";
import { findEigenesTitelfotoFileName } from "@/lib/db/trip-titelfoto";
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
 * Liefert das eigene Titelfoto einer Reise aus (req-103) -- hochgeladen oder
 * erzeugt. Wie die Fotos der POIs (req-026) liegt die Datei ausserhalb des
 * Repos und geht nur an eine angemeldete Person des Accounts heraus, zu dem
 * die Reise gehoert (req-024).
 *
 * Ein gewaehltes Foto eines POI geht nicht hier, sondern ueber
 * /api/poi-fotos heraus.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const { tripId } = await params;
  const fileName = await findEigenesTitelfotoFileName(
    getPool(),
    session.accountId,
    tripId,
  );
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
  if (!bild) return new Response(null, { status: 404 });

  return dateiAntwort(request, bild.data, {
    "Content-Type": bild.contentType,
    // Die Adresse traegt den Zeitpunkt des Ablegens (?stand=) -- ein
    // ersetztes Bild hat eine neue und kommt nicht aus dem Speicher.
    "Cache-Control": "private, max-age=86400",
  });
}
