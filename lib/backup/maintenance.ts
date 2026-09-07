/**
 * Waehrend einer Wiederherstellung ist die App gesperrt und zeigt allen
 * einen Hinweis (req-053). Die Sperre steht im Arbeitsspeicher des
 * Anwendungsprozesses: die Wiederherstellung laeuft in genau diesem Prozess,
 * und jede andere Anfrage wird von ihm beantwortet. Eine Datei auf der
 * Platte waere die schlechtere Wahl -- sie ueberlebte einen Absturz und
 * sperrte die App dann dauerhaft aus.
 */
let laufend = false;

export function restoreInProgress(): boolean {
  return laufend;
}

/**
 * Beginnt eine Wiederherstellung. Gibt false zurueck, wenn bereits eine
 * laeuft -- zwei gleichzeitig schrieben sich gegenseitig die Datenbank um.
 */
export function beginRestore(): boolean {
  if (laufend) return false;
  laufend = true;
  return true;
}

export function endRestore(): void {
  laufend = false;
}

/** Der Hinweis, den alle waehrend der Wiederherstellung sehen. */
export const MAINTENANCE_TITLE = "Wiederherstellung läuft";
export const MAINTENANCE_TEXT =
  "Die App wird gerade auf den Stand eines Backups zurückgesetzt. " +
  "Sie ist in wenigen Augenblicken wieder da — danach ist eine neue " +
  "Anmeldung nötig.";
