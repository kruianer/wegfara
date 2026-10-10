import type { DruckDarstellung } from "./types";

const DRUCK_API = "/api/programmpunkt-druck";

/**
 * Setzt das Kennzeichen eines Programmpunkts fuer den gedruckten Reiseplan
 * (req-080). Der Nutzer sieht das Heft daneben und erwartet, dass die Wahl
 * ankommt -- geschrieben wird deshalb sofort, nicht verzoegert (siehe
 * delivery/stack.md, Conventions).
 *
 * Liefert false, wenn das Speichern fehlschlaegt; die Oberflaeche nimmt ihre
 * Anzeige dann zurueck und sagt es, statt ein nur scheinbar gesetztes
 * Kennzeichen zu zeigen (bug-021).
 */
export async function saveDruckDarstellung(
  activityId: string,
  darstellung: DruckDarstellung,
): Promise<boolean> {
  try {
    const response = await fetch(DRUCK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityId, darstellung }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
