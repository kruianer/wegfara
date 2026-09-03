import type { TripState } from "./state";

const TRIPS_API = "/api/trips";

/**
 * Setzt den Zustand einer Reise (siehe req-022). Der Wechsel ist ein
 * Vorgang, bei dem der Nutzer eine Bestaetigung erwartet -- er wird sofort
 * geschrieben, nicht verzoegert (siehe delivery/stack.md, Conventions).
 *
 * Liefert false, wenn das Speichern fehlschlaegt; die Oberflaeche zeigt dann
 * weiterhin den bisherigen Zustand und weist darauf hin, statt einen nur
 * scheinbar gesetzten anzuzeigen.
 */
export async function saveTripState(
  tripId: string,
  state: TripState,
): Promise<boolean> {
  try {
    const response = await fetch(TRIPS_API, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tripId, state }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
