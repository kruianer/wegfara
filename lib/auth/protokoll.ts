/**
 * Was die Anmeldung ins Server-Log schreibt (req-066).
 *
 * Bis dahin protokollierte die Anwendung auf prod zu keinem
 * Anmeldevorgang etwas. Genau deshalb dauerte die Fehlersuche an bug-046
 * so lange: es gab nichts nachzusehen. Jede Zeile nennt darum den Vorgang
 * und den Schritt, an dem er endete -- und zwar in einer Form, die sich
 * mit grep finden laesst.
 *
 * Was hier nie hineingehoert: Adressen, Namen, Tokens, Aufforderungen
 * oder oeffentliche Schluessel. Die Kennung der Person genuegt, um einen
 * Vorgang wiederzufinden.
 */

/** Welcher Anmeldevorgang gemeint ist. */
export type AnmeldeVorgang =
  | "passkey-anmeldung"
  | "passkey-einrichten"
  | "ersteinrichtung"
  | "anmeldelink"
  | "anmeldelink-einloesen"
  | "einladung-einloesen";

const PRAEFIX = "anmeldung";

/**
 * Ein gescheiterter Vorgang samt dem Schritt, an dem er endete. Die
 * Einzelheit ist der geworfene Fehler, sofern es einen gab -- sie steht
 * daneben, nicht in der Zeile selbst, damit die Zeile greppbar bleibt.
 */
export function protokolliereFehlschlag(
  vorgang: AnmeldeVorgang,
  schritt: string,
  einzelheit?: unknown,
): void {
  const zeile = `${PRAEFIX}: vorgang=${vorgang} schritt=${schritt}`;
  if (einzelheit === undefined) console.error(zeile);
  else console.error(zeile, einzelheit);
}

/**
 * Ein geglueckter Vorgang. Ohne ihn liesse sich im Log nicht
 * unterscheiden, ob eine Anmeldung gar nicht erst ankam oder unterwegs
 * scheiterte.
 */
export function protokolliereErfolg(
  vorgang: AnmeldeVorgang,
  participantId: string,
): void {
  console.info(`${PRAEFIX}: vorgang=${vorgang} schritt=geglueckt`, {
    participantId,
  });
}
