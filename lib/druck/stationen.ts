import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import type { Trip } from "../trips/types";
import { activitiesForDay } from "../activities/day";
import { groupActivities, resolveGroupActivity } from "../activities/groups";
import { druckDarstellung } from "../activities/druck-darstellung";
import { ACTIVITY_TYPE_LABEL } from "../activities/type-meta";
import { tripDays } from "../trips/days";
import { formatLangesDatum } from "../trips/format";
import { druckFotos, stationFotos } from "./fotos";
import { stationLayouts, type StationGewicht } from "./layouts";
import type { DruckStation, DruckTag } from "./types";

/**
 * Der Tagesteil des gedruckten Reiseplans (req-080): je Reisetag eine Seite,
 * darauf seine Stationen.
 *
 * Was hier **nicht** vorkommt, ist Absicht:
 *
 * - **Transfers.** Sie gehoeren zum Fahrplan, nicht zum Magazin -- unterwegs
 *   sagt die App, wie lange die Fahrt dauert. Diese Funktion bekommt sie
 *   deshalb gar nicht erst zu sehen.
 * - **Dauer und Endzeit** einer Station. Nur die Startzeit steht da; ein
 *   Zeitfenster machte aus dem Heft einen Fahrplan.
 * - **Buchungszustand und Preise.** Beides gesammelt auf der letzten Seite.
 * - **Alle Alternativen einer Options-Gruppe** (req-004). Nur die Hauptoption
 *   bekommt Raum; die Alternative wird in einem Satz erwaehnt.
 *
 * Ein Tag ohne Programmpunkte bleibt als Seite stehen -- beim Durchblaettern
 * soll man sehen, was noch offen ist.
 */

/** Die Beschriftung einer Nebenstation; ihre Art tritt dahinter zurueck. */
export const NEBENSTATION_ART = "Nebenstation";

/**
 * Der Satz, der die Alternativen einer Options-Gruppe erwaehnt (req-004).
 * Wer wissen will, was die zweite Moeglichkeit genau ist, findet sie in der
 * App -- im Heft bekommt nur die Hauptoption Raum.
 */
export function alternativenSatz(namen: string[]): string | null {
  if (namen.length === 0) return null;
  const aufzaehlung = namen.map((name) => `„${name}“`);
  const gereiht =
    aufzaehlung.length === 1
      ? aufzaehlung[0]
      : `${aufzaehlung.slice(0, -1).join(", ")} und ${aufzaehlung[aufzaehlung.length - 1]}`;
  return namen.length === 1
    ? `Als Alternative steht ${gereiht} zur gleichen Zeit im Plan — entschieden wird vor Ort.`
    : `Als Alternativen stehen ${gereiht} zur gleichen Zeit im Plan — entschieden wird vor Ort.`;
}

/** Was eine Station im Heft wird: der Programmpunkt und sein Nebensatz. */
interface Kandidat {
  activity: Activity;
  alternative: string | null;
}

/**
 * Die Programmpunkte eines Tages, wie sie ins Heft kommen: Options-Gruppen auf
 * ihre Hauptoption eingekocht, Programmpunkte mit "Nicht anzeigen" weggelassen.
 *
 * Traegt die Hauptoption einer Gruppe "Nicht anzeigen", faellt die ganze
 * Gruppe aus dem Heft -- auch der Nebensatz zu ihren Alternativen: er haengt
 * an einer Station, die es dort nicht gibt.
 */
function kandidaten(
  activities: Activity[],
  optionSelections: Record<string, string>,
): Kandidat[] {
  return groupActivities(activities)
    .map((entry): Kandidat => {
      if (entry.kind === "single") {
        return { activity: entry.activity, alternative: null };
      }
      const haupt = resolveGroupActivity(entry.group, optionSelections);
      const andere = entry.group.activities.filter((a) => a.id !== haupt.id);
      return {
        activity: haupt,
        alternative: alternativenSatz(andere.map((a) => a.title)),
      };
    })
    .filter(
      (kandidat) => druckDarstellung(kandidat.activity) !== "nicht_anzeigen",
    );
}

function gewicht(activity: Activity): StationGewicht {
  return druckDarstellung(activity) === "nebenstation" ? "neben" : "gross";
}

/** Die Stationen eines Tages, in ihrer Reihenfolge und mit ihren Layouts. */
export function druckStationen({
  activities,
  pois,
  optionSelections = {},
}: {
  /** Die Programmpunkte genau eines Reisetags, aufsteigend nach Beginnzeit. */
  activities: Activity[];
  pois: Poi[];
  optionSelections?: Record<string, string>;
}): DruckStation[] {
  const poiById = new Map(pois.map((poi) => [poi.id, poi]));
  const gewaehlte = kandidaten(activities, optionSelections);
  const layouts = stationLayouts(gewaehlte.map((k) => gewicht(k.activity)));

  return gewaehlte.map(({ activity, alternative }, index) => {
    const layout = layouts[index];
    // Die Fotos kommen ueber den POI, auf den der Programmpunkt zeigt;
    // ein Programmpunkt ohne POI hat keine (req-080, Constraints).
    const poi = activity.poiId ? poiById.get(activity.poiId) : undefined;
    const { grossesFoto, kleineFotos } = stationFotos(druckFotos(poi), layout);
    return {
      activityId: activity.id,
      layout,
      // Nur die Startzeit -- keine Dauer, keine Endzeit.
      startzeit: activity.startAt.slice(11, 16),
      art:
        gewicht(activity) === "neben"
          ? NEBENSTATION_ART
          : ACTIVITY_TYPE_LABEL[activity.type],
      name: activity.title,
      // Der Langtext steht am Programmpunkt (req-044) -- nicht der Kurztext.
      langtext: activity.longText,
      grossesFoto,
      kleineFotos,
      alternative,
    };
  });
}

/** Alle Reisetage mit ihren Stationen -- auch die ohne Programmpunkte. */
export function druckTage({
  trip,
  activities,
  pois,
  optionSelections = {},
}: {
  trip: Pick<Trip, "id" | "startDate" | "endDate">;
  /** Die Programmpunkte der Reise, in beliebiger Reihenfolge. */
  activities: Activity[];
  pois: Poi[];
  optionSelections?: Record<string, string>;
}): DruckTag[] {
  return tripDays(trip).map((tag, index) => ({
    nummer: index + 1,
    datum: tag.date,
    datumText: formatLangesDatum(tag.date),
    stationen: druckStationen({
      activities: activitiesForDay(activities, trip.id, tag.date),
      pois,
      optionSelections,
    }),
  }));
}
