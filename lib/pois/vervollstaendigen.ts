import { apiKeyMissingHint } from "@/lib/api-keys/types";
import type { Fuellung } from "./formular-fuellen";
import {
  MANUAL_POI_FIELDS,
  parseManualFields,
  type ManualPoiField,
} from "./manual-fields";
import {
  istGoogleFotoProblem,
  type GoogleFotoProblem,
} from "./google-foto-problem";
import type { PoiInput } from "./validate";
import type { Poi } from "./types";

/**
 * „Aus Google vervollstaendigen" (req-061): Der geoeffnete POI wird bei
 * Google nachgeschlagen, und gefuellt wird nur, was noch leer ist — was ich
 * selbst geschrieben habe, bleibt unangetastet.
 *
 * Der Abruf kostet je Aufruf ueber den Zugangsschluessel des Accounts
 * (req-028), deshalb geschieht er nur auf Knopfdruck.
 */

/**
 * Warum nichts vervollstaendigt wurde. Jeder Grund traegt seinen eigenen
 * Namen: ein abgewiesener Zugangsschluessel ist kein "nicht gefunden"
 * (bug-026). Still bleiben darf die Oberflaeche ueber keinen davon
 * (bug-021).
 */
export const VERVOLLSTAENDIGEN_FEHLER = [
  "ort_nicht_gefunden",
  "zugang_abgelehnt",
  "kein_zugangsschluessel",
  "abfrage_fehlgeschlagen",
] as const;

export type VervollstaendigenFehler = (typeof VERVOLLSTAENDIGEN_FEHLER)[number];

export function istVervollstaendigenFehler(
  wert: unknown,
): wert is VervollstaendigenFehler {
  return VERVOLLSTAENDIGEN_FEHLER.includes(wert as VervollstaendigenFehler);
}

/** Was das Formular bei einem Fehlschlag nennt — jeder Grund sein eigener Satz. */
export const VERVOLLSTAENDIGEN_FEHLER_TEXT: Record<
  VervollstaendigenFehler,
  string
> = {
  ort_nicht_gefunden:
    "Google kennt diesen Ort nicht — es wurde nichts geändert.",
  zugang_abgelehnt:
    "Google hat den Zugangsschlüssel abgewiesen — am Ort liegt es nicht. " +
    "Er muss in der Google-Cloud-Console für die Places API (New) " +
    "freigegeben sein; hinterlegt wird er in „Mein Bereich“.",
  kein_zugangsschluessel: apiKeyMissingHint("google"),
  abfrage_fehlgeschlagen:
    "Die Abfrage bei Google ist fehlgeschlagen — es wurde nichts geändert.",
};

/**
 * Was ein Vervollstaendigen ergeben hat: der gespeicherte POI und die
 * Angaben, die dabei gefuellt wurden — oder der Grund, warum nichts
 * geschah. Im Fehlerfall bleibt der POI, wie er war.
 */
export type VervollstaendigenErgebnis =
  | {
      result: "gefunden";
      poi: Poi;
      gefuellt: ManualPoiField[];
      /** Was mit den Bildern aus Google schiefging (bug-027); null heisst "nichts". */
      fotoProblem: GoogleFotoProblem | null;
    }
  | { result: "fehler"; reason: VervollstaendigenFehler };

/** Ob eine Angabe leer ist — nur eine leere darf aus Google gefuellt werden. */
function istLeer(wert: unknown): boolean {
  if (wert === null || wert === undefined) return true;
  return typeof wert === "string" ? wert.trim().length === 0 : false;
}

/**
 * Von dem, was eine Quelle kennt, bleibt nur, was im Formularstand noch leer
 * ist (req-061). Alles Uebrige bleibt stehen — auch dann, wenn Google es
 * anders fuehrt: was ich selbst geschrieben habe, gehoert mir.
 *
 * Typ, Status und Buchungsstatus sind nie leer und werden deshalb nie
 * gefuellt; dasselbe gilt fuer die Position eines gespeicherten POI.
 */
export function nurLeereFelder(
  aktuell: PoiInput,
  fuellung: Fuellung,
): Fuellung {
  const ergaenzung: Fuellung = {};
  for (const feld of Object.keys(fuellung) as (keyof PoiInput)[]) {
    if (!istLeer(aktuell[feld])) continue;
    if (istLeer(fuellung[feld])) continue;
    Object.assign(ergaenzung, { [feld]: fuellung[feld] });
  }
  return ergaenzung;
}

/**
 * Die genannten Angaben eines Formularstands als Fuellung — damit das
 * Formular genau das uebernimmt, was serverseitig gefuellt wurde, und nicht
 * den ganzen gespeicherten Stand.
 */
export function felderAlsFuellung(
  stand: PoiInput,
  felder: readonly ManualPoiField[],
): Fuellung {
  const fuellung: Fuellung = {};
  for (const feld of MANUAL_POI_FIELDS) {
    if (felder.includes(feld)) {
      Object.assign(fuellung, { [feld]: stand[feld] });
    }
  }
  return fuellung;
}

function fehlschlag(
  reason: VervollstaendigenFehler,
): VervollstaendigenErgebnis {
  return { result: "fehler", reason };
}

/** Ob die Antwort wirklich einen gespeicherten POI traegt. */
function istPoi(wert: unknown): wert is Poi {
  const poi = wert as Poi | null;
  return typeof poi === "object" && poi !== null && typeof poi.id === "string";
}

/**
 * Was die Schnittstelle geantwortet hat -- oder ein Fehlschlag, wenn ihre
 * Antwort nicht die erwartete Form hat. Was hier ungeprueft durchginge,
 * liesse das Formular spaeter still stehen, genau wenn es etwas zu sagen
 * haette (bug-021, bug-026).
 */
function ergebnisAusAntwort(body: unknown): VervollstaendigenErgebnis {
  const antwort = body as {
    result?: unknown;
    poi?: unknown;
    gefuellt?: unknown;
    fotoProblem?: unknown;
    reason?: unknown;
  };
  if (antwort?.result === "gefunden" && istPoi(antwort.poi)) {
    const roh = Array.isArray(antwort.gefuellt) ? antwort.gefuellt : [];
    return {
      result: "gefunden",
      poi: antwort.poi,
      // Dieselbe Lesart wie bei der Spalte selbst: Unbekanntes faellt weg.
      gefuellt: parseManualFields(roh.map(String).join(",")),
      fotoProblem: istGoogleFotoProblem(antwort.fotoProblem)
        ? antwort.fotoProblem
        : null,
    };
  }
  if (
    antwort?.result === "fehler" &&
    istVervollstaendigenFehler(antwort.reason)
  ) {
    return fehlschlag(antwort.reason);
  }
  return fehlschlag("abfrage_fehlgeschlagen");
}

/**
 * Vervollstaendigt einen gespeicherten POI aus Google (req-061). Liefert
 * immer ein Ergebnis, nie eine Ausnahme, und nennt in jedem Fall einen
 * Grund — das Formular sagt daraufhin, woran es lag.
 */
export async function vervollstaendigeAusGoogle(
  poiId: string,
): Promise<VervollstaendigenErgebnis> {
  let response: Response;
  try {
    response = await fetch("/api/poi-vervollstaendigen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poiId }),
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
    return ergebnisAusAntwort(await response.json());
  } catch {
    return fehlschlag("abfrage_fehlgeschlagen");
  }
}
