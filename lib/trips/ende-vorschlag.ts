import { isIsoDate, parseIsoDate } from "./date-utils";

/**
 * Die Laenge, mit der eine neue Reise vorgeschlagen wird (req-067): eine
 * Woche -- die Laenge, bei der die meisten Reisen anfangen.
 */
export const VORGESCHLAGENE_REISELAENGE_TAGE = 7;

/**
 * Das vorgeschlagene Ende zu einem Beginn (req-067): Beginn plus sieben Tage.
 *
 * Ist der Beginn kein gueltiges Datum -- leer oder erst halb getippt --, gibt
 * es keinen Vorschlag: das Ergebnis ist dann der leere Text.
 */
export function endeVorschlag(startDate: string): string {
  if (!isIsoDate(startDate)) return "";

  const { year, month, day } = parseIsoDate(startDate);
  // Ueber UTC gerechnet, damit die Sommerzeit den Tagesabstand nicht
  // verschiebt (vgl. bug-004).
  const ende = new Date(Date.UTC(year, month - 1, day));
  ende.setUTCDate(ende.getUTCDate() + VORGESCHLAGENE_REISELAENGE_TAGE);
  return ende.toISOString().slice(0, 10);
}

/**
 * Was nach einer Aenderung des Beginns im Ende stehen soll (req-067).
 *
 * Der Vorschlag ist nur ein Vorschlag: er erscheint allein, solange das Ende
 * leer ist. Ein eingetragenes Ende bleibt unangetastet -- auch dann, wenn der
 * Beginn nachtraeglich geaendert wird.
 */
export function endeNachBeginn(startDate: string, endDate: string): string {
  if (endDate.length > 0) return endDate;
  return endeVorschlag(startDate);
}
