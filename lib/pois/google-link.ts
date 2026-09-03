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
 * Die Kennung des Ortes, soweit der Link sie mitfuehrt: als eigener
 * Parameter, als `q=place_id:...` oder eingebettet im `data`-Teil der
 * langen Links aus dem Browser.
 */
function placeIdOf(url: URL): string | null {
  const params = url.searchParams;
  const direct = params.get("query_place_id") ?? params.get("place_id");
  if (direct) return direct;

  const q = params.get("q") ?? "";
  if (q.startsWith("place_id:")) return q.slice("place_id:".length);

  const embedded = url.href.match(/!1s(ChIJ[\w-]+)/);
  return embedded ? embedded[1] : null;
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
