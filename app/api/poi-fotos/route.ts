import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pool";
import {
  addPoiPhoto,
  deletePoiPhoto,
  reorderPoiPhotos,
} from "@/lib/db/poi-photos";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import {
  POI_PHOTO_ERRORS,
  poiPhotoContentType,
  poiPhotoUploadProblem,
  storedPhotoFileName,
} from "@/lib/pois/photo-upload";

/**
 * Die Bilder eines POI hinzufuegen, umsortieren und entfernen (req-035).
 *
 * Datei und Datensatz muessen jederzeit zueinander passen (stack.md):
 * - Beim Hinzufuegen zuerst die Datei, dann der Datensatz. Scheitert der
 *   Datensatz, wird die Datei wieder entfernt.
 * - Beim Entfernen zuerst der Datensatz, dann die Datei. So bleibt nie ein
 *   Datensatz zurueck, der ins Leere zeigt.
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024).
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

function unknownPoi() {
  return Response.json({ error: "unknown poi" }, { status: 404 });
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

  const poiId = textOf(form.get("poiId"));
  const datei = form.get("datei");
  if (poiId.length === 0 || !(datei instanceof File)) return invalidBody();

  // Erlaubt sind Bilder, hoechstens 20 MB (req-035). Dieselbe Pruefung
  // laeuft schon im Browser; diese hier ist der Schutz.
  const problem = poiPhotoUploadProblem(datei);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const contentType = poiPhotoContentType(datei.type, datei.name);
  if (!contentType) {
    return Response.json({ error: POI_PHOTO_ERRORS.type }, { status: 400 });
  }

  const data = new Uint8Array(await datei.arrayBuffer());
  // Die gemeldete Groesse wird nicht geglaubt -- gezaehlt wird, was ankommt.
  const zuGross = poiPhotoUploadProblem({
    name: datei.name,
    type: contentType,
    size: data.byteLength,
  });
  if (zuGross) return Response.json({ error: zuGross }, { status: 400 });

  // Der Ablageort ergibt sich aus einer Zufallskennung und der Art der
  // Datei, nie aus dem hochgeladenen Namen (req-035, Constraints).
  const fileName = storedPhotoFileName(randomUUID(), contentType);

  let store;
  try {
    store = fileSystemPhotoStore();
    await store.save(fileName, data);
  } catch {
    return Response.json({ error: POI_PHOTO_ERRORS.failed }, { status: 500 });
  }

  let photos;
  try {
    photos = await addPoiPhoto(
      getPool(),
      session.accountId,
      poiId,
      fileName,
      new Date(),
    );
  } catch {
    photos = null;
  }

  // Ohne Datensatz bliebe die Datei verwaist zurueck (stack.md).
  if (!photos) {
    await store.remove(fileName).catch(() => {});
    return unknownPoi();
  }

  return Response.json({ photos }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const poiId = textOf(body.poiId);
  const photoIds = Array.isArray(body.photoIds)
    ? body.photoIds.map(textOf).filter((id) => id.length > 0)
    : null;
  if (poiId.length === 0 || !photoIds) return invalidBody();

  const photos = await reorderPoiPhotos(
    getPool(),
    session.accountId,
    poiId,
    photoIds,
  );
  if (!photos) return unknownPoi();

  return Response.json({ photos });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const photoId = textOf(body.photoId);
  if (photoId.length === 0) return invalidBody();

  // Zuerst der Datensatz, dann die Datei.
  const entfernt = await deletePoiPhoto(getPool(), session.accountId, photoId);
  if (!entfernt) {
    return Response.json({ error: "unknown photo" }, { status: 404 });
  }

  try {
    await fileSystemPhotoStore().remove(entfernt.fileName);
  } catch {
    // Die Datei blieb liegen; der Datensatz ist weg. Ein Datensatz, der ins
    // Leere zeigt, entsteht dabei nie.
  }

  return Response.json({ photos: entfernt.photos });
}
