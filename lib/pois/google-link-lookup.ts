import type { GooglePlace } from "@/lib/google/types";
import { parseGoogleMapsLink, type GoogleLinkTarget } from "./google-link";
import type { PoiPosition } from "./types";

/** Warum aus einem eingefuegten Text kein POI wurde (siehe req-026). */
export type GoogleLinkFailure =
  | "kein_google_link"
  | "ort_nicht_gefunden"
  | "abfrage_fehlgeschlagen";

export type GoogleLinkLookup =
  | { ok: true; place: GooglePlace }
  | { ok: false; reason: GoogleLinkFailure };

/** Die drei austauschbaren Aussenanbindungen des Nachschlagens (req-026). */
export interface GoogleLinkDeps {
  /** Loest einen Kurzlink auf und liefert die Zieladresse. */
  resolveShortLink: (url: string) => Promise<string | null>;
  /** Sucht die Kennung eines Ortes ueber seinen Namen. */
  findPlaceId: (
    query: string,
    position?: PoiPosition,
  ) => Promise<string | null>;
  /** Holt die Angaben zu einer Kennung. */
  placeDetails: (placeId: string) => Promise<GooglePlace | null>;
}

async function lookupTarget(
  target: GoogleLinkTarget,
  deps: GoogleLinkDeps,
): Promise<GoogleLinkLookup> {
  if (target.kind === "shortLink") {
    return { ok: false, reason: "abfrage_fehlgeschlagen" };
  }

  const placeId =
    target.kind === "placeId"
      ? target.placeId
      : target.query.length === 0
        ? null
        : await deps.findPlaceId(target.query, target.position);
  if (!placeId) return { ok: false, reason: "ort_nicht_gefunden" };

  const place = await deps.placeDetails(placeId);
  if (!place) return { ok: false, reason: "abfrage_fehlgeschlagen" };
  return { ok: true, place };
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
