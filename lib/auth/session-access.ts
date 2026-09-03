import type { Queryable } from "../db/queryable";
import { isInReleasedTrip, leadsAnyTrip } from "../db/trip-participants";

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
  // Offene Bewertungen zaehlen ebenfalls (req-023). Bewertungsrunden gibt
  // es noch nicht -- sobald es sie gibt, kommt die Pruefung hier dazu.
  return false;
}
