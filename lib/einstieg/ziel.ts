import type { Bewertungsrunde } from "../bewertungen/types";
import type { TripParticipant } from "../trip-participants/types";
import type { Trip } from "../trips/types";

/**
 * Wohin jemand gehoert, der die App oeffnet (req-055). Die Hauptadresse
 * leitet weiter, statt eine Auswahl zu zeigen -- die Startseite mit den drei
 * Kacheln aus req-015 gibt es nicht mehr.
 *
 * Ohne UI- und ohne Datenbankbezug, damit die Hauptadresse, der Planer und
 * der Begleiter dieselbe Rechnung anstellen und keiner von ihnen den anderen
 * kennen muss (siehe delivery/stack.md, Conventions).
 */

/** Der Begleiter -- der Bereich fuer unterwegs. */
export const BEGLEITER_PATH = "/go";
/** Der Planer -- der Bereich fuer die Planung am breiten Bildschirm. */
export const PLANER_PATH = "/plan";

export type EinstiegsZiel = typeof BEGLEITER_PATH | typeof PLANER_PATH;

/**
 * Die Reise, die gerade laeuft: heutiges Datum im Zeitraum, Zustand
 * "Freigegeben". Laeuft mehr als eine, gilt die, die zuerst begonnen hat
 * (req-055, Out of Scope) -- unterschieden werden sie nicht.
 *
 * `trips` sind die Reisen, die diese Person sieht (siehe lib/db/trips.ts):
 * eine freigegebene darunter ist eine, der sie zugeordnet ist.
 */
export function laufendeReise(trips: Trip[], today: string): Trip | null {
  return (
    trips
      .filter(
        (trip) =>
          trip.state === "freigegeben" &&
          trip.startDate <= today &&
          today <= trip.endDate,
      )
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
}

/**
 * Die laufende Bewertungsrunde, auf die eine Antwort wartet (req-054). Sie
 * zaehlt nur, wenn ihre Reise zu den sichtbaren gehoert -- was zu einer
 * fremden Reise gehoert, geht niemanden an (req-023).
 */
export function offeneAbstimmung(
  runden: Bewertungsrunde[],
  trips: Trip[],
): Bewertungsrunde | null {
  const sichtbar = new Set(trips.map((trip) => trip.id));
  return (
    runden
      .filter(
        (runde) => runde.status === "laeuft" && sichtbar.has(runde.tripId),
      )
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0] ?? null
  );
}

/**
 * Ob diese Person den Planer benutzen darf (req-055): er ist fuer
 * Reiseleiter und Account-Admin. Die Rolle gehoert zur Zuordnung zwischen
 * Person und Reise (req-021) -- wer irgendeine Reise fuehrt, plant auch.
 *
 * Der Gesamt-Admin gilt in jedem Account, in den er gewechselt ist, als
 * Account-Admin (req-027) -- das steht bereits in `accountAdmin`.
 */
export function darfPlanen({
  tripParticipants,
  participantId,
  accountAdmin = false,
}: {
  tripParticipants: TripParticipant[];
  participantId: string;
  accountAdmin?: boolean;
}): boolean {
  if (accountAdmin) return true;
  return tripParticipants.some(
    (assignment) =>
      assignment.participantId === participantId &&
      assignment.role === "reiseleiter",
  );
}

/**
 * Wohin die Hauptadresse eine angemeldete Person bringt (req-055), in dieser
 * Reihenfolge:
 *
 * 1. laeuft eine Reise, geht es in den Begleiter zum Plan -- sie geht vor,
 *    auch beim Reiseleiter,
 * 2. sonst in den Begleiter zur Abstimmung, wenn eine Bewertungsrunde laeuft,
 * 3. sonst in den Planer, wer ihn darf; alle uebrigen in den Begleiter.
 */
export function einstiegsZiel({
  trips,
  runden = [],
  tripParticipants = [],
  participantId,
  accountAdmin = false,
  today,
}: {
  trips: Trip[];
  runden?: Bewertungsrunde[];
  tripParticipants?: TripParticipant[];
  participantId: string;
  accountAdmin?: boolean;
  today: string;
}): EinstiegsZiel {
  if (laufendeReise(trips, today)) return BEGLEITER_PATH;
  if (offeneAbstimmung(runden, trips)) return BEGLEITER_PATH;
  return darfPlanen({ tripParticipants, participantId, accountAdmin })
    ? PLANER_PATH
    : BEGLEITER_PATH;
}
