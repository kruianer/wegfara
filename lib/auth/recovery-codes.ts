import { randomBytes } from "node:crypto";
import { hashSecret } from "./tokens";

/** Bei der ersten Anmeldung werden acht Notfallcodes erzeugt (req-016). */
export const RECOVERY_CODE_COUNT = 8;

/**
 * Alphabet ohne verwechselbare Zeichen (kein I, O, 0, 1) -- die Codes
 * werden abgeschrieben und wieder eingetippt. 32 Zeichen sind genau
 * 5 Bit, damit entsteht beim Ziehen aus Zufallsbytes keine Schieflage.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const GROUP_LENGTH = 4;
const GROUP_COUNT = 3;
const CODE_LENGTH = GROUP_LENGTH * GROUP_COUNT;

function randomCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return formatRecoveryCode(code);
}

/** Gruppiert einen Code zu "XXXX-XXXX-XXXX", damit er lesbar bleibt. */
export function formatRecoveryCode(code: string): string {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += GROUP_LENGTH) {
    groups.push(code.slice(i, i + GROUP_LENGTH));
  }
  return groups.join("-");
}

/**
 * Erzeugt einen vollstaendigen Satz Notfallcodes. Doppelte Codes werden
 * ausgeschlossen, weil ein Code die Anmeldung ersetzt und deshalb
 * eindeutig sein muss.
 */
export function generateRecoveryCodes(): string[] {
  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) {
    codes.add(randomCode());
  }
  return [...codes];
}

/**
 * Macht die Eingabe des Nutzers vergleichbar: Gross-/Kleinschreibung,
 * Bindestriche und Leerzeichen duerfen die Anmeldung nicht scheitern
 * lassen.
 */
export function normalizeRecoveryCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return formatRecoveryCode(bare);
}

/** Notfallcodes werden ausschliesslich als Pruefsumme gespeichert. */
export function hashRecoveryCode(code: string): string {
  return hashSecret(normalizeRecoveryCode(code));
}

/** Ein Code hat die erwartete Laenge -- sonst ist eine Pruefung sinnlos. */
export function isPlausibleRecoveryCode(input: string): boolean {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "").length === CODE_LENGTH;
}
