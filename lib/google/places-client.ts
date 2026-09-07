import type { PoiPosition } from "@/lib/pois/types";
import type { BoundingBox } from "@/lib/pois/search-area";
import { googleLocalityOf, type GoogleAddressComponent } from "./locality";
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
  // Der beschreibende Text zum Ort -- daraus entstehen Kurz- und Langtext
  // des POI (req-044).
  "editorialSummary",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "regularOpeningHours.weekdayDescriptions",
  "photos.name",
  // Die Bewertung und die Zahl dahinter -- an ihr entscheidet sich, ob ein
  // Vorschlag die Mindestbewertung der Reise erreicht (req-057).
  "rating",
  "userRatingCount",
  // Die Ortschaft der KI-Suche kommt aus diesen Bestandteilen (req-057);
  // fuer alle uebrigen POIs bleibt OpenStreetMap die Quelle (req-041).
  "addressComponents",
].join(",");

interface GooglePlaceResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  websiteUri?: string;
  editorialSummary?: { text?: string };
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: Array<{ name?: string }>;
  rating?: number;
  userRatingCount?: number;
  addressComponents?: GoogleAddressComponent[];
}

/** Dieselben Felder, wie sie die Textsuche in ihrer Antwort benennt. */
const SEARCH_FIELDS = DETAIL_FIELDS.split(",")
  .map((feld) => `places.${feld}`)
  .join(",");

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
    description: body.editorialSummary?.text,
    phone: body.internationalPhoneNumber ?? body.nationalPhoneNumber,
    openingHours:
      openingHours && openingHours.length > 0 ? openingHours : undefined,
    // Ein noch nicht bewerteter Ort hat keine Bewertung -- das ist etwas
    // anderes als die Bewertung 0 und bleibt deshalb offen (req-057).
    rating: typeof body.rating === "number" ? body.rating : undefined,
    ratingCount:
      typeof body.userRatingCount === "number"
        ? body.userRatingCount
        : undefined,
    ort: googleLocalityOf(body.addressComponents) || undefined,
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
  /**
   * Sucht einen Ort ueber seinen Namen innerhalb eines Rechtecks und liefert
   * gleich seine Angaben (req-057). Ein Aufruf statt zweier: die KI-Suche
   * schlaegt bis zu zwanzig Namen nach, und jeder zusaetzliche Aufruf
   * kostete den Account Geld.
   */
  findPlaceInArea(query: string, box: BoundingBox): Promise<GooglePlace | null>;
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

    /**
     * Sucht einen von der KI vorgeschlagenen Ort innerhalb des Suchgebiets
     * (req-057). Das Rechteck um das gezeichnete Gebiet schraenkt die Suche
     * hart ein (`locationRestriction`, nicht `locationBias`) -- ein
     * gleichnamiger Ort anderswo darf gar nicht erst gewinnen; ob der
     * Treffer wirklich in der gezeichneten Flaeche liegt, prueft danach
     * `lib/pois/ai-search.ts`.
     */
    async findPlaceInArea(
      query: string,
      box: BoundingBox,
    ): Promise<GooglePlace | null> {
      try {
        const response = await fetch(`${PLACES_BASE_URL}/places:searchText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": SEARCH_FIELDS,
          },
          body: JSON.stringify({
            textQuery: query,
            languageCode: "de",
            maxResultCount: 1,
            locationRestriction: {
              rectangle: {
                low: { latitude: box.minLat, longitude: box.minLng },
                high: { latitude: box.maxLat, longitude: box.maxLng },
              },
            },
          }),
        });
        if (!response.ok) return null;
        const parsed = (await response.json()) as {
          places?: GooglePlaceResponse[];
        };
        const erster = parsed.places?.[0];
        return erster ? toPlace(erster) : null;
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
