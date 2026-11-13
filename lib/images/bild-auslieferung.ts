import { poiPhotoContentTypeOfFileName } from "@/lib/pois/photo-upload";
import { bildArtAmInhalt, MINIATUR_CONTENT_TYPE } from "./miniatur";
import type { PhotoStore } from "./photo-store";

/** Was eine Bild-Route herausgibt: die Bytes und ihre Art. */
export interface AuszuliefernesBild {
  data: Uint8Array;
  contentType: string;
}

/**
 * Liest ein Foto fuer die Auslieferung (req-105) -- die Miniatur, wenn sie
 * gewuenscht ist und schon da ist, sonst das Original. Eine fehlende
 * Miniatur ist kein Fehler: der nachtraegliche Lauf ist vielleicht noch
 * nicht durch, und ein langsames Bild ist besser als ein leeres.
 *
 * Fehlt das Original, liefert sie null -- ein Datensatz ohne Datei ist ein
 * Fehlerzustand und wird als 404 sichtbar (stack.md).
 *
 * Die Art kommt aus dem Inhalt, nicht aus der Endung: eine Datei `….jpg`
 * kann ein PNG sein. Nur was sich am Inhalt nicht erkennen laesst, faellt
 * auf die Endung zurueck.
 */
export async function liesFoto(
  store: PhotoStore,
  fileName: string,
  miniatur: boolean,
): Promise<AuszuliefernesBild | null> {
  if (miniatur) {
    const klein = await store.readMiniatur(fileName);
    if (klein) return { data: klein, contentType: MINIATUR_CONTENT_TYPE };
  }
  const data = await store.read(fileName);
  if (!data) return null;
  return {
    data,
    contentType:
      bildArtAmInhalt(data) ?? poiPhotoContentTypeOfFileName(fileName),
  };
}
