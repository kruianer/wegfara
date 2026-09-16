import type { Queryable } from "../db/queryable";
import { isInReleasedTrip, leadsAnyTrip } from "../db/trip-participants";
import { isAccountOrSuperAdmin } from "../db/participants";
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
 * Ausgenommen sind der Reiseleiter -- wer eine Reise fuehrt, bleibt
 * angemeldet, gleich in welchem Zustand sie ist -- sowie der Account-Admin
 * und der Gesamt-Admin (bug-046). Die beiden haengen an keiner Reise: sie
 * legen Reisen und Personen ueberhaupt erst an. Ohne diese Ausnahme sperrt
 * sich eine Umgebung ohne Reisen selbst zu -- um eine Reise anzulegen,
 * muesste man angemeldet sein, und um angemeldet zu bleiben, braeuchte es
 * eine Reise.
 */
export async function sessionRemainsValid(
  db: Queryable,
  participantId: string,
): Promise<boolean> {
  if (await isAccountOrSuperAdmin(db, participantId)) return true;
  if (await leadsAnyTrip(db, participantId)) return true;
  if (await isInReleasedTrip(db, participantId)) return true;
  // Eine offene Bewertung zaehlt ebenfalls (req-023): wer in einer laufenden
  // Bewertungsrunde noch nicht ueberall gestimmt hat, bleibt angemeldet --
  // sonst spraeche man ihn um seine Stimme (req-054).
  return hasOpenRating(db, participantId);
}
