import type { GoogleLinkFailure } from "./google-link-lookup";
import type { Poi } from "./types";

export type GoogleLinkImportOutcome =
  | { result: "angelegt" | "aufgefrischt"; poi: Poi }
  | { result: "fehler"; reason: GoogleLinkFailure };

/** Was die Ergebniszeile bei einem Fehlschlag nennt (siehe req-026, GUI). */
export const GOOGLE_LINK_FAILURE_TEXT: Record<GoogleLinkFailure, string> = {
  kein_google_link: "Das ist kein Google-Maps-Link.",
  ort_nicht_gefunden: "Zu diesem Link ließ sich kein Ort finden.",
  abfrage_fehlgeschlagen: "Die Abfrage bei Google ist fehlgeschlagen.",
};

/**
 * Loest das serverseitige Anlegen eines POI aus einem Google-Maps-Link aus
 * (siehe req-026). Ein Fehlschlag der Uebertragung selbst wird wie eine
 * fehlgeschlagene Abfrage behandelt — angelegt wird in beiden Faellen
 * nichts.
 */
export async function importPoiFromGoogleLink(
  tripId: string,
  link: string,
): Promise<GoogleLinkImportOutcome> {
  const fehlschlag: GoogleLinkImportOutcome = {
    result: "fehler",
    reason: "abfrage_fehlgeschlagen",
  };

  let response: Response;
  try {
    response = await fetch("/api/poi-aus-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, link }),
    });
  } catch {
    return fehlschlag;
  }

  if (!response.ok) return fehlschlag;

  try {
    return (await response.json()) as GoogleLinkImportOutcome;
  } catch {
    return fehlschlag;
  }
}
