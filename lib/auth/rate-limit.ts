/**
 * Hoechstens drei Anmeldelinks pro Stunde und Konto (req-037). Mehr braucht
 * kein ehrlicher Gebrauch, und jeder verschickte Link ist ein Zugang zum
 * Konto, der im Postfach liegt.
 *
 * Ein Ueberschreiten aendert die Antwort der App NICHT -- sonst liesse sich am
 * Verhalten ablesen, ob eine Adresse bekannt ist.
 */
export const LOGIN_LINK_MAX_ATTEMPTS = 3;
export const LOGIN_LINK_WINDOW_MS = 60 * 60 * 1000;

export interface RateLimiter {
  /** True, solange der Schluessel im Zeitfenster noch Versuche frei hat. */
  allow(key: string, now: Date): boolean;
}

/**
 * Einfache Bremse fuer die Schnittstellen der Anmeldung: sie sind ohne
 * Anmeldung erreichbar und wuerden sonst beliebig oft Mails versenden
 * bzw. Notfallcodes durchprobieren lassen.
 *
 * Der Zaehler liegt im Arbeitsspeicher der Instanz. Das genuegt, weil je
 * Umgebung genau eine Instanz laeuft (siehe delivery/devops.md); ein
 * Neustart setzt ihn zurueck, was hier hinnehmbar ist.
 */
export function createRateLimiter(
  maxAttempts: number,
  windowMs: number,
): RateLimiter {
  const attempts = new Map<string, number[]>();

  return {
    allow(key: string, now: Date): boolean {
      const since = now.getTime() - windowMs;
      const recent = (attempts.get(key) ?? []).filter((at) => at > since);

      // Abgelaufene Schluessel nicht liegen lassen, sonst waechst die
      // Ablage unbegrenzt.
      for (const [otherKey, timestamps] of attempts) {
        if (timestamps.every((at) => at <= since)) attempts.delete(otherKey);
      }

      if (recent.length >= maxAttempts) {
        attempts.set(key, recent);
        return false;
      }
      recent.push(now.getTime());
      attempts.set(key, recent);
      return true;
    },
  };
}
