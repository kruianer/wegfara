import type { PoiPosition } from "./types";

/**
 * Speichert das Suchgebiet einer Reise serverseitig (siehe req-012). Schlaegt
 * der Aufruf fehl, bleibt die Flaeche lokal bestehen; ein Fehler wird bewusst
 * nicht nach aussen gereicht, analog lib/pois/save-status.ts.
 */
export async function saveSearchArea(
  tripId: string,
  points: PoiPosition[],
): Promise<void> {
  try {
    await fetch("/api/search-area", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, points }),
    });
  } catch {
    // Netzwerkfehler bewusst verschluckt, siehe Kommentar oben.
  }
}

/** Entfernt das Suchgebiet einer Reise wieder (siehe req-012). */
export async function removeSearchArea(tripId: string): Promise<void> {
  try {
    await fetch("/api/search-area", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
  } catch {
    // Netzwerkfehler bewusst verschluckt, siehe Kommentar oben.
  }
}
