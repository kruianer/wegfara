/**
 * Wann eine Ausgabe erfasst wurde, z.B. „20.07.2026“. `createdAt` ist ein
 * Zeitpunkt (timestamptz) und wird in der Zeitzone des Geraets gezeigt --
 * anders als die Uhrzeiten des Plans, die als Ortszeit am Reiseziel gelten
 * (siehe bug-004).
 */
export function formatExpenseDate(createdAt: string): string {
  const date = new Date(createdAt);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/**
 * Fuer wen gezahlt wurde, z.B. „für alle“ oder „für 3 Personen“ (Vorlage,
 * Abschnitt „3. Kosten“). „für alle“ steht nur dort, wo wirklich jeder
 * Teilnehmer der Reise beteiligt ist.
 */
export function formatBeneficiaries(
  beteiligte: number,
  imTrip: number,
): string {
  if (beteiligte >= imTrip && imTrip > 0) return "für alle";
  return beteiligte === 1 ? "für 1 Person" : `für ${beteiligte} Personen`;
}
