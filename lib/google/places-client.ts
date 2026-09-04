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
  "location",
  "types",
  "websiteUri",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "regularOpeningHours.weekdayDescriptions",
  "photos.name",
].join(",");

interface GooglePlaceResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  websiteUri?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name?: string }>;
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

/** Die Aussenanbindung an Google Places, gebunden an einen Schluessel. */
export interface GooglePlacesClient {
  /** Loest einen Kurzlink auf und liefert die Zieladresse. */
  resolveShortLink(url: string): Promise<string | null>;
  /** Sucht die Kennung eines Ortes ueber seinen Namen. */
  findPlaceId(query: string, position?: PoiPosition): Promise<string | null>;
  /** Holt die Angaben zu einer Ortskennung. */
  placeDetails(placeId: string): Promise<GooglePlace | null>;
  /** Laedt ein Foto herunter. */
  fetchPhoto(photoName: string): Promise<Uint8Array | null>;
}

/**
 * Der Zugang zu Google Places, gebunden an den Zugangsschluessel des
 * Accounts, in dem gerade gearbeitet wird (req-028). Der Schluessel kommt
 * immer von aussen herein: es gibt keinen Rueckgriff auf eine
 * Umgebungsvariable und damit auch keinen Weg, auf Kosten eines anderen
 * Accounts abzufragen.
 *
 * Ohne hinterlegten Schluessel entsteht dieser Zugang gar nicht erst -- die
 * Funktion ist dann gesperrt (siehe app/api/poi-aus-link/route.ts).
 */
export function googlePlacesClient(apiKey: string): GooglePlacesClient {
  return {
    /**
     * Google antwortet auf einen Kurzlink (`maps.app.goo.gl`) mit einer
     * Weiterleitung auf den langen Maps-Link; gebraucht wird nur dessen
     * Adresse, nicht der Seiteninhalt. Ein Schluessel ist dafuer nicht
     * noetig.
     */
    async resolveShortLink(url: string): Promise<string | null> {
      try {
        const response = await fetch(url, { redirect: "follow" });
        return response.url || null;
      } catch {
        return null;
      }
    },

    /**
     * Sucht die Kennung eines Ortes ueber seinen Namen (siehe req-026): fuer
     * Links, die den Ort nur benennen statt ihn zu kennzeichnen. Die
     * Kartenmitte des Links schraenkt die Suche ein, damit gleichnamige Orte
     * anderswo nicht gewinnen.
     */
    async findPlaceId(
      query: string,
      position?: PoiPosition,
    ): Promise<string | null> {
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
            "X-Goog-Api-Key": apiKey,
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
    },

    /** Holt die Angaben zu einer Ortskennung (siehe req-026, "Uebernommen werden"). */
    async placeDetails(placeId: string): Promise<GooglePlace | null> {
      try {
        const response = await fetch(
          `${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}?languageCode=de`,
          {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": DETAIL_FIELDS,
            },
          },
        );
        if (!response.ok) return null;
        return toPlace((await response.json()) as GooglePlaceResponse);
      } catch {
        return null;
      }
    },

    /**
     * Laedt ein Foto herunter (siehe req-026: die Fotos werden gespeichert,
     * nicht bei jeder Anzeige neu geholt). Liefert null, wenn das Bild nicht
     * zu holen ist — dann entfaellt dieses eine Foto, nicht der ganze POI.
     */
    async fetchPhoto(photoName: string): Promise<Uint8Array | null> {
      try {
        const response = await fetch(
          `${PLACES_BASE_URL}/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&key=${encodeURIComponent(apiKey)}`,
          { redirect: "follow" },
        );
        if (!response.ok) return null;
        return new Uint8Array(await response.arrayBuffer());
      } catch {
        return null;
      }
    },
  };
}
