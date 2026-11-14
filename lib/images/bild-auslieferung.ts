import { createHash } from "node:crypto";
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

/**
 * Das Kennzeichen eines Inhalts fuer den Zwischenspeicher des Browsers
 * (req-105): ein Hash ueber die Bytes. Gleiche Bytes, gleiches Kennzeichen --
 * Original und Miniatur unterscheiden sich also von selbst.
 */
export function etagVon(data: Uint8Array): string {
  return `"${createHash("sha256").update(data).digest("base64url").slice(0, 32)}"`;
}

/**
 * Ob der Browser genau diesen Inhalt schon hat. `If-None-Match` darf mehrere
 * Kennzeichen tragen und schwache (`W/"…"`) -- Cloudflare macht aus einem
 * starken ein schwaches, sobald es die Antwort zusammendrueckt. Fuer ein
 * 304 genuegt der schwache Vergleich (RFC 9110, 13.1.2).
 */
export function browserHatSchon(
  ifNoneMatch: string | null,
  etag: string,
): boolean {
  if (!ifNoneMatch) return false;
  if (ifNoneMatch.trim() === "*") return true;
  const ohneSchwach = (wert: string) => wert.trim().replace(/^W\//, "");
  return ifNoneMatch
    .split(",")
    .some((kennzeichen) => ohneSchwach(kennzeichen) === ohneSchwach(etag));
}

/**
 * Die Antwort einer Bild-Route (req-105): mit `ETag`, und mit `304` ohne
 * Daten, wenn der Browser den Inhalt schon hat. Bis dahin lud jedes Bild
 * nach Ablauf des Tages aus `max-age` voll neu, statt bestaetigt zu werden.
 */
export function dateiAntwort(
  request: Request,
  data: Uint8Array,
  headers: Record<string, string>,
): Response {
  const etag = etagVon(data);
  if (browserHatSchon(request.headers.get("If-None-Match"), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        ...(headers["Cache-Control"]
          ? { "Cache-Control": headers["Cache-Control"] }
          : {}),
      },
    });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      ...headers,
      "Content-Length": String(data.byteLength),
      ETag: etag,
    },
  });
}
