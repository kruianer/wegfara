import type { GooglePlace } from "@/lib/google/types";
import { mapGoogleTypesToPoiType } from "@/lib/google/type-mapping";
import { poiTextsFromGoogle } from "@/lib/google/description";
import type { GoogleLinkFailure } from "./google-link-lookup";
import type { PoiPosition, PoiType } from "./types";

/**
 * Ein bei Google nachgeschlagener Ort, wie ihn das Suchfeld des POI-Formulars
 * uebernimmt (req-048). Anders als bis req-026 entsteht daraus nicht sofort
 * ein POI: gefuellt wird zunaechst nur das Formular, gespeichert wird es
 * danach von Hand.
 *
 * Die Textfelder sind leer, wenn Google die Angabe nicht kennt — was eine
 * Quelle nicht kennt, kann nicht gefuellt werden.
 */
export interface GoogleOrt {
  /** Die Kennung des Ortes bei Google — sie erkennt denselben Ort wieder. */
  placeId: string;
  name: string;
  type: PoiType;
  position: PoiPosition;
  address: string;
  web: string;
  phone: string;
  /** Eine Zeile je Wochentag, wie im Formular. */
  openingHours: string;
  shortText: string;
  longText: string;
  /** Die Bewertung bei Google und die Zahl dahinter (req-057); null heisst "keine". */
  bewertung: number | null;
  bewertungAnzahl: number | null;
  /**
   * Die Kennungen der Fotos bei Google. Geholt werden sie erst beim
   * Speichern — vorher gibt es keinen POI, zu dem sie gehoeren koennten.
   */
  photoNames: string[];
}

export type GoogleOrtLookup =
  | { result: "gefunden"; ort: GoogleOrt }
  | { result: "fehler"; reason: GoogleLinkFailure };

/**
 * Was beim Speichern ueber die Herkunft aus Google mitgeht (req-048): die
 * Kennung des Ortes, seine Bewertung und seine Fotos. Ohne sie waere ein
 * ueber das Formular angelegter POI kein Ort bei Google mehr — sein
 * Auffrischen aus demselben Link fiele damit aus (req-035).
 */
export interface PoiGoogleQuelle {
  placeId: string;
  bewertung: number | null;
  bewertungAnzahl: number | null;
  photoNames: string[];
}

/** Was die Meldung am Suchfeld bei einem Fehlschlag nennt (req-048, GUI). */
export const GOOGLE_LINK_FAILURE_TEXT: Record<GoogleLinkFailure, string> = {
  kein_google_link: "Das ist kein Google-Maps-Link.",
  ort_nicht_gefunden: "Zu diesem Link ließ sich kein Ort finden.",
  abfrage_fehlgeschlagen: "Die Abfrage bei Google ist fehlgeschlagen.",
};

/** Die Angaben eines Google-Ortes als Formularwerte (req-048). */
export function googleOrtAusPlace(place: GooglePlace): GoogleOrt {
  const texte = poiTextsFromGoogle(place.description);
  return {
    placeId: place.placeId,
    name: place.name,
    type: mapGoogleTypesToPoiType(place.types),
    position: place.position,
    address: place.address ?? "",
    web: place.web ?? "",
    phone: place.phone ?? "",
    openingHours: (place.openingHours ?? []).join("\n"),
    shortText: texte.shortText ?? "",
    longText: texte.longText ?? "",
    bewertung: place.rating ?? null,
    bewertungAnzahl: place.ratingCount ?? null,
    photoNames: place.photoNames,
  };
}

/** Was von einem gefuellten Ort beim Speichern mitgeschickt wird. */
export function googleQuelleVonOrt(ort: GoogleOrt): PoiGoogleQuelle {
  return {
    placeId: ort.placeId,
    bewertung: ort.bewertung,
    bewertungAnzahl: ort.bewertungAnzahl,
    photoNames: ort.photoNames,
  };
}

/**
 * Schlaegt den Ort hinter einem eingefuegten Google-Maps-Link nach (req-048).
 * Es entsteht dabei kein POI — geliefert werden die Angaben, mit denen das
 * Formular sich fuellt.
 *
 * Ein Fehlschlag der Uebertragung selbst wird wie eine fehlgeschlagene
 * Abfrage behandelt: die uebrigen Felder bleiben in beiden Faellen stehen.
 */
export async function ortAusGoogleLink(link: string): Promise<GoogleOrtLookup> {
  const fehlschlag: GoogleOrtLookup = {
    result: "fehler",
    reason: "abfrage_fehlgeschlagen",
  };

  let response: Response;
  try {
    response = await fetch("/api/ort-aus-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link }),
    });
  } catch {
    return fehlschlag;
  }

  if (!response.ok) return fehlschlag;

  try {
    return (await response.json()) as GoogleOrtLookup;
  } catch {
    return fehlschlag;
  }
}
