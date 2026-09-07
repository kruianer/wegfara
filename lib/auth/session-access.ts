import type { Queryable } from "../db/queryable";
import { isInReleasedTrip, leadsAnyTrip } from "../db/trip-participants";
import { hasOpenRating } from "../db/rating-rounds";

/**
 * Wie lange jemand angemeldet bleibt, richtet sich danach, ob er etwas zu
 * tun hat (req-023): die Sitzung gilt, solange die Person mindestens einer
 * Reise im Zustand "Freigegeben" zugeordnet ist oder eine offene Bewertung
 * hat. Trifft beides nicht mehr zu, endet sie beim naechsten Aufruf.
 *
 * Das ersetzt die Bindung an den Reisezeitraum aus delivery/security.md:
 * ein Datumsfenster trifft weder die Vorbereitung Wochen vorher noch die
 * Abrechnung danach.
 *
 * Fuer den Reiseleiter gilt die Einschraenkung nicht -- er bleibt
 * angemeldet, solange seine Sitzung nicht abgelaufen ist.
 */
export async function sessionRemainsValid(
  db: Queryable,
  participantId: string,
): Promise<boolean> {
  if (await leadsAnyTrip(db, participantId)) return true;
  if (await isInReleasedTrip(db, participantId)) return true;
  // Eine offene Bewertung zaehlt ebenfalls (req-023): wer in einer laufenden
  // Bewertungsrunde noch nicht ueberall gestimmt hat, bleibt angemeldet --
  // sonst spraeche man ihn um seine Stimme (req-054).
  return hasOpenRating(db, participantId);
}
