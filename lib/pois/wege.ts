import type { Poi } from "./types";
import { poiMapsUrl } from "./maps-link";

/**
 * Die zwei Wege einer Zeile der POI-Liste (req-097): die Webseite und die
 * Karte. Einen eigenen Google-Suchlink gibt es nicht mehr.
 *
 * Fehlt die Webseite, fuehrt dasselbe Symbol zur Google-Suche -- sichtbar
 * als Suche (`istSuche`), nicht wie bis dahin still unter dem Namen
 * "Website". Die Stelle bleibt dieselbe, damit die Symbole von Zeile zu
 * Zeile nicht springen.
 */
export function poiWege(
  poi: Pick<Poi, "name" | "ort" | "web" | "position" | "googlePlaceId">,
): {
  webseite: { url: string; istSuche: boolean };
  karte: string;
} {
  const web = poi.web?.trim() ?? "";
  return {
    webseite:
      web.length > 0
        ? { url: web, istSuche: false }
        : { url: googleSuche(poi), istSuche: true },
    karte: poiMapsUrl(poi),
  };
}

/**
 * Die Google-Suche nach dem Ort. Ohne abgeleiteten Ort sucht der Name allein
 * (req-041).
 */
function googleSuche(poi: Pick<Poi, "name" | "ort">): string {
  const bezeichnung = [poi.name, poi.ort.trim()]
    .filter((teil) => teil.length > 0)
    .join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(
    `${bezeichnung} offizielle website`,
  )}`;
}
