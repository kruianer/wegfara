import type { RoutingClient, Wegpunkt } from "@/lib/routing/client";

/**
 * Wie lange eine ermittelte Fahrzeit als Rueckfall taugt, wenn der
 * Routing-Dienst ausfaellt (bug-067). Auf einer langen Fahrt ist eine
 * Angabe von vor einer halben Stunde -- mit ihrem Stand -- noch besser als
 * keine; danach waere sie eher irrefuehrend.
 */
export const FAHRZEIT_RUECKFALL_MS = 30 * 60 * 1000;

/** Eine Fahrzeit; `ermitteltAm` ist gesetzt, wenn sie aus dem Speicher kommt. */
export interface Fahrzeit {
  minuten: number;
  ermitteltAm: number | null;
}

/**
 * Gemerkt wird je Reise und Ziel, nicht je Streckenpaar: wer unterwegs ist,
 * steht bei jeder Abfrage woanders, und die Fahrzeit von vorhin zum selben
 * Ziel ist genau die Angabe, die beim Ausfall weiterhilft. Drei
 * Nachkommastellen sind rund 100 Meter.
 */
function zielKey(tripId: string, ziel: Wegpunkt): string {
  return `${tripId}:${ziel.lat.toFixed(3)},${ziel.lng.toFixed(3)}`;
}

const cache = new Map<string, { minuten: number; ermitteltAm: number }>();

/**
 * Die Fahrzeit zum Ziel fuer den Live-Status (req-051). Antwortet der Dienst,
 * gilt seine Angabe und wird gemerkt; schweigt er, gilt die zuletzt
 * gemerkte, solange sie nicht aelter als FAHRZEIT_RUECKFALL_MS ist.
 *
 * Nur fuer den Live-Status: im Planer wird eine Fahrzeit gespeichert und
 * steht nachher im Plan -- eine veraltete hat dort nichts verloren.
 */
export async function fahrzeitMitRueckfall(
  tripId: string,
  von: Wegpunkt,
  ziel: Wegpunkt,
  routing: Pick<RoutingClient, "fahrzeitMinuten">,
  now: number,
): Promise<Fahrzeit | null> {
  const key = zielKey(tripId, ziel);
  const minuten = await routing.fahrzeitMinuten(von, ziel);
  if (minuten !== null && Number.isFinite(minuten)) {
    cache.set(key, { minuten, ermitteltAm: now });
    return { minuten, ermitteltAm: null };
  }

  const entry = cache.get(key);
  if (entry && now - entry.ermitteltAm <= FAHRZEIT_RUECKFALL_MS) return entry;
  return null;
}

export function clearFahrzeitCache(): void {
  cache.clear();
}
