import type { Poi } from "./types";

/**
 * Die Teaserbilder der POIs einer Reise nach ihrer Kennung (req-111) -- je
 * POI die Kennung seines ersten Fotos, dasselbe, das die POI-Liste zeigt
 * (req-097). Daraus bekommt ein Programmpunkt des Zeitstrahls das Bild des
 * POI, aus dem er entstanden ist; der Zeitstrahl fragt die Fotos nicht selbst
 * ab (nach dem Muster von `poiNummernNachId`, req-074). Ein POI ohne Foto
 * steht nicht darin.
 */
export function poiTeaserNachId(pois: Poi[]): Map<string, string> {
  const teaser = new Map<string, string>();
  for (const poi of pois) {
    const erstes = poi.photos?.[0];
    if (erstes) teaser.set(poi.id, erstes.id);
  }
  return teaser;
}

/**
 * Die Kennung des Teaserbilds eines Programmpunkts (req-111). Null, wenn er
 * aus keinem POI stammt -- von Hand angelegt (req-018) -- oder sein POI kein
 * Foto hat. Null heisst: links im Block steht nichts, auch kein Platzhalter.
 */
export function activityTeaserFoto(
  activity: { poiId?: string },
  teaser: Map<string, string>,
): string | null {
  if (!activity.poiId) return null;
  return teaser.get(activity.poiId) ?? null;
}
