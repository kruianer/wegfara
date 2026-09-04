import { isValidIban, normalizeIban } from "../participants/iban";

/**
 * Der Ueberweisungscode zu einer Zahlung des Ausgleichs (req-031). Sein
 * Inhalt folgt dem in Europa gebraeuchlichen Format fuer Ueberweisungen
 * (EPC-QR, „Girocode“): eine feste Folge von Zeilen, aus der Banking-Apps
 * eine fertige Ueberweisung einlesen.
 *
 * Erzeugt wird er in der Anwendung selbst -- es wird kein fremder Dienst
 * aufgerufen und keine Bankverbindung nach aussen gegeben (req-031,
 * Constraints).
 */

/** Kennzeichen des Formats; danach die Version und der Zeichensatz. */
const SERVICE_TAG = "BCD";

/** Version 002: die BIC ist im europaeischen Zahlungsraum entbehrlich. */
const VERSION = "002";

/** Zeichensatz 1 -- UTF-8, damit Umlaute im Namen erhalten bleiben. */
const CHARACTER_SET = "1";

/** Die Ueberweisung (SEPA Credit Transfer). */
const IDENTIFICATION = "SCT";

/** So lang darf der Name des Empfaengers im Code sein. */
export const TRANSFER_CODE_NAME_MAX = 70;

/** Weniger als einen Cent und mehr als das nimmt das Format nicht an. */
const MIN_CENTS = 1;
const MAX_CENTS = 99_999_999_999;

/** Was in den Code kommt: Empfaenger, Bankverbindung und Betrag -- mehr nicht. */
export interface TransferCodeInput {
  /** Der volle Name des Empfaengers, damit er zum Kontoinhaber passt. */
  recipientName: string;
  iban: string;
  amountCents: number;
}

/**
 * Der Name, wie er im Code steht: in einer Zeile und hoechstens 70 Zeichen.
 * Ein Zeilenumbruch im Namen wuerde das Format zerlegen, ein zu langer Name
 * es sprengen -- gekuerzt wird er lieber, als den Code scheitern zu lassen.
 */
export function transferCodeName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, TRANSFER_CODE_NAME_MAX);
}

/** Der Betrag, wie ihn das Format erwartet: „EUR40.00“, mit Punkt. */
export function transferCodeAmount(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `EUR${whole}.${fraction}`;
}

/**
 * Der Inhalt des Ueberweisungscodes -- oder null, wenn sich daraus keine
 * Ueberweisung lesen liesse: ohne gueltige Bankverbindung, ohne Namen oder
 * mit einem Betrag ausserhalb dessen, was das Format annimmt.
 *
 * Verwendungszweck und Referenz bleiben leer: der Code enthaelt keine
 * Angaben ueber die Reise oder die Ausgaben (req-031, Constraints). Die
 * leeren Felder am Ende duerfen entfallen, deshalb endet er beim Betrag.
 */
export function transferCodePayload(input: TransferCodeInput): string | null {
  const name = transferCodeName(input.recipientName);
  const iban = normalizeIban(input.iban);

  if (name.length === 0) return null;
  if (!isValidIban(iban)) return null;
  if (!Number.isInteger(input.amountCents)) return null;
  if (input.amountCents < MIN_CENTS || input.amountCents > MAX_CENTS) {
    return null;
  }

  return [
    SERVICE_TAG,
    VERSION,
    CHARACTER_SET,
    IDENTIFICATION,
    // Die BIC -- in Version 002 entbehrlich und deshalb leer.
    "",
    name,
    iban,
    transferCodeAmount(input.amountCents),
  ].join("\n");
}
