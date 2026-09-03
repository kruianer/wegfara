import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Verschluesselt Geheimnisse, die spaeter wieder im Klartext gebraucht
 * werden -- die Zugangsschluessel eines Accounts (req-028). Fuer die
 * Geheimnisse der Anmeldung gilt weiterhin das Gegenteil: die liegen als
 * Pruefsumme in der Datenbank und werden nie zurueckgerechnet (siehe
 * lib/auth/tokens.ts).
 *
 * Verfahren ist AES-256-GCM: es verschluesselt und erkennt zugleich jede
 * Veraenderung am Wert. Wer die Datenbank oder ein Backup liest, kann die
 * Schluessel weder verwenden noch unbemerkt austauschen.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/**
 * Der Zweck, fuer den der Schluessel abgeleitet wird. Er trennt diesen
 * Gebrauch von jedem anderen desselben AUTH_SECRET: derselbe Umgebungswert
 * ergibt fuer einen anderen Zweck einen anderen Schluessel.
 */
const PURPOSE = "wegfara:zugangsschluessel";

/**
 * Der Schluessel zum Ver- und Entschluesseln, abgeleitet aus der
 * Umgebungsvariablen AUTH_SECRET (siehe delivery/devops.md: sie liegt in
 * `~/wegfara-env/<umgebung>.env` ausserhalb des Repos). Bewusst aus der
 * Umgebung und nicht aus der Datenbank -- sonst liesse sich ein Backup
 * allein auswerten (req-028, Constraints).
 *
 * Fehlt die Variable, gibt es keinen Schluessel: dann laesst sich nichts
 * hinterlegen und nichts lesen, und die betroffenen Funktionen bleiben
 * gesperrt. Ein Ausweichen auf einen festen Wert im Quelltext waere
 * schlimmer als die Sperre.
 */
export function secretEncryptionKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(`${PURPOSE}:${secret}`, "utf8").digest();
}

/**
 * Verschluesselt einen Wert. Das Ergebnis traegt seine Version, den
 * Zufallsanteil (IV) und die Pruefsumme (Auth-Tag) bei sich -- alles, was
 * zum Entschluesseln noetig ist, ausser dem Schluessel selbst.
 *
 * Zweimaliges Verschluesseln desselben Wertes ergibt zwei verschiedene
 * Ergebnisse; aus der Datenbank ist damit nicht ablesbar, ob zwei Accounts
 * denselben Schluessel hinterlegt haben.
 */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const body = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    body.toString("base64url"),
  ].join(".");
}

/**
 * Entschluesselt einen mit encryptSecret erzeugten Wert. Liefert null, wenn
 * er nicht zum Schluessel passt, veraendert wurde oder gar nicht in dieser
 * Form vorliegt -- der Aufrufer behandelt das wie "nicht hinterlegt".
 */
export function decryptSecret(payload: string, key: Buffer): string | null {
  const [version, iv, tag, body] = payload.split(".");
  if (version !== VERSION || !iv || !tag || !body) return null;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
