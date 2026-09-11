/**
 * Die Pruefung einer manuellen Kostenzeile (req-062) -- alles ohne
 * Programmpunkt: Maut, Parkgebuehren, Sprit. Sie gilt in der Oberflaeche wie
 * in der Schnittstelle: die eine ist die Bequemlichkeit, die andere der
 * Schutz.
 */

/**
 * Die Laenge einer Bezeichnung. Sie steht in einer Tabellenspalte neben
 * Zahlen -- was darueber hinausgeht, waere dort ohnehin nicht mehr zu lesen.
 */
export const KOSTEN_BEZEICHNUNG_MAX_LENGTH = 80;

export const KOSTEN_ERRORS = {
  bezeichnungFehlt: "Eine Bezeichnung wird gebraucht.",
  bezeichnungZuLang: `Die Bezeichnung darf höchstens ${KOSTEN_BEZEICHNUNG_MAX_LENGTH} Zeichen haben.`,
} as const;

/**
 * Was an einer Bezeichnung nicht stimmt -- null, wenn sie in Ordnung ist.
 * Eine Zeile ohne Bezeichnung gibt es nicht: sie waere eine Zeile ohne
 * Gegenstand.
 */
export function bezeichnungProblem(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return KOSTEN_ERRORS.bezeichnungFehlt;
  if (trimmed.length > KOSTEN_BEZEICHNUNG_MAX_LENGTH) {
    return KOSTEN_ERRORS.bezeichnungZuLang;
  }
  return null;
}
