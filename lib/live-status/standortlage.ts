import type { Activity } from "@/lib/activities/types";
import type { OrtLookup } from "@/lib/pois/derive-ort";
import type { GeteiltePosition } from "@/lib/positions/types";
import { positionFuerLiveStatus } from "@/lib/positions/auswahl";
import type { RoutingClient } from "@/lib/routing/client";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { fahrzeitMitRueckfall } from "./fahrzeit-cache";
import { ortZurPosition } from "./ort-cache";
import { planEintragZu } from "./plan-eintrag";
import { OHNE_STANDORT, type Standortlage } from "./types";
import { verzugAusFahrzeit, verzugZumNaechsten } from "./verzug";
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
 * Ort und Verzug fuer den Live-Status (req-051). Laeuft ein Programmpunkt,
 * ist der Verzug die Fahrzeit von der geltenden Position zu seinem Ort;
 * steht der naechste erst an, ist es die Fahrzeit gegen die Zeit bis zu
 * seinem Beginn (req-084). Transfers spielen dabei keine Rolle -- unterwegs
 * zaehlt, wo die Gruppe wirklich ist, nicht die hinterlegte Dauer.
 *
 * Ohne geteilte Position gibt es beides nicht; ist heute nichts mehr
 * geplant (oder hat der Punkt keinen Ort), gibt es keinen Verzug -- der Ort
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
  const ziel = eintrag?.activity.position;
  if (!eintrag || !ziel) return { ort, verzug: { art: "keiner" } };

  // Schweigt der Routing-Dienst, hilft die zuletzt ermittelte Fahrzeit zum
  // selben Ziel weiter -- mit ihrem Stand (bug-067).
  const fahrzeit = await fahrzeitMitRueckfall(
    eingabe.tripId,
    position,
    ziel,
    quellen.routing,
    eingabe.jetzt.getTime(),
  );
  const minuten = fahrzeit?.minuten ?? null;
  const ermitteltAm = fahrzeit?.ermitteltAm ?? null;
  return {
    ort,
    verzug:
      eintrag.art === "laufend"
        ? verzugAusFahrzeit(minuten, ermitteltAm)
        : verzugZumNaechsten(
            minuten,
            eintrag.activity.startAt,
            eingabe.jetzt,
            ermitteltAm,
          ),
  };
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
