import type { PoiStatus } from "./types";

/**
 * Speichert den Status eines POI serverseitig (siehe req-010).
 *
 * Liefert `false`, wenn nicht gespeichert werden konnte. Frueher wurde ein
 * Fehlschlag bewusst verschluckt, weil die Oberflaeche den Status bereits
 * optimistisch uebernommen hatte -- genau das ist bug-021: die Anzeige sah
 * aus wie nach einem erfolgreichen Speichern, obwohl nichts geschrieben
 * wurde. Der Aufrufer nimmt seine Anzeige jetzt zurueck und sagt es.
 */
export async function savePoiStatus(
  poiId: string,
  status: PoiStatus,
): Promise<boolean> {
  try {
    const response = await fetch("/api/poi-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poiId, status }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
