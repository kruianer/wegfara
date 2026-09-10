import type { PoiPosition } from "./types";

/**
 * Was sich aus einem Google-Maps-Link ueber den gemeinten Ort ablesen
 * laesst (siehe req-026). Ein Link nennt entweder die Kennung des Ortes
 * direkt, oder nur seinen Namen (dann wird er nachgeschlagen), oder er ist
 * ein Kurzlink, hinter dem erst einer der beiden Faelle steckt.
 */
export type GoogleLinkTarget =
  | { kind: "placeId"; placeId: string }
  | { kind: "query"; query: string; position?: PoiPosition }
  | { kind: "shortLink"; url: string };

/**
 * Ob im Text ueberhaupt eine Webadresse steckt (req-048). Das Suchfeld des
 * POI-Formulars unterscheidet damit einen Suchbegriff von einem eingefuegten
 * Link, der kein Google-Maps-Link ist -- danach zu suchen waere sinnlos.
 */
export function enthaeltWebadresse(input: string): boolean {
  return /https?:\/\/\S/i.test(input);
}

/** Kurzlink-Hosts von Google Maps ("Teilen" in der App). */
const SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl", "g.co"];

function firstUrl(input: string): URL | null {
  const match = input.match(/https?:\/\/[^\s<>"']+/);
  if (!match) return null;
  try {
    return new URL(match[0]);
  } catch {
    return null;
  }
}

/** google.de, google.com, google.co.uk, maps.google.at, ... */
function isGoogleHost(host: string): boolean {
  return /^(?:[a-z0-9-]+\.)*google(?:\.[a-z]{2,3})+$/.test(host);
}

function isMapsUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (!isGoogleHost(host)) return false;
  return host.startsWith("maps.") || url.pathname.startsWith("/maps");
}

/** `@40.649,14.611,17z` im Pfad — die Kartenmitte des Links. */
function positionFromPath(pathname: string): PoiPosition | undefined {
  const match = pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function positionFromParams(params: URLSearchParams): PoiPosition | undefined {
  const raw = params.get("center") ?? params.get("ll");
  if (!raw) return undefined;
  const match = raw.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment.replace(/\+/g, " ")).trim();
  } catch {
    return segment.replace(/\+/g, " ").trim();
  }
}

/**
 * Die Feature-Kennung eines Ortes in Hex-Form (`0x…:0x…`, die zweite Haelfte
 * ist seine CID). Genau sie steht im `data`-Teil hinter den Kurzlinks aus der
 * App — und sie ist keine Place-ID: die Places API (New) nimmt allein
 * Kennungen in `ChIJ…`-Form an, und einen offiziellen Weg von der einen in
 * die andere gibt es nicht (bug-026).
 *
 * Zu so einem Link wird deshalb bewusst der Name nachgeschlagen. Das ist
 * kein Notbehelf nach einem nicht passenden Muster, sondern der einzige
 * Weg, den Google dafuer anbietet.
 */
const FEATURE_KENNUNG = /^0x[0-9a-f]+(?::|%3A)0x[0-9a-f]+$/i;

/** Eine Place-ID, wie die Places API sie annimmt. */
const PLACE_ID = /^ChIJ[\w-]+$/;

export function istFeatureKennung(wert: string): boolean {
  return FEATURE_KENNUNG.test(wert);
}

/**
 * Die Kennung des Ortes, soweit der Link sie mitfuehrt: als eigener
 * Parameter, als `q=place_id:...` oder eingebettet im `data`-Teil der
 * langen Links aus dem Browser.
 *
 * Liefert null, wenn der Link den Ort nur ueber seine Feature-Kennung
 * benennt — dann ist die Namenssuche der Weg (siehe FEATURE_KENNUNG).
 */
function placeIdOf(url: URL): string | null {
  const params = url.searchParams;
  const direct = params.get("query_place_id") ?? params.get("place_id");
  if (direct) return direct;

  const q = params.get("q") ?? "";
  if (q.startsWith("place_id:")) return q.slice("place_id:".length);

  // Ein langer Link fuehrt mehrere `!1s`-Teile: die Feature-Kennung und --
  // je nach Herkunft -- die Place-ID. Gesucht ist die Place-ID.
  for (const teil of url.href.match(/!1s[^!/?&]+/g) ?? []) {
    const wert = teil.slice("!1s".length);
    if (istFeatureKennung(wert)) continue;
    if (PLACE_ID.test(wert)) return wert;
  }
  return null;
}

/** Der Ortsname aus `/maps/place/<Name>/...` oder `/maps/search/<Text>`. */
function queryOf(url: URL): string {
  const params = url.searchParams;
  const direct = params.get("query") ?? params.get("q");
  if (direct && !direct.startsWith("place_id:")) return decodeSegment(direct);

  const segments = url.pathname.split("/").filter(Boolean);
  const marker = segments.findIndex((s) => s === "place" || s === "search");
  if (marker >= 0 && segments[marker + 1]) {
    const name = decodeSegment(segments[marker + 1]);
    // `/maps/place/40.65,14.61` ist kein Name, sondern eine Koordinate.
    if (!/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(name) && !name.startsWith("@")) {
      return name;
    }
  }
  return "";
}

/**
 * Liest aus eingefuegtem Text den gemeinten Ort (siehe req-026). Der Text
 * darf mehr als den Link enthalten — beim Teilen aus der App steht davor
 * meist noch der Name des Ortes.
 *
 * Liefert null, wenn darin gar kein Google-Maps-Link steckt.
 */
export function parseGoogleMapsLink(input: string): GoogleLinkTarget | null {
  const url = firstUrl(input);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  if (SHORT_LINK_HOSTS.includes(host)) {
    return { kind: "shortLink", url: url.href };
  }
  if (!isMapsUrl(url)) return null;

  const placeId = placeIdOf(url);
  if (placeId) return { kind: "placeId", placeId };

  return {
    kind: "query",
    query: queryOf(url),
    position:
      positionFromPath(url.pathname) ?? positionFromParams(url.searchParams),
  };
}
