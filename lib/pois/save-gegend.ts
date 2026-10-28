const POI_GEGEND_API = "/api/poi-gegend";

/**
 * Speichert dieselbe Gegend fuer mehrere POIs auf einmal (req-098) -- die
 * angekreuzten der Liste. null nimmt ihnen die Gegend. Gebaut wie
 * savePoiStatuses (req-069).
 *
 * Liefert die Kennungen der tatsaechlich gesetzten POIs, oder null, wenn
 * ueberhaupt nichts ankam. Der Aufrufer nimmt seine Anzeige fuer alles
 * zurueck, was nicht darunter steht, und sagt es (bug-021).
 */
export async function savePoiGegenden(
  poiIds: string[],
  gegend: string | null,
): Promise<string[] | null> {
  if (poiIds.length === 0) return [];
  try {
    const response = await fetch(POI_GEGEND_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poiIds, gegend }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { updatedIds?: string[] };
    return payload.updatedIds ?? null;
  } catch {
    return null;
  }
}
