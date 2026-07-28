import type { Activity } from "./types";

/** z.B. "10:00 – 12:30" aus Beginn- und Endzeit eines Programmpunkts. */
export function formatTimeRange(
  activity: Pick<Activity, "startAt" | "endAt">,
): string {
  return `${activity.startAt.slice(11, 16)} – ${activity.endAt.slice(11, 16)}`;
}
