import type { OrtLookup } from "@/lib/pois/derive-ort";
import type { Wegpunkt } from "@/lib/routing/client";

/**
 * Der Live-Status fragt im Minutentakt nach; die Ortschaft zu einer
 * Position aendert sich in dieser Zeit praktisch nie. Innerhalb dieses
 * Fensters wird deshalb nicht erneut bei Nominatim nachgeschlagen -- dessen
 * Abruffrequenz ist begrenzt (siehe lib/osm/ort-lookup.ts).
 */
export const ORT_CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Drei Nachkommastellen sind rund 100 Meter -- fein genug, um die Ortschaft
 * zu treffen, grob genug, damit ein paar Schritte keinen neuen Abruf
 * ausloesen.
 */
function positionsKey(position: Wegpunkt): string {
  return `${position.lat.toFixed(3)},${position.lng.toFixed(3)}`;
}

const cache = new Map<string, { ort: string | null; fetchedAt: number }>();

/** Die Ortschaft zur Position, hoechstens alle 15 Minuten neu nachgeschlagen. */
export async function ortZurPosition(
  position: Wegpunkt,
  lookup: Pick<OrtLookup, "fromPosition">,
  now: number,
): Promise<string | null> {
  const key = positionsKey(position);
  const entry = cache.get(key);
  if (entry && now - entry.fetchedAt <= ORT_CACHE_TTL_MS) return entry.ort;

  const ort = await lookup.fromPosition(position);
  cache.set(key, { ort, fetchedAt: now });
  return ort;
}

export function clearOrtCache(): void {
  cache.clear();
}
