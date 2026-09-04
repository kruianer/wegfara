import type { Activity } from "@/lib/activities/types";

/**
 * Die Programmpunkte, die aus einem POI entstanden sind (siehe req-011).
 * Die Rueckfrage vor dem Loeschen nennt sie (req-035): der POI verschwindet,
 * der Programmpunkt bleibt und verliert nur die Verknuepfung.
 */
export function activitiesOfPoi(
  poiId: string,
  activities: Activity[],
): Activity[] {
  return activities.filter((activity) => activity.poiId === poiId);
}
