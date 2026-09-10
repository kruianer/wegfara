import { getPool } from "@/lib/db/pool";
import {
  createActivity,
  findActivity,
  listActivities,
  updateActivityTimes,
} from "@/lib/db/activities";
import { findPoi, listPois } from "@/lib/db/pois";
import { findTrip } from "@/lib/db/trips";
import { createTransfer, listTransfers } from "@/lib/db/transfers";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { createOpenAiClient } from "@/lib/ai/openai-client";
import { createOsrmClient } from "@/lib/routing/osrm-client";
import {
  erstellePlanvorschlag,
  zuVerplanendePois,
} from "@/lib/plan/ki-planung";
import { parseUebernahmePunkte, transferLuecken } from "@/lib/plan/uebernahme";
import { plannedActivityFromPoi } from "@/lib/plan/plan-poi";
import { movedActivityTimes } from "@/lib/plan/move-activity";
import { ermittleRouten, transferVorschlag } from "@/lib/transfers/vorschlag";
import { vorgeschlagenerTitel } from "@/lib/transfers/validate";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";

/**
 * "KI planen lassen" (req-056): POST rechnet den Vorschlag, PUT uebernimmt
 * ihn. Dazwischen liegt der Reiseleiter -- gespeichert wird ausschliesslich
 * beim Uebernehmen (siehe delivery/vision.md).
 *
 * Der Lauf kostet Geld und wird ueber den Zugangsschluessel des Accounts
 * abgerechnet (req-028): ohne ihn plant die Schnittstelle gar nicht erst.
 * Geprueft wird das hier und nicht nur in der Oberflaeche.
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024).
 */

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
  const accountId = session.accountId;

  const body = await readBody(request);
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  if (!body || tripId.length === 0) return invalidBody();
  const neuOrdnen = body.neuOrdnen === true;

  const db = getPool();
  // Bezahlt wird der Lauf vom Account, in dem gerade gearbeitet wird
  // (req-028) -- auf den Schluessel eines anderen wird nie zurueckgegriffen.
  const openAiKey = await accountApiKey(db, accountId, "ki_suche");
  if (!openAiKey) {
    return Response.json({ error: "kein Zugangsschluessel" }, { status: 409 });
  }

  const trip = await findTrip(db, accountId, tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  const [pois, activities] = await Promise.all([
    listPois(db, accountId),
    listActivities(db, accountId),
  ]);
  const params = {
    trip,
    pois: pois.filter((poi) => poi.tripId === tripId),
    activities: activities.filter((activity) => activity.tripId === tripId),
    neuOrdnen,
  };

  // Ohne POIs mit Status "Gesetzt" oder "Wahrscheinlich" gibt es nichts zu
  // verplanen -- dann wird die KI gar nicht erst gefragt (req-056).
  if (zuVerplanendePois(params).length === 0) {
    return Response.json({ vorschlag: null, grund: "nichts_zu_verplanen" });
  }

  const ai = createOpenAiClient({ apiKey: openAiKey });
  const osrm = createOsrmClient();
  const vorschlag = await erstellePlanvorschlag(params, {
    gruppiere: (prompt) => ai.complete(prompt),
    fahrzeitMinuten: (von, nach) => osrm.fahrzeitMinuten(von, nach),
  });
  if (!vorschlag) {
    return Response.json({ error: "planung fehlgeschlagen" }, { status: 502 });
  }

  return Response.json({ vorschlag });
}

/**
 * Den Vorschlag uebernehmen (req-056): die Programmpunkte entstehen bzw.
 * wandern an ihre neue Stelle, und zwischen ihnen entstehen die Transfers
 * (req-052). Erst hier wird gespeichert.
 */
export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  const accountId = session.accountId;

  const body = await readBody(request);
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  if (!body || tripId.length === 0) return invalidBody();

  const punkte = parseUebernahmePunkte(body.punkte);
  if (!punkte) return invalidBody();

  const db = getPool();
  const trip = await findTrip(db, accountId, tripId);
  if (!trip) return Response.json({ error: "unknown trip" }, { status: 404 });

  const gespeichert: Activity[] = [];
  for (const punkt of punkte) {
    if (punkt.activityId) {
      // Ein neu geordneter Programmpunkt behaelt seine Dauer und wandert nur
      // (req-040) -- geprueft mit derselben Domaenenlogik wie das Umplanen
      // von Hand.
      const activity = await findActivity(db, accountId, punkt.activityId);
      if (!activity || activity.tripId !== tripId) continue;
      const times = movedActivityTimes(activity, trip, punkt.startAt);
      if (!times) continue;
      const bewegt = await updateActivityTimes(
        db,
        accountId,
        activity.id,
        times,
      );
      if (bewegt) gespeichert.push(bewegt);
      continue;
    }

    // Ein neuer Programmpunkt entsteht aus seinem POI -- Titel, Typ, Texte
    // und Dauer kommen von dort, nie aus der Anfrage (req-039).
    const poi = punkt.poiId ? await findPoi(db, accountId, punkt.poiId) : null;
    if (!poi || poi.tripId !== tripId) continue;
    const values = plannedActivityFromPoi(poi, trip, punkt.startAt);
    if (!values) continue;
    const angelegt = await createActivity(db, accountId, values);
    if (angelegt) gespeichert.push(angelegt);
  }

  const transfers = await legeTransfersAn(db, accountId, tripId);

  return Response.json({ activities: gespeichert, transfers });
}

/**
 * Die Transfers zwischen den Programmpunkten eines Tages (req-056, req-052).
 * Verkehrsmittel, Dauer und Strecke kommen aus der tatsaechlichen Route --
 * ohne Route entsteht keiner, dann traegt der Reiseleiter ihn selbst ein.
 */
async function legeTransfersAn(
  db: ReturnType<typeof getPool>,
  accountId: string,
  tripId: string,
): Promise<Transfer[]> {
  const [activities, vorhandene] = await Promise.all([
    listActivities(db, accountId),
    listTransfers(db, accountId),
  ]);

  const angelegt: Transfer[] = [];
  const luecken = transferLuecken(
    activities.filter((activity) => activity.tripId === tripId),
    vorhandene,
  );

  const osrm = createOsrmClient();
  for (const [von, nach] of luecken) {
    if (!von.position || !nach.position) continue;
    const vorschlag = transferVorschlag(
      await ermittleRouten(osrm, von.position, nach.position),
    );
    if (!vorschlag) continue;

    const angaben = vorschlag.proMittel[vorschlag.mode];
    if (!angaben) continue;
    const transfer = await createTransfer(db, accountId, {
      fromActivityId: von.id,
      toActivityId: nach.id,
      mode: vorschlag.mode,
      title: vorgeschlagenerTitel(nach.title),
      durationMin: angaben.durationMin,
      distanceKm: angaben.distanceKm,
    });
    if (transfer) angelegt.push(transfer);
  }

  return angelegt;
}
