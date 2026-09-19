import type { PoiStatus } from "./types";

const POI_STATUS_API = "/api/poi-status";

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
    const response = await fetch(POI_STATUS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poiId, status }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Speichert denselben Status fuer mehrere POIs auf einmal (req-069) -- die
 * angekreuzten der Liste.
 *
 * Liefert die Kennungen der tatsaechlich gesetzten POIs, oder null, wenn
 * ueberhaupt nichts ankam. Der Aufrufer nimmt seine Anzeige fuer alles
 * zurueck, was nicht darunter steht, und sagt es (bug-021): ein Fehlschlag,
 * nach dem die Liste den neuen Status zeigt, darf es auch hier nicht geben.
 */
export async function savePoiStatuses(
  poiIds: string[],
  status: PoiStatus,
): Promise<string[] | null> {
  if (poiIds.length === 0) return [];
  try {
    const response = await fetch(POI_STATUS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poiIds, status }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { updatedIds?: string[] };
    return payload.updatedIds ?? null;
  } catch {
    return null;
  }
}
