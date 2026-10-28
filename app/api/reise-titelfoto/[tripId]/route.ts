import { getPool } from "@/lib/db/pool";
import { findEigenesTitelfotoFileName } from "@/lib/db/trip-titelfoto";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import { poiPhotoContentTypeOfFileName } from "@/lib/pois/photo-upload";

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
  _request: Request,
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

  let data: Uint8Array | null;
  try {
    data = await fileSystemPhotoStore().read(fileName);
  } catch {
    data = null;
  }
  if (!data) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": poiPhotoContentTypeOfFileName(fileName),
      "Content-Length": String(data.byteLength),
      // Die Adresse traegt den Zeitpunkt des Ablegens (?stand=) -- ein
      // ersetztes Bild hat eine neue und kommt nicht aus dem Speicher.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
