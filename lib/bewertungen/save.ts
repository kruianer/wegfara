import type { Bewertungsrunde, Stimme, StimmWahl } from "./types";

/**
 * Der Browser-Anschluss der Bewertungsrunde (req-054). Anders als beim Status
 * eines POI wird hier nicht optimistisch uebernommen: eine Runde zu starten
 * oder zu beenden ist ein Vorgang, dessen Ausgang der Nutzer sehen muss --
 * scheitert er, gibt es die Runde nicht.
 *
 * Geantwortet wird jeweils mit dem gespeicherten Stand, damit die Oberflaeche
 * ohne Neuladen nachzieht.
 */

async function post<T>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
  feld: string,
): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    return (data[feld] as T) ?? null;
  } catch {
    return null;
  }
}

/** Startet eine Runde ueber die ausgewaehlten POIs; null, wenn es misslang. */
export function starteBewertungsrunde(
  tripId: string,
  poiIds: string[],
): Promise<Bewertungsrunde | null> {
  return post<Bewertungsrunde>(
    "/api/bewertungsrunden",
    "POST",
    { tripId, poiIds },
    "runde",
  );
}

/** Beendet die laufende Runde; null, wenn es misslang. */
export function beendeBewertungsrunde(
  roundId: string,
): Promise<Bewertungsrunde | null> {
  return post<Bewertungsrunde>(
    "/api/bewertungsrunden",
    "PATCH",
    { roundId },
    "runde",
  );
}

/** Gibt die eigene Stimme ab oder aendert sie; null, wenn es misslang. */
export function speichereStimme(
  roundId: string,
  poiId: string,
  wahl: StimmWahl,
): Promise<Stimme | null> {
  return post<Stimme>(
    "/api/stimmen",
    "POST",
    { roundId, poiId, wahl },
    "stimme",
  );
}
