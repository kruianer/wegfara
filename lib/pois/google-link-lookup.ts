import type { GoogleAbfrage } from "@/lib/google/places-client";
import type { GooglePlace } from "@/lib/google/types";
import { parseGoogleMapsLink, type GoogleLinkTarget } from "./google-link";
import type { PoiPosition } from "./types";

/**
 * Warum aus einem eingefuegten Text kein POI wurde (siehe req-026). Jeder
 * Grund steht fuer etwas anderes und traegt deshalb einen eigenen Namen --
 * ein abgewiesener Zugangsschluessel ist kein "nicht gefunden" (bug-026).
 *
 * "kein_zugangsschluessel" entsteht nicht beim Nachschlagen selbst, sondern
 * an der Schnittstelle davor: der Account hat gar keinen hinterlegt
 * (req-028).
 */
export const GOOGLE_LINK_FAILURES = [
  "kein_google_link",
  "ort_nicht_gefunden",
  "zugang_abgelehnt",
  "kein_zugangsschluessel",
  "abfrage_fehlgeschlagen",
] as const;

export type GoogleLinkFailure = (typeof GOOGLE_LINK_FAILURES)[number];

export function istGoogleLinkFailure(wert: unknown): wert is GoogleLinkFailure {
  return GOOGLE_LINK_FAILURES.includes(wert as GoogleLinkFailure);
}

export type GoogleLinkLookup =
  | { ok: true; place: GooglePlace }
  | { ok: false; reason: GoogleLinkFailure };

/** Die drei austauschbaren Aussenanbindungen des Nachschlagens (req-026). */
export interface GoogleLinkDeps {
  /** Loest einen Kurzlink auf und liefert die Zieladresse. */
  resolveShortLink: (url: string) => Promise<string | null>;
  /**
   * Sucht einen Ort ueber seinen Namen und liefert gleich seine Angaben --
   * ein Aufruf, nicht zwei (bug-026).
   */
  findPlace: (
    query: string,
    position?: PoiPosition,
  ) => Promise<GoogleAbfrage<GooglePlace>>;
  /** Holt die Angaben zu einer Kennung. */
  placeDetails: (placeId: string) => Promise<GoogleAbfrage<GooglePlace>>;
}

/** Aus der Antwort von Google wird der Ort -- oder der Grund dagegen. */
function ausAbfrage(abfrage: GoogleAbfrage<GooglePlace>): GoogleLinkLookup {
  if (!abfrage.ok) return { ok: false, reason: abfrage.fehler };
  return abfrage.treffer
    ? { ok: true, place: abfrage.treffer }
    : { ok: false, reason: "ort_nicht_gefunden" };
}

async function lookupTarget(
  target: GoogleLinkTarget,
  deps: GoogleLinkDeps,
): Promise<GoogleLinkLookup> {
  if (target.kind === "shortLink") {
    return { ok: false, reason: "abfrage_fehlgeschlagen" };
  }

  if (target.kind === "placeId") {
    return ausAbfrage(await deps.placeDetails(target.placeId));
  }

  // Ohne Namen gibt es nichts nachzuschlagen -- eine Suche nach "" faende
  // irgendetwas und kostete den Account Geld dafuer.
  if (target.query.length === 0) {
    return { ok: false, reason: "ort_nicht_gefunden" };
  }
  return ausAbfrage(await deps.findPlace(target.query, target.position));
}

/**
 * Schlaegt den in einem eingefuegten Text gemeinten Ort bei Google nach
 * (siehe req-026). Ein Kurzlink wird zuvor einmal aufgeloest; was dahinter
 * steckt, ist wieder ein gewoehnlicher Maps-Link.
 *
 * Liefert nie eine Ausnahme, sondern immer entweder den Ort oder den Grund
 * des Fehlschlags — die Oberflaeche nennt ihn in ihrer Ergebniszeile.
 */
export async function lookupPlaceFromGoogleLink(
  input: string,
  deps: GoogleLinkDeps,
): Promise<GoogleLinkLookup> {
  const target = parseGoogleMapsLink(input);
  if (!target) return { ok: false, reason: "kein_google_link" };

  if (target.kind !== "shortLink") return lookupTarget(target, deps);

  const resolved = await deps.resolveShortLink(target.url);
  if (!resolved) return { ok: false, reason: "abfrage_fehlgeschlagen" };

  const behind = parseGoogleMapsLink(resolved);
  // Hinter einem Kurzlink darf kein weiterer stecken — sonst liesse sich
  // die Anwendung ueber eine Kette von Weiterleitungen beschaeftigen.
  if (!behind || behind.kind === "shortLink") {
    return { ok: false, reason: "ort_nicht_gefunden" };
  }
  return lookupTarget(behind, deps);
}
