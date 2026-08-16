import { ACCOUNT_EMAIL } from "@/lib/account";

const BASE_URL = "https://nominatim.openstreetmap.org/search";

/** Hoechstens acht Vorschlaege (siehe req-017, GUI). */
export const MAX_PLACE_SUGGESTIONS = 8;

/** Kuerzere Eingaben liefern nur Rauschen und werden gar nicht erst gesucht. */
export const MIN_PLACE_QUERY_LENGTH = 3;

export interface PlaceSuggestion {
  name: string;
  /** Einordnende Angabe zum Namen: Region und Land. */
  context: string;
  lat: number;
  lng: number;
}

interface NominatimEntry {
  name?: string;
  display_name?: string;
  lat?: string | number;
  lon?: string | number;
  address?: Record<string, unknown>;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nameOf(entry: NominatimEntry): string | undefined {
  return text(entry.name) ?? text(entry.display_name)?.split(",")[0].trim();
}

function contextOf(entry: NominatimEntry): string {
  const address = entry.address ?? {};
  const region =
    text(address.state) ??
    text(address.county) ??
    text(address.state_district) ??
    text(address.region);
  const country = text(address.country);
  return [region, country].filter(Boolean).join(", ");
}

function toSuggestion(entry: NominatimEntry): PlaceSuggestion | null {
  const name = nameOf(entry);
  const lat = toNumber(entry.lat);
  const lng = toNumber(entry.lon);
  if (!name || lat === null || lng === null) return null;
  return { name, context: contextOf(entry), lat, lng };
}

/**
 * Sucht Orte nach Namen in den Ortsdaten von OpenStreetMap (siehe req-017):
 * der Hauptort einer Reise wird ueber diese Suche erfasst, Koordinaten
 * werden nie von Hand eingegeben. Nominatim verlangt einen identifizierenden
 * User-Agent (siehe Nominatim-Nutzungsbedingungen).
 *
 * Liefert eine leere Liste, wenn nichts passt oder der Dienst nicht
 * erreichbar ist — die Ortssuche ist nie ein harter Fehler.
 */
export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_PLACE_QUERY_LENGTH) return [];

  const url =
    `${BASE_URL}?format=jsonv2&addressdetails=1` +
    `&limit=${MAX_PLACE_SUGGESTIONS}&q=${encodeURIComponent(trimmed)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": `wegfara (${ACCOUNT_EMAIL})` },
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return [];
  }

  if (!Array.isArray(body)) return [];
  return (body as NominatimEntry[])
    .map(toSuggestion)
    .filter((place): place is PlaceSuggestion => place !== null)
    .slice(0, MAX_PLACE_SUGGESTIONS);
}
