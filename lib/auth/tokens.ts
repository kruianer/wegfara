import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Geheimnisse der Anmeldung (Anmeldelink-Token, Sitzungs-Token,
 * Notfallcodes) liegen nie im Klartext in der Datenbank -- gespeichert
 * wird ausschliesslich diese Pruefsumme (siehe Constraints in req-016).
 * Die Werte sind zufaellig und lang genug, dass ein Woerterbuchangriff
 * auf die Pruefsumme ausscheidet; ein Salt bringt hier nichts.
 */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Ein neues Token mit 256 Bit Zufall, URL-tauglich kodiert. */
export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Vergleicht zwei Pruefsummen ohne verwertbare Laufzeitunterschiede. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
