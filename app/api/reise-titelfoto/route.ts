import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import {
  entferneTitelfoto,
  setzeEigenesTitelfoto,
  waehlePoiTitelfoto,
} from "@/lib/db/trip-titelfoto";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import {
  POI_PHOTO_ERRORS,
  poiPhotoContentType,
  poiPhotoUploadProblem,
  storedPhotoFileName,
} from "@/lib/pois/photo-upload";
import { TITELFOTO_FEHLGESCHLAGEN } from "@/lib/trips/titelfoto";

/**
 * Das Titelfoto einer Reise waehlen, hochladen und zuruecknehmen (req-103).
 *
 * - PUT `{ tripId, photoId }` waehlt ein Foto eines POI dieser Reise;
 *   `photoId: null` nimmt die Wahl zurueck -- dann gilt wieder die Vorgabe.
 * - POST (multipart: `tripId`, `datei`) legt ein eigenes Bild ab, das zu
 *   keinem POI gehoert.
 *
 * Datei und Datensatz passen jederzeit zueinander (stack.md): beim Ablegen
 * erst die Datei, dann der Datensatz; ein abgeloestes eigenes Bild wird erst
 * aus der Ablage geraeumt, wenn sein Datensatz weg ist. Der Mandant kommt aus
 * der Anmeldung, nie aus der Anfrage (req-024).
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

/** Raeumt die Datei eines abgeloesten eigenen Bildes aus der Ablage. */
async function raeumeDatei(fileName: string | null): Promise<void> {
  if (!fileName) return;
  try {
    await fileSystemPhotoStore().remove(fileName);
  } catch {
    // Die Datei blieb liegen; ein Datensatz, der ins Leere zeigt, entsteht
    // dabei nie.
  }
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") return invalidBody();

  const tripId = textOf(body.tripId);
  if (tripId.length === 0) return invalidBody();

  const db = getPool();

  if (body.photoId === null) {
    const entfernt = await entferneTitelfoto(db, session.accountId, tripId);
    if (!entfernt) {
      return Response.json({ error: "unknown trip" }, { status: 404 });
    }
    await raeumeDatei(entfernt.removedFileName);
    return Response.json({ titelfoto: null });
  }

  const photoId = textOf(body.photoId);
  if (photoId.length === 0) return invalidBody();

  const gewaehlt = await waehlePoiTitelfoto(
    db,
    session.accountId,
    tripId,
    photoId,
    new Date(),
  );
  // Ein Foto einer anderen Reise oder eines anderen Accounts gibt es hier
  // nicht.
  if (!gewaehlt) {
    return Response.json({ error: "unknown photo" }, { status: 404 });
  }
  await raeumeDatei(gewaehlt.removedFileName);
  return Response.json({ titelfoto: gewaehlt.titelfoto });
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

  // Dieselben Regeln wie fuer die Bilder eines POI (req-035): nur Bilder,
  // hoechstens 20 MB.
  const problem = poiPhotoUploadProblem(datei);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const contentType = poiPhotoContentType(datei.type, datei.name);
  if (!contentType) {
    return Response.json({ error: POI_PHOTO_ERRORS.type }, { status: 400 });
  }

  const data = new Uint8Array(await datei.arrayBuffer());
  const zuGross = poiPhotoUploadProblem({
    name: datei.name,
    type: contentType,
    size: data.byteLength,
  });
  if (zuGross) return Response.json({ error: zuGross }, { status: 400 });

  // Der Ablageort ergibt sich aus einer Zufallskennung, nie aus dem
  // hochgeladenen Namen (req-035).
  const fileName = storedPhotoFileName(randomUUID(), contentType);

  let store;
  try {
    store = fileSystemPhotoStore();
    await store.save(fileName, data);
  } catch {
    return Response.json({ error: TITELFOTO_FEHLGESCHLAGEN }, { status: 500 });
  }

  let gesetzt;
  try {
    gesetzt = await setzeEigenesTitelfoto(
      getPool(),
      session.accountId,
      tripId,
      fileName,
      "manuell",
      new Date(),
    );
  } catch {
    gesetzt = null;
  }

  // Ohne Datensatz bliebe die Datei verwaist zurueck (stack.md).
  if (!gesetzt) {
    await store.remove(fileName).catch(() => {});
    return Response.json({ error: "unknown trip" }, { status: 404 });
  }

  await raeumeDatei(gesetzt.removedFileName);
  return Response.json({ titelfoto: gesetzt.titelfoto }, { status: 201 });
}
