import { isIsoDate, parseIsoDate } from "./date-utils";

const MILLISEKUNDEN_JE_TAG = 86_400_000;

/**
 * Ab wie vielen Tagen eine Reise als ungewoehnlich lang gilt (bug-050): 60
 * Tage, also rund zwei Monate. Laenger ist keine der Reisen, um die es hier
 * geht -- wer trotzdem so lange faehrt, bekommt eine Rueckfrage und kommt
 * durch, aber eben nicht stillschweigend.
 *
 * Die Zahl ist absichtlich grosszuegig: sie soll ein verrutschtes Jahr
 * abfangen (aus zwei Tagen werden 367), nicht die Reise eines Aussteigers
 * verbieten.
 */
export const UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN = 60;

/**
 * Die Laenge einer Reise in Tagen, An- und Abreisetag eingeschlossen -- genau
 * so viele Reisetage zeigt auch der Planer (siehe days.ts).
 *
 * Fehlt ein Datum, ist es keines, oder liegt das Ende vor dem Beginn, gibt es
 * keine Laenge: das Ergebnis ist dann 0.
 */
export function reiseLaengeInTagen(startDate: string, endDate: string): number {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) return 0;

  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  // Ueber UTC gerechnet, damit die Sommerzeit den Tagesabstand nicht
  // verschiebt (vgl. bug-004).
  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);
  if (endUtc < startUtc) return 0;

  return Math.round((endUtc - startUtc) / MILLISEKUNDEN_JE_TAG) + 1;
}

/** z.B. "1 Tag" oder "367 Tage". */
export function formatReiseLaenge(tage: number): string {
  return `${tage} ${tage === 1 ? "Tag" : "Tage"}`;
}

/**
 * Der Hinweis zu einer ungewoehnlich langen Reise (bug-050) -- oder null,
 * wenn die Laenge unauffaellig ist.
 *
 * Er steht hier an einer Stelle, damit die Rueckfrage im Formular und die
 * Rueckweisung an der Schnittstelle denselben Satz verwenden: ein Aufruf an
 * der Oberflaeche vorbei soll eine solche Reise genauso wenig unbemerkt
 * anlegen koennen.
 */
export function langeReiseHinweis(
  startDate: string,
  endDate: string,
): string | null {
  const tage = reiseLaengeInTagen(startDate, endDate);
  if (tage < UNGEWOEHNLICH_LANGE_REISE_AB_TAGEN) return null;

  return (
    `Diese Reise umfasst ${formatReiseLaenge(tage)} — ungewöhnlich lang. ` +
    `Bitte Beginn und Ende prüfen, besonders die Jahreszahl.`
  );
}
