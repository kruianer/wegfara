import type { Activity } from "./types";
import type { Poi } from "../pois/types";

/**
 * Der POI, aus dem ein Programmpunkt entstanden ist (`poiId`, req-011).
 *
 * Von ihm kommen die Fotos, die Webseite und die weiteren Kontaktwege der
 * Kachel im Begleiter (req-079). null heisst: der Programmpunkt zeigt auf
 * keinen POI, oder der POI liegt nicht vor — beides ist kein Fehler, dann
 * bleibt die Kachel bei dem, was der Programmpunkt selbst weiss.
 */
export function poiZumProgrammpunkt(
  activity: Pick<Activity, "poiId">,
  pois: Poi[],
): Poi | undefined {
  if (!activity.poiId) return undefined;
  return pois.find((poi) => poi.id === activity.poiId);
}

/**
 * Die Kennungen der POIs, aus denen diese Programmpunkte entstanden sind —
 * genau die POIs, die der Begleiter fuer seine Kacheln braucht (req-079).
 * Programmpunkte ohne POI bringen keine mit; jede Kennung steht einmal darin.
 */
export function poiIdsDerProgrammpunkte(
  activities: Pick<Activity, "poiId">[],
): Set<string> {
  const ids = new Set<string>();
  for (const activity of activities) {
    if (activity.poiId) ids.add(activity.poiId);
  }
  return ids;
}
