import type { PoiStatus } from "./types";

/**
 * Speichert den Status eines POI serverseitig (siehe req-010). Schlaegt
 * der Aufruf fehl, bleibt der Status lokal bestehen; ein Fehler wird
 * bewusst nicht nach aussen gereicht, da die UI ihn bereits optimistisch
 * uebernommen hat (analog lib/activities/save-option-selection.ts).
 */
export async function savePoiStatus(
  poiId: string,
  status: PoiStatus,
): Promise<void> {
  try {
    await fetch("/api/poi-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poiId, status }),
    });
  } catch {
    // Netzwerkfehler bewusst verschluckt, siehe Kommentar oben.
  }
}
