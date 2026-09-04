/**
 * Die Bankverbindung wird nach dem international ueblichen Format samt
 * Pruefziffer geprueft (req-019, Constraints): zwei Buchstaben Land, zwei
 * Pruefziffern, danach die Kontokennung des Landes. Insgesamt 15 bis 34
 * Zeichen -- laenger vergibt kein Land.
 *
 * Sie dient allein der spaeteren Abrechnung innerhalb der Gruppe; es wird
 * kein Geld bewegt (siehe delivery/vision.md, Non-Goals).
 */
const IBAN_PATTERN = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/** Leerzeichen weg, Grossbuchstaben -- so wird die IBAN abgelegt. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/**
 * Der Rest der IBAN modulo 97 nach ISO 7064: die ersten vier Zeichen
 * wandern ans Ende, Buchstaben werden zu Zahlen (A=10 … Z=35). Gerechnet
 * wird ziffernweise, weil die Zahl fuer einen Number nicht reicht.
 */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const character of rearranged) {
    const digits =
      character >= "0" && character <= "9"
        ? character
        : String(character.charCodeAt(0) - 55);
    for (const digit of digits) {
      rest = (rest * 10 + Number(digit)) % 97;
    }
  }
  return rest;
}

/**
 * Die IBAN in Vierergruppen, wie sie auf Kontoauszuegen steht (req-031):
 * so laesst sie sich am Bildschirm Zeichen fuer Zeichen mit der Banking-App
 * vergleichen. Abgelegt und kopiert wird sie ohne Leerzeichen.
 */
export function formatIbanGroups(value: string): string {
  return normalizeIban(value)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** Ob die Angabe Format und Pruefziffer einer IBAN erfuellt (req-019). */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!IBAN_PATTERN.test(iban)) return false;
  return mod97(iban) === 1;
}
