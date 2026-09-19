/**
 * Wann eine gescheiterte Entsperrung keine Entscheidung des Nutzers war,
 * sondern die Weigerung des Browsers (req-066).
 *
 * Safari verlangt je nach Version fuer `navigator.credentials.get()` eine
 * Geste und weist einen Aufruf ohne sie mit `NotAllowedError` ab -- mit
 * demselben Fehlernamen, mit dem auch ein Abbruch durch den Nutzer
 * zurueckkommt. Unterscheiden laesst sich beides nur an der Dauer: eine
 * verweigerte Abfrage kommt sofort zurueck, eine abgebrochene erst,
 * nachdem jemand hingesehen und abgebrochen hat.
 *
 * Diese Grenze ist bewusst knapp: sie muss unter der Zeit liegen, die ein
 * Mensch braucht, um eine Abfrage wahrzunehmen und wegzutippen.
 */
export const GESTE_GRENZE_MS = 250;

/** Der Name eines DOMException-artigen Fehlers, sonst null. */
export function fehlerName(fehler: unknown): string | null {
  if (typeof fehler !== "object" || fehler === null) return null;
  const name = (fehler as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

/**
 * True, wenn der Browser die Abfrage ohne Geste verweigert hat. Dann
 * bleibt die eine Flaeche stehen: ein Tap, dann Face ID. Ein Fehlerhinweis
 * waere hier falsch -- der Nutzer hat nichts falsch gemacht.
 */
export function brauchtGeste(fehler: unknown, dauerMs: number): boolean {
  return fehlerName(fehler) === "NotAllowedError" && dauerMs < GESTE_GRENZE_MS;
}
