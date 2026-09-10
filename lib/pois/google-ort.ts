import type { GooglePlace } from "@/lib/google/types";
import { mapGoogleTypesToPoiType } from "@/lib/google/type-mapping";
import { poiTextsFromGoogle } from "@/lib/google/description";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import {
  istGoogleLinkFailure,
  type GoogleLinkFailure,
} from "./google-link-lookup";
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

/**
 * Was die Meldung am Suchfeld bei einem Fehlschlag nennt (req-048, GUI).
 *
 * Jeder Grund bekommt seinen eigenen Satz: Wer am Schlüssel etwas ändern
 * muss, darf nicht lesen, sein Link sei schuld (bug-026).
 */
export const GOOGLE_LINK_FAILURE_TEXT: Record<GoogleLinkFailure, string> = {
  kein_google_link: "Das ist kein Google-Maps-Link.",
  ort_nicht_gefunden: "Zu diesem Link ließ sich kein Ort finden.",
  zugang_abgelehnt:
    "Google hat den Zugangsschlüssel abgewiesen — am Link liegt es nicht. " +
    "Er muss in der Google-Cloud-Console für die Places API (New) " +
    "freigegeben sein; hinterlegt wird er in „Mein Bereich“.",
  kein_zugangsschluessel: apiKeyMissingHint("google"),
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

function fehlschlag(reason: GoogleLinkFailure): GoogleOrtLookup {
  return { result: "fehler", reason };
}

/** Ob die Antwort wirklich einen Ort traegt, mit dem das Formular etwas anfangen kann. */
function istGoogleOrt(wert: unknown): wert is GoogleOrt {
  const ort = wert as GoogleOrt | null;
  return (
    typeof ort === "object" &&
    ort !== null &&
    typeof ort.name === "string" &&
    typeof ort.position === "object" &&
    ort.position !== null &&
    typeof ort.position.lat === "number" &&
    typeof ort.position.lng === "number"
  );
}

/**
 * Was die Schnittstelle geantwortet hat -- oder ein Fehlschlag, wenn ihre
 * Antwort nicht die erwartete Form hat (bug-026). Alles, was hier ungeprueft
 * durchginge, faende das Formular spaeter beim Fuellen: es liefe auf einen
 * Fehler und liesse das Feld genau dann still, wenn es etwas zu sagen haette.
 */
function lookupAusAntwort(body: unknown): GoogleOrtLookup {
  const antwort = body as { result?: unknown; ort?: unknown; reason?: unknown };
  if (antwort?.result === "gefunden" && istGoogleOrt(antwort.ort)) {
    return { result: "gefunden", ort: antwort.ort };
  }
  if (antwort?.result === "fehler" && istGoogleLinkFailure(antwort.reason)) {
    return fehlschlag(antwort.reason);
  }
  return fehlschlag("abfrage_fehlgeschlagen");
}

/**
 * Schlaegt den Ort hinter einem eingefuegten Google-Maps-Link nach (req-048).
 * Es entsteht dabei kein POI — geliefert werden die Angaben, mit denen das
 * Formular sich fuellt.
 *
 * Liefert immer ein Ergebnis, nie eine Ausnahme, und nennt in jedem Fall
 * einen Grund: das Suchfeld sagt daraufhin, woran es lag — still bleiben
 * darf es nie (bug-021, bug-026).
 */
export async function ortAusGoogleLink(link: string): Promise<GoogleOrtLookup> {
  let response: Response;
  try {
    response = await fetch("/api/ort-aus-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link }),
    });
  } catch {
    return fehlschlag("abfrage_fehlgeschlagen");
  }

  if (!response.ok) {
    // 409 heisst: dieser Account hat gar keinen Zugangsschluessel hinterlegt
    // (req-028) -- etwas anderes als eine gescheiterte Abfrage.
    return fehlschlag(
      response.status === 409
        ? "kein_zugangsschluessel"
        : "abfrage_fehlgeschlagen",
    );
  }

  try {
    return lookupAusAntwort(await response.json());
  } catch {
    return fehlschlag("abfrage_fehlgeschlagen");
  }
}
