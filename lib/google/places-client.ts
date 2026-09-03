import type { PoiPosition } from "@/lib/pois/types";
import type { GooglePlace } from "./types";

const PLACES_BASE_URL = "https://places.googleapis.com/v1";

/** Hoechstens drei Fotos je Ort (siehe req-026). */
export const MAX_PHOTOS = 3;

/** Breite der abgeholten Fotos in Bildpunkten — Listenbild, kein Poster. */
const PHOTO_MAX_WIDTH_PX = 1200;

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "types",
  "websiteUri",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "regularOpeningHours.weekdayDescriptions",
  "photos.name",
].join(",");

/**
 * Der Zugangsschluessel liegt ausschliesslich in den Umgebungsvariablen
 * (siehe req-026, Constraints, und stack.md). Fehlt er, findet keine
 * Abfrage statt — die Oberflaeche meldet dann einen Fehlschlag.
 */
function apiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  return key && key.length > 0 ? key : null;
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlaceResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name?: string }>;
}

/**
 * Der Ort im Sinne des POI: die Gemeinde, in der der Ort liegt. Google
 * liefert sie als Bestandteil der Adresse; fehlt sie, bleibt das Feld leer
 * (es ist in der Datenbank nicht nullbar, wohl aber leer erlaubt).
 */
function ortOf(components: GoogleAddressComponent[]): string {
  const bevorzugt = [
    "locality",
    "postal_town",
    "administrative_area_level_3",
    "administrative_area_level_2",
  ];
  for (const typ of bevorzugt) {
    const treffer = components.find((c) => c.types?.includes(typ));
    if (treffer?.longText) return treffer.longText;
  }
  return "";
}

function toPlace(body: GooglePlaceResponse): GooglePlace | null {
  const placeId = body.id;
  const name = body.displayName?.text;
  const lat = body.location?.latitude;
  const lng = body.location?.longitude;
  if (!placeId || !name || typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const openingHours = body.regularOpeningHours?.weekdayDescriptions;

  return {
    placeId,
    name,
    ort: ortOf(body.addressComponents ?? []),
    address: body.formattedAddress,
    position: { lat, lng },
    types: body.types ?? [],
    web: body.websiteUri,
    phone: body.internationalPhoneNumber ?? body.nationalPhoneNumber,
    openingHours:
      openingHours && openingHours.length > 0 ? openingHours : undefined,
    photoNames: (body.photos ?? [])
      .map((p) => p.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0)
      .slice(0, MAX_PHOTOS),
  };
}

/**
 * Loest einen Kurzlink (`maps.app.goo.gl`) auf. Google antwortet mit einer
 * Weiterleitung auf den langen Maps-Link; gebraucht wird nur dessen
 * Adresse, nicht der Seiteninhalt.
 */
export async function resolveShortLink(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    return response.url || null;
  } catch {
    return null;
  }
}

/**
 * Sucht die Kennung eines Ortes ueber seinen Namen (siehe req-026): fuer
 * Links, die den Ort nur benennen statt ihn zu kennzeichnen. Die
 * Kartenmitte des Links schraenkt die Suche ein, damit gleichnamige Orte
 * anderswo nicht gewinnen.
 */
export async function findGooglePlaceId(
  query: string,
  position?: PoiPosition,
): Promise<string | null> {
  const key = apiKey();
  if (!key) return null;

  const body: Record<string, unknown> = {
    textQuery: query,
    languageCode: "de",
  };
  if (position) {
    body.locationBias = {
      circle: {
        center: { latitude: position.lat, longitude: position.lng },
        radius: 5000,
      },
    };
  }

  try {
    const response = await fetch(`${PLACES_BASE_URL}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const parsed = (await response.json()) as {
      places?: Array<{ id?: string }>;
    };
    return parsed.places?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Holt die Angaben zu einer Ortskennung (siehe req-026, "Uebernommen werden"). */
export async function fetchGooglePlaceDetails(
  placeId: string,
): Promise<GooglePlace | null> {
  const key = apiKey();
  if (!key) return null;

  try {
    const response = await fetch(
      `${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}?languageCode=de`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": DETAIL_FIELDS,
        },
      },
    );
    if (!response.ok) return null;
    return toPlace((await response.json()) as GooglePlaceResponse);
  } catch {
    return null;
  }
}

/**
 * Laedt ein Foto herunter (siehe req-026: die Fotos werden gespeichert,
 * nicht bei jeder Anzeige neu geholt). Liefert null, wenn das Bild nicht
 * zu holen ist — dann entfaellt dieses eine Foto, nicht der ganze POI.
 */
export async function fetchGooglePhoto(
  photoName: string,
): Promise<Uint8Array | null> {
  const key = apiKey();
  if (!key) return null;

  try {
    const response = await fetch(
      `${PLACES_BASE_URL}/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&key=${encodeURIComponent(key)}`,
      { redirect: "follow" },
    );
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}
