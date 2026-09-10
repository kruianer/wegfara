/**
 * Werte aus den Umgebungsvariablen — an einer Stelle, weil "nicht gesetzt"
 * und "leer" dasselbe bedeuten muessen (bug-032).
 *
 * `deploy/docker-compose.yml` reicht die Variablen als `FOO: ${FOO}` durch.
 * Steht FOO nicht in `~/wegfara-env/<umgebung>.env`, setzt Compose sie im
 * Container auf den **leeren String** — nicht auf "nicht gesetzt". Wer sie
 * mit `??` liest, bekommt diesen leeren String und greift nie zu seinem
 * Standardwert: so ging der Modellname leer bei OpenAI raus, das mit
 * "you must provide a model parameter" antwortete.
 *
 * Deshalb wird hier gelesen und nirgends sonst mit `??`.
 */

/**
 * Ein Wert aus der Umgebung, um Leerraum bereinigt; leer heisst nicht
 * gesetzt. Fuer alles, dessen Wert keinen Leerraum am Rand haben kann —
 * Modellname, Adresse, Pfad, E-Mail.
 */
export function envWert(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const wert = env[name];
  if (typeof wert !== "string") return null;
  const bereinigt = wert.trim();
  return bereinigt.length > 0 ? bereinigt : null;
}

/**
 * Wie envWert, aber der Wert bleibt Zeichen fuer Zeichen, wie er ist — nur
 * ein durchweg leerer zaehlt als nicht gesetzt.
 *
 * Fuer Geheimnisse: aus AUTH_SECRET wird der Schluessel abgeleitet, mit dem
 * die Zugangsschluessel der Accounts verschluesselt sind (req-028). Ein
 * Leerzeichen am Rand wegzuschneiden ergaebe einen anderen Schluessel und
 * damit lauter Werte, die sich nicht mehr entschluesseln lassen.
 */
export function envGeheimnis(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const wert = env[name];
  if (typeof wert !== "string") return null;
  return wert.trim().length > 0 ? wert : null;
}
