import type { Currency } from "./types";

/**
 * Geldbetraege werden ueberall als ganze Cent gefuehrt und nur zum
 * Anzeigen und Einlesen in Text umgesetzt. Gerechnet wird nie mit
 * Gleitkommazahlen: die Summe der Anteile muss den Gesamtbetrag exakt
 * treffen (req-029).
 */

/** Wie die Waehrung hinter dem Betrag steht (Design-Vorlage, Abschnitt 3). */
const CURRENCY_SUFFIX: Record<Currency, string> = {
  EUR: "€",
  CHF: "CHF",
  USD: "$",
  GBP: "£",
};

const AMOUNT_PATTERN = /^\d{1,9}(?:[.,]\d{1,2})?$/;

/**
 * Liest einen eingetippten Betrag als Cent. Erlaubt Komma und Punkt als
 * Dezimaltrenner und hoechstens zwei Nachkommastellen -- alles andere ist
 * kein Betrag und ergibt null.
 */
export function parseAmountToCents(text: string): number | null {
  const trimmed = text.trim().replace(/\s/g, "");
  if (!AMOUNT_PATTERN.test(trimmed)) return null;

  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  const cents = fraction.padEnd(2, "0");
  return Number(whole) * 100 + Number(cents);
}

/** Der Betrag als Zahl mit zwei Nachkommastellen, deutsches Format. */
export function formatCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100).toLocaleString("de-DE");
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "−" : ""}${whole},${fraction}`;
}

/** Der Betrag mit seiner Waehrung, etwa „95,00 CHF“ oder „60,00 €“. */
export function formatMoney(cents: number, currency: Currency): string {
  return `${formatCents(cents)} ${CURRENCY_SUFFIX[currency]}`;
}

/** Der Betrag in Euro -- die Waehrung der Abrechnung. */
export function formatEuro(cents: number): string {
  return formatMoney(cents, "EUR");
}

/**
 * Ein Saldo mit Vorzeichen (req-030), etwa „+40,00 €“ oder „−20,00 €“:
 * positiv bekommt die Person Geld, negativ schuldet sie welches. Ein
 * ausgeglichener Saldo steht ohne Vorzeichen als „0,00 €“.
 */
export function formatSignedEuro(cents: number): string {
  return cents > 0 ? `+${formatEuro(cents)}` : formatEuro(cents);
}

/**
 * Der in Euro-Cent umgerechnete Betrag. `rate` ist der beim Erfassen
 * ermittelte Kurs: Euro je eine Einheit der erfassten Waehrung.
 */
export function toEuroCents(cents: number, rate: number): number {
  return Math.round(cents * rate);
}
