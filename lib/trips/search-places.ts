import type { PlaceSuggestion } from "@/lib/osm/place-search";

const PLACE_SEARCH_API = "/api/place-search";

/**
 * Holt die Ortsvorschlaege zur Eingabe im Feld "Hauptort" (siehe req-017).
 * Die Suche selbst laeuft serverseitig gegen Nominatim; schlaegt sie fehl,
 * bleibt die Vorschlagsliste leer.
 */
export async function searchPlaceSuggestions(
  query: string,
): Promise<PlaceSuggestion[]> {
  let response: Response;
  try {
    response = await fetch(
      `${PLACE_SEARCH_API}?q=${encodeURIComponent(query)}`,
    );
  } catch {
    return [];
  }

  if (!response.ok) return [];

  try {
    // Nennt die Antwort keine Orte, ist die Liste leer -- nicht undefined.
    // Die Signatur verspricht ein Array, und der Aufrufer liest darauf
    // `.length` (poi-anlegezeile.tsx): ein fehlendes Feld warf dort einen
    // TypeError, der den ganzen Testlauf abbrach.
    const body = (await response.json()) as {
      places?: PlaceSuggestion[] | null;
    };
    return body.places ?? [];
  } catch {
    return [];
  }
}
