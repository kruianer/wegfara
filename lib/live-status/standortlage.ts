import type { Activity } from "@/lib/activities/types";
import type { OrtLookup } from "@/lib/pois/derive-ort";
import type { GeteiltePosition } from "@/lib/positions/types";
import { positionFuerLiveStatus } from "@/lib/positions/auswahl";
import type { RoutingClient } from "@/lib/routing/client";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { ortZurPosition } from "./ort-cache";
import { planEintragZu } from "./plan-eintrag";
import { OHNE_STANDORT, type Standortlage } from "./types";
import { verzugAusFahrzeit } from "./verzug";
import { lokaleZeit } from "./zeit";

export interface LageEingabe {
  tripId: string;
  /** Die angemeldete Person -- ihre eigene Position geht vor (req-051). */
  selbstId: string;
  zuordnungen: TripParticipant[];
  positionen: GeteiltePosition[];
  /** Die Programmpunkte der Reise. */
  activities: Activity[];
  jetzt: Date;
}

export interface LageQuellen {
  routing: RoutingClient;
  ortLookup: Pick<OrtLookup, "fromPosition">;
}

/**
 * Ort und Verzug fuer den Live-Status (req-051). Der Verzug ist die
 * Fahrzeit von der geltenden Position zum Ort des gerade laufenden
 * Programmpunkts.
 *
 * Ohne geteilte Position gibt es beides nicht; laeuft gerade kein
 * Programmpunkt (oder hat er keinen Ort), gibt es keinen Verzug -- der Ort
 * steht dann trotzdem unter "Laut GPS".
 */
export async function ermittleStandortlage(
  eingabe: LageEingabe,
  quellen: LageQuellen,
): Promise<Standortlage> {
  const position = positionFuerLiveStatus(eingabe.positionen, {
    tripId: eingabe.tripId,
    selbstId: eingabe.selbstId,
    zuordnungen: eingabe.zuordnungen,
    jetzt: eingabe.jetzt,
  });
  if (!position) return OHNE_STANDORT;

  const ort = await ortDerPosition(position, quellen, eingabe.jetzt);

  const eintrag = planEintragZu(
    eingabe.activities.filter((activity) => activity.tripId === eingabe.tripId),
    lokaleZeit(eingabe.jetzt),
  );
  const ziel = eintrag?.art === "laufend" ? eintrag.activity.position : null;
  if (!ziel) return { ort, verzug: { art: "keiner" } };

  const fahrzeit = await quellen.routing.fahrzeitMinuten(position, ziel);
  return { ort, verzug: verzugAusFahrzeit(fahrzeit) };
}

/**
 * Der Name der Ortschaft; kennt ihn weder die gespeicherte Position noch
 * die Ortssuche, stehen die Koordinaten dort -- "Laut GPS" bleibt damit
 * immer eine Angabe und nie ein leeres Feld.
 */
async function ortDerPosition(
  position: GeteiltePosition,
  quellen: LageQuellen,
  jetzt: Date,
): Promise<string> {
  if (position.ort && position.ort.trim().length > 0) return position.ort;

  const nachgeschlagen = await ortZurPosition(
    position,
    quellen.ortLookup,
    jetzt.getTime(),
  );
  if (nachgeschlagen && nachgeschlagen.trim().length > 0) {
    return nachgeschlagen.trim();
  }

  return `${position.lat.toFixed(3)}, ${position.lng.toFixed(3)}`;
}
