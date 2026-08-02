/** Pixelhoehe je Stunde im Zeitstrahl-Raster (siehe req-011, GUI: 48 px je Stunde). */
export const HOUR_HEIGHT_PX = 48;

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 22;

export interface TimelineGrid {
  /** Rasterbeginn in Stunden seit Mitternacht des betrachteten Reisetages. */
  startHour: number;
  /** Rasterende in Stunden seit Mitternacht des betrachteten Reisetages,
   * kann > 24 sein, wenn der spaeteste Programmpunkt ueber Mitternacht reicht. */
  endHour: number;
}

/** Stunden seit Mitternacht von `date`, auch wenn `dateTime` auf den Folgetag faellt. */
function hoursSinceDayStart(dateTime: string, date: string): number {
  const [hh, mm] = dateTime.slice(11, 16).split(":").map(Number);
  const hours = hh + mm / 60;
  return dateTime.slice(0, 10) === date ? hours : hours + 24;
}

/**
 * Bestimmt den Stundenbereich des Zeitstrahl-Rasters eines Reisetages
 * (siehe req-011, Funktion): von der vollen Stunde vor dem fruehesten
 * Beginn bis zur vollen Stunde nach dem spaetesten Ende, mindestens aber
 * von 08:00 bis 22:00. `activities` muss bereits auf den betrachteten Tag
 * gefiltert sein (siehe lib/activities/day.ts).
 */
export function computeTimelineGrid(
  activities: { startAt: string; endAt: string }[],
  date: string,
): TimelineGrid {
  if (activities.length === 0) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  const starts = activities.map((a) => hoursSinceDayStart(a.startAt, date));
  const ends = activities.map((a) => hoursSinceDayStart(a.endAt, date));
  const earliestStart = Math.min(...starts);
  const latestEnd = Math.max(...ends);

  return {
    startHour: Math.min(DEFAULT_START_HOUR, Math.ceil(earliestStart) - 1),
    endHour: Math.max(DEFAULT_END_HOUR, Math.floor(latestEnd) + 1),
  };
}

/** z.B. "09:00" aus einer Rasterstunde, auch jenseits von Mitternacht (25 -> "01:00"). */
export function formatGridHourLabel(hour: number): string {
  return `${String(hour % 24).padStart(2, "0")}:00`;
}

export interface BlockLayout {
  topPx: number;
  heightPx: number;
}

/** Position und Hoehe eines Programmpunkt-Blocks relativ zum Rasterbeginn. */
export function computeBlockLayout(
  activity: { startAt: string; endAt: string },
  grid: TimelineGrid,
  date: string,
): BlockLayout {
  const start = hoursSinceDayStart(activity.startAt, date);
  const end = hoursSinceDayStart(activity.endAt, date);
  return {
    topPx: (start - grid.startHour) * HOUR_HEIGHT_PX,
    heightPx: (end - start) * HOUR_HEIGHT_PX,
  };
}
