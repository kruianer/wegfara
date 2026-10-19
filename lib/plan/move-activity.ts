import type { Activity } from "@/lib/activities/types";
import type { Trip } from "@/lib/trips/types";
import { parseIsoDate } from "@/lib/trips/date-utils";
import { dayTimeAt, minutesAtOffset, snapStartMinutes } from "./plan-poi";
import { GRUNDRASTER_MINUTEN, type RasterMinuten } from "./raster";
import type { TimelineGrid } from "./timeline-grid";

/**
 * Einen bereits gesetzten Programmpunkt umplanen (req-040): auf eine andere
 * Uhrzeit ziehen, auf einen anderen Reisetag ziehen oder ihn an einer seiner
 * Kanten laenger bzw. kuerzer ziehen -- seit req-046 an beiden. Die Regeln
 * stehen hier und nicht in der Oberflaeche -- die Schnittstelle rechnet mit
 * denselben (siehe app/api/programmpunkte/route.ts).
 *
 * Ueberlappungen bleiben dabei erlaubt (req-039): zwei Programmpunkte zur
 * selben Zeit liegen nebeneinander, abgelehnt wird nichts.
 *
 * Das Raster, in dem Startzeit und Dauer einrasten, ist seit req-082
 * waehlbar (siehe lib/plan/raster.ts) -- ohne Angabe gilt weiterhin die
 * Vorgabe von 15 Minuten.
 */

/**
 * Die kuerzeste Dauer eines Programmpunkts (req-040, Funktion). Sie bleibt
 * bei 15 Minuten, auch im feinen Raster (req-082, Constraints): eine
 * Mindestdauer von 15 Minuten widerspricht 5-Minuten-Schritten nicht, und
 * eine kuerzere Mindestdauer hat niemand verlangt.
 */
export const MIN_DURATION_MINUTES = 15;

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

/** Die neuen Zeiten eines umgeplanten Programmpunkts. */
export interface ActivityTimes {
  startAt: string;
  endAt: string;
}

/** Zeitpunkt einer Angabe "YYYY-MM-DDTHH:mm" in Minuten; null, wenn unbrauchbar. */
function minutesSinceEpoch(dateTime: string): number | null {
  const match = DATE_TIME.exec(dateTime);
  if (!match) return null;
  const { year, month, day } = parseIsoDate(match[1]);
  return (
    Date.UTC(year, month - 1, day, Number(match[2]), Number(match[3])) / 60_000
  );
}

/**
 * Die Viertelstunde, in der eine Zeit liegt: es gilt die zuletzt erreichte
 * (req-039). Anders als beim Beginn bleibt sie nicht im Reisetag -- ein Ende
 * darf ueber Mitternacht reichen (siehe req-011).
 */
function snapDownMinutes(
  minutes: number,
  raster: RasterMinuten = GRUNDRASTER_MINUTEN,
): number {
  return Math.max(Math.floor(minutes / raster) * raster, 0);
}

/** Wie lange ein Programmpunkt dauert, in Minuten -- ueber Mitternacht hinweg. */
export function durationMinutes(
  activity: Pick<Activity, "startAt" | "endAt">,
): number | null {
  const start = minutesSinceEpoch(activity.startAt);
  const end = minutesSinceEpoch(activity.endAt);
  if (start === null || end === null) return null;
  return end - start;
}

/**
 * Wann ein an dieser Stelle des Rasters losgelassener unterer Rand endet
 * (req-040) -- das Gegenstueck zu `dropStartAt` (req-039).
 */
export function dropEndAt(
  date: string,
  offsetPx: number,
  grid: TimelineGrid,
  raster: RasterMinuten = GRUNDRASTER_MINUTEN,
): string {
  return dayTimeAt(
    date,
    snapDownMinutes(minutesAtOffset(offsetPx, grid), raster),
  );
}

/**
 * Dieselbe Uhrzeit an einem anderen Reisetag (req-040): wer einen
 * Programmpunkt auf den Reiter eines anderen Tages zieht, behaelt Uhrzeit
 * und Dauer.
 */
export function sameTimeOnDay(
  activity: Pick<Activity, "startAt">,
  date: string,
): string {
  return `${date}T${activity.startAt.slice(11, 16)}`;
}

/**
 * Der Programmpunkt an einer neuen Startzeit (req-040): der Beginn rastet auf
 * 15 Minuten ein, die Dauer bleibt gleich -- auch beim Wechsel auf einen
 * anderen Reisetag.
 *
 * Liefert null, wenn er dort nicht liegen darf: die Zeitangabe ist
 * unbrauchbar, der Reisetag liegt ausserhalb des Reisezeitraums (req-040,
 * Constraints), oder der Programmpunkt selbst traegt unbrauchbare Zeiten.
 */
export function movedActivityTimes(
  activity: Pick<Activity, "startAt" | "endAt">,
  trip: Pick<Trip, "startDate" | "endDate">,
  startAt: string,
  raster: RasterMinuten = GRUNDRASTER_MINUTEN,
): ActivityTimes | null {
  const match = DATE_TIME.exec(startAt);
  if (!match) return null;
  const [, date, hours, minutes] = match;
  if (date < trip.startDate || date > trip.endDate) return null;

  const dauer = durationMinutes(activity);
  if (dauer === null || dauer < 0) return null;

  const start = snapStartMinutes(Number(hours) * 60 + Number(minutes), raster);
  return {
    startAt: dayTimeAt(date, start),
    endAt: dayTimeAt(date, start + dauer),
  };
}

/**
 * Der Programmpunkt mit einem neuen Ende (req-040): der Beginn bleibt, wo er
 * ist, das Ende rastet auf 15 Minuten ein. Ueber den Beginn hinaus nach oben
 * gezogen bleibt eine Viertelstunde stehen -- kuerzer wird er nicht.
 *
 * Der Reisetag aendert sich dabei nicht; ein Ende nach Mitternacht faellt wie
 * gewohnt auf den Folgetag (siehe req-011).
 */
export function resizedActivityTimes(
  activity: Pick<Activity, "startAt" | "endAt">,
  endAt: string,
  raster: RasterMinuten = GRUNDRASTER_MINUTEN,
): ActivityTimes | null {
  const match = DATE_TIME.exec(activity.startAt);
  const gezogen = minutesSinceEpoch(endAt);
  if (!match || gezogen === null) return null;

  const date = match[1];
  const tagesbeginn = minutesSinceEpoch(`${date}T00:00`);
  const beginn = minutesSinceEpoch(activity.startAt);
  if (tagesbeginn === null || beginn === null) return null;

  const start = beginn - tagesbeginn;
  const ende = Math.max(
    snapDownMinutes(gezogen - tagesbeginn, raster),
    start + MIN_DURATION_MINUTES,
  );

  return { startAt: dayTimeAt(date, start), endAt: dayTimeAt(date, ende) };
}

/**
 * Der Programmpunkt mit einem neuen Beginn (req-046): das Ende bleibt, wo es
 * ist, der Beginn rastet auf 15 Minuten ein. Ueber das Ende hinaus nach unten
 * gezogen bleibt eine Viertelstunde stehen -- kuerzer wird er nicht.
 *
 * Das Gegenstueck zu `resizedActivityTimes`, das an der unteren Kante zieht.
 * Der Reisetag aendert sich dabei nicht: ein Programmpunkt gehoert zu dem Tag,
 * an dem er beginnt (req-039), und die obere Kante bleibt in dessen Raster.
 */
export function resizedActivityStartTimes(
  activity: Pick<Activity, "startAt" | "endAt">,
  startAt: string,
  raster: RasterMinuten = GRUNDRASTER_MINUTEN,
): ActivityTimes | null {
  const match = DATE_TIME.exec(activity.startAt);
  const gezogen = minutesSinceEpoch(startAt);
  if (!match || gezogen === null) return null;

  const date = match[1];
  const tagesbeginn = minutesSinceEpoch(`${date}T00:00`);
  const ende = minutesSinceEpoch(activity.endAt);
  if (tagesbeginn === null || ende === null) return null;

  const schluss = ende - tagesbeginn;
  const start = Math.max(
    Math.min(
      snapDownMinutes(gezogen - tagesbeginn, raster),
      schluss - MIN_DURATION_MINUTES,
    ),
    0,
  );

  return { startAt: dayTimeAt(date, start), endAt: dayTimeAt(date, schluss) };
}
