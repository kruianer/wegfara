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

/**
 * Warum eine Abfrage bei Google nichts geliefert hat (bug-026).
 *
 * "zugang_abgelehnt" ist ausdruecklich etwas anderes als "kein Treffer":
 * Google hat den Zugangsschluessel des Accounts zurueckgewiesen — daran ist
 * kein Link und kein Suchbegriff schuld, sondern der Schluessel selbst oder
 * seine Freigabe in der Google-Cloud-Console. Wer beides in denselben Topf
 * wirft, schickt den Nutzer auf die Suche nach einem Fehler, den er nicht hat.
 */
export type GoogleAbfrageFehler = "zugang_abgelehnt" | "abfrage_fehlgeschlagen";

/**
 * Was ein Nachschlagen bei Google liefert: den Treffer, ausdruecklich keinen
 * (`treffer: null`) — oder den Grund, warum gar nicht abgefragt werden
 * konnte. Kein Aufruf wirft eine Ausnahme; der Grund geht immer mit.
 */
export type GoogleAbfrage<T> =
  | { ok: true; treffer: T | null }
  | { ok: false; fehler: GoogleAbfrageFehler };

function gefunden<T>(treffer: T | null): GoogleAbfrage<T> {
  return { ok: true, treffer };
}

function gescheitert<T>(fehler: GoogleAbfrageFehler): GoogleAbfrage<T> {
  return { ok: false, fehler };
}

/**
 * Ob Google die Anfrage wegen des Schluessels abgewiesen hat: mit 403 oder
 * 401 — oder mit 400 und einem Rumpf, der den Schluessel benennt (so
 * antwortet die Places API auf einen ungueltigen Schluessel).
 */
async function fehlerAus(response: {
  status?: number;
  json: () => Promise<unknown>;
}): Promise<GoogleAbfrageFehler> {
  if (response.status === 401 || response.status === 403) {
    return "zugang_abgelehnt";
  }

  let grund = "";
  try {
    const body = (await response.json()) as {
      error?: { status?: string; message?: string };
    };
    grund = `${body?.error?.status ?? ""} ${body?.error?.message ?? ""}`;
  } catch {
    return "abfrage_fehlgeschlagen";
  }
  return /PERMISSION_DENIED|API[_ ]key/i.test(grund)
    ? "zugang_abgelehnt"
    : "abfrage_fehlgeschlagen";
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
  /**
   * Sucht einen Ort ueber seinen Namen und liefert gleich seine Angaben
   * (bug-026). Ein Aufruf statt zweier: die Kennung allein zu holen und die
   * Angaben danach kostete den Account ein zweites Mal Geld.
   */
  findPlace(
    query: string,
    position?: PoiPosition,
  ): Promise<GoogleAbfrage<GooglePlace>>;
  /**
   * Sucht einen Ort ueber seinen Namen innerhalb eines Rechtecks und liefert
   * gleich seine Angaben (req-057). Ein Aufruf statt zweier: die KI-Suche
   * schlaegt bis zu zwanzig Namen nach, und jeder zusaetzliche Aufruf
   * kostete den Account Geld.
   */
  findPlaceInArea(
    query: string,
    box: BoundingBox,
  ): Promise<GoogleAbfrage<GooglePlace>>;
  /** Holt die Angaben zu einer Ortskennung. */
  placeDetails(placeId: string): Promise<GoogleAbfrage<GooglePlace>>;
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
 * Funktion ist dann gesperrt (siehe app/api/ort-aus-link/route.ts).
 */
export function googlePlacesClient(apiKey: string): GooglePlacesClient {
  /**
   * Die Textsuche der Places API — der eine Aufruf, mit dem beide
   * Namenssuchen arbeiten. Er holt gleich die vollen Angaben des Treffers;
   * was den Suchraum einschraenkt, unterscheidet die beiden.
   */
  async function searchText(
    body: Record<string, unknown>,
  ): Promise<GoogleAbfrage<GooglePlace>> {
    try {
      const response = await fetch(`${PLACES_BASE_URL}/places:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": SEARCH_FIELDS,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) return gescheitert(await fehlerAus(response));

      const parsed = (await response.json()) as {
        places?: GooglePlaceResponse[];
      };
      const erster = parsed.places?.[0];
      return gefunden(erster ? toPlace(erster) : null);
    } catch {
      return gescheitert("abfrage_fehlgeschlagen");
    }
  }

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
     * Sucht einen Ort ueber seinen Namen (siehe req-026): fuer Links, die
     * den Ort nur benennen statt ihn zu kennzeichnen — und das sind die
     * meisten, denn hinter den Kurzlinks der App steht die Feature-Kennung
     * des Ortes und keine Place-ID (bug-026). Die Kartenmitte des Links
     * schraenkt die Suche ein, damit gleichnamige Orte anderswo nicht
     * gewinnen.
     *
     * Die Angaben kommen im selben Aufruf mit — der Umweg ueber die Kennung
     * und einen zweiten Aufruf kostete den Account doppelt.
     */
    async findPlace(
      query: string,
      position?: PoiPosition,
    ): Promise<GoogleAbfrage<GooglePlace>> {
      const body: Record<string, unknown> = {
        textQuery: query,
        languageCode: "de",
        maxResultCount: 1,
      };
      if (position) {
        body.locationBias = {
          circle: {
            center: { latitude: position.lat, longitude: position.lng },
            radius: 5000,
          },
        };
      }

      return searchText(body);
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
    ): Promise<GoogleAbfrage<GooglePlace>> {
      return searchText({
        textQuery: query,
        languageCode: "de",
        maxResultCount: 1,
        locationRestriction: {
          rectangle: {
            low: { latitude: box.minLat, longitude: box.minLng },
            high: { latitude: box.maxLat, longitude: box.maxLng },
          },
        },
      });
    },

    /** Holt die Angaben zu einer Ortskennung (siehe req-026, "Uebernommen werden"). */
    async placeDetails(placeId: string): Promise<GoogleAbfrage<GooglePlace>> {
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
        if (!response.ok) return gescheitert(await fehlerAus(response));
        return gefunden(
          toPlace((await response.json()) as GooglePlaceResponse),
        );
      } catch {
        return gescheitert("abfrage_fehlgeschlagen");
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
