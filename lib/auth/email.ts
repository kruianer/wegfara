/**
 * Der Umgang mit E-Mail-Adressen -- bewusst getrennt von tokens.ts, das
 * node:crypto braucht: diese beiden Funktionen laufen auch im Browser, wo
 * die Karte "Reiseteilnehmer" dieselbe Pruefung anwendet wie der Server
 * (req-019).
 */

/**
 * E-Mail-Adressen werden vor jedem Vergleich vereinheitlicht, damit
 * "Uwe@Kremmel.org " dieselbe Person findet wie "uwe@kremmel.org".
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Nur eine grobe Plausibilitaetspruefung: die Rueckmeldung der Anmeldung
 * darf ohnehin nicht verraten, ob es die Adresse gibt (siehe req-016).
 */
export function isPlausibleEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(normalized);
}
