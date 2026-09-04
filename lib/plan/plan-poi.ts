import type { ActivityType, ActivityValues } from "@/lib/activities/types";
import type { Poi, PoiType } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import { POI_ESTIMATED_DURATION_HOURS } from "@/lib/pois/estimated-duration";
import { isPlannablePoi } from "@/lib/pois/unplanned";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { HOUR_HEIGHT_PX, type TimelineGrid } from "./timeline-grid";

/**
 * Einen POI auf den Zeitstrahl ziehen (req-039): wo er losgelassen wird,
 * beginnt der Programmpunkt. Die Regeln stehen hier und nicht in der
 * Oberflaeche -- die Schnittstelle rechnet mit denselben (siehe
 * app/api/programmpunkte/route.ts).
 */

/** Die Startzeit rastet auf 15 Minuten ein (req-039, Funktion). */
export const SNAP_MINUTES = 15;

const MINUTES_PER_DAY = 24 * 60;

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

/**
 * Der Typ des Programmpunkts zu einem POI-Typ (req-039): "Strand" wird zur
 * Sehenswuerdigkeit -- den Typ kennt der Programmpunkt nicht (siehe
 * lib/activities/types.ts). Die uebrigen heissen gleich.
 */
export function activityTypeForPoi(type: PoiType): ActivityType {
  return type === "strand" ? "sehenswuerdigkeit" : type;
}

/** Minuten seit Mitternacht des Reisetages, auf die eine Stelle im Raster zeigt. */
export function minutesAtOffset(offsetPx: number, grid: TimelineGrid): number {
  return grid.startHour * 60 + (offsetPx / HOUR_HEIGHT_PX) * 60;
}

/**
 * Die Viertelstunde, in der eine Stelle im Raster liegt: es gilt die zuletzt
 * erreichte, nicht die naechstgelegene -- wer zwischen 10:00 und 10:15
 * loslaesst, beginnt um 10:00 (req-039, Akzeptanzkriterien).
 *
 * Der Beginn bleibt innerhalb des Reisetages: ein Programmpunkt gehoert zu
 * genau einem Reisetag (req-039, Constraints), und zwar zu dem, an dem er
 * beginnt. Ueber Mitternacht reichen darf er (siehe req-011).
 */
export function snapStartMinutes(minutes: number): number {
  const snapped = Math.floor(minutes / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.min(Math.max(snapped, 0), MINUTES_PER_DAY - SNAP_MINUTES);
}

/**
 * "YYYY-MM-DDTHH:mm" aus einem Reisetag und Minuten seit dessen Mitternacht.
 * Ueber UTC gerechnet, damit die Zeitzone der ausfuehrenden Umgebung nichts
 * verschiebt (siehe bug-004) -- und damit ein Ende nach Mitternacht auf dem
 * Folgetag landet.
 */
export function dayTimeAt(date: string, minutes: number): string {
  const { year, month, day } = parseIsoDate(date);
  const at = new Date(Date.UTC(year, month - 1, day, 0, minutes));
  const iso = at.toISOString();
  return `${iso.slice(0, 10)}T${iso.slice(11, 16)}`;
}

/** Wann ein an dieser Stelle des Rasters losgelassener POI beginnt (req-039). */
export function dropStartAt(
  date: string,
  offsetPx: number,
  grid: TimelineGrid,
): string {
  return dayTimeAt(date, snapStartMinutes(minutesAtOffset(offsetPx, grid)));
}

/** Ob der Reisetag im Zeitraum der Reise liegt (req-039, Constraints). */
function dayBelongsToTrip(trip: Trip, date: string): boolean {
  return date >= trip.startDate && date <= trip.endDate;
}

/**
 * Der Programmpunkt, der aus einem verplanten POI entsteht (req-039): er
 * uebernimmt Name, Position und Typ, seine Dauer ist die geschaetzte Dauer
 * des POI-Typs (req-011). Kurz- und Langtext bleiben leer.
 *
 * Liefert null, wenn daraus kein Programmpunkt entstehen darf: der POI
 * gehoert nicht zu dieser Reise, sein Status ist nicht verplanbar, oder der
 * Beginn liegt ausserhalb des Reisezeitraums.
 */
export function plannedActivityFromPoi(
  poi: Poi,
  trip: Trip,
  startAt: string,
): ActivityValues | null {
  if (poi.tripId !== trip.id) return null;
  // "Weiß noch nicht" und "Verworfen" werden nicht verplant (req-039, Out of
  // Scope) -- sie stehen deshalb auch nicht in "Noch unverplant".
  if (!isPlannablePoi(poi)) return null;

  const match = DATE_TIME.exec(startAt);
  if (!match) return null;
  const [, date, hours, minutes] = match;
  if (!dayBelongsToTrip(trip, date)) return null;

  const start = snapStartMinutes(Number(hours) * 60 + Number(minutes));
  const end = start + POI_ESTIMATED_DURATION_HOURS[poi.type] * 60;

  return {
    tripId: poi.tripId,
    poiId: poi.id,
    type: activityTypeForPoi(poi.type),
    title: poi.name,
    shortText: "",
    longText: "",
    startAt: dayTimeAt(date, start),
    endAt: dayTimeAt(date, end),
    position: poi.position,
  };
}
