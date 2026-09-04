import { getPool } from "@/lib/db/pool";
import { createPoi, deletePoi, updatePoi } from "@/lib/db/pois";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import { isPoiType } from "@/lib/pois/type-meta";
import { isPoiStatus } from "@/lib/pois/status-meta";
import {
  emptyPoiInput,
  poiInputToValues,
  validatePoiInput,
  type PoiInput,
} from "@/lib/pois/validate";
import type { PoiPosition } from "@/lib/pois/types";

/**
 * POIs von Hand anlegen, aendern und entfernen (req-035). Alle drei sind
 * Vorgaenge, bei denen der Nutzer eine Bestaetigung erwartet -- sie werden
 * sofort geschrieben, nicht verzoegert (siehe delivery/stack.md,
 * Conventions).
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024):
 * Reisen und POIs anderer Accounts existieren fuer diese Sitzung nicht.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positionOf(value: unknown): PoiPosition | null {
  const record = value as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(record?.lat);
  const lng = Number(record?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Ausserhalb dieser Grenzen liegt kein Ort der Erde.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Die Anfrage als Formularstand -- geprueft wird er wie in der Oberflaeche. */
function toInput(body: Record<string, unknown>): PoiInput {
  const vorgabe = emptyPoiInput();
  return {
    name: textOf(body.name),
    ort: textOf(body.ort),
    type: isPoiType(body.type) ? body.type : vorgabe.type,
    position: positionOf(body.position),
    status: isPoiStatus(body.status) ? body.status : vorgabe.status,
    address: textOf(body.address),
    web: textOf(body.web),
    phone: textOf(body.phone),
    openingHours: textOf(body.openingHours),
  };
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
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

  const body = await readBody(request);
  if (!body) return invalidBody();

  const tripId = textOf(body.tripId).trim();
  if (tripId.length === 0) return invalidBody();

  const input = toInput(body);
  const errors = validatePoiInput(input);
  const values = poiInputToValues(input);
  // Ohne Name, Ort oder Position entsteht kein POI (req-035) -- dieselbe
  // Pruefung laeuft schon im Formular.
  if (!values) return Response.json({ errors }, { status: 400 });

  const poi = await createPoi(getPool(), session.accountId, tripId, values);
  if (!poi) return Response.json({ error: "unknown trip" }, { status: 404 });

  return Response.json({ poi }, { status: 201 });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id).trim();
  if (id.length === 0) return invalidBody();

  const input = toInput(body);
  const errors = validatePoiInput(input);
  const values = poiInputToValues(input);
  if (!values) return Response.json({ errors }, { status: 400 });

  // Die Nummer steht nicht im Formularstand und wird deshalb nie
  // geschrieben -- sie bleibt nach der Vergabe fest (req-013).
  const poi = await updatePoi(getPool(), session.accountId, id, values);
  if (!poi) return Response.json({ error: "unknown poi" }, { status: 404 });

  return Response.json({ poi });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id).trim();
  if (id.length === 0) return invalidBody();

  // Zuerst die Datensaetze, dann die Dateien (wie bei den Dokumenten,
  // req-034): so bleibt nie ein Datensatz zurueck, der ins Leere zeigt.
  const entfernt = await deletePoi(getPool(), session.accountId, id);
  if (!entfernt)
    return Response.json({ error: "unknown poi" }, { status: 404 });

  if (entfernt.removedFileNames.length > 0) {
    try {
      const store = fileSystemPhotoStore();
      for (const fileName of entfernt.removedFileNames) {
        await store.remove(fileName).catch(() => {});
      }
    } catch {
      // Ohne Bildverzeichnis gibt es nichts zu raeumen; der POI ist weg.
    }
  }

  return Response.json({ status: "ok" });
}
