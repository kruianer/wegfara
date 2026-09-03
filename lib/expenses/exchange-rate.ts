import type { Currency } from "./types";

/**
 * Die Wechselkurse stammen von frankfurter.dev — es gibt die Referenzkurse
 * der Europaeischen Zentralbank aus, kostenlos und ohne Zugangsschluessel
 * (siehe delivery/stack.md und req-029, Constraints).
 *
 * Abgerufen wird der Kurs beim Erfassen einer Ausgabe, nicht bei jeder
 * Anzeige: er wird mit der Ausgabe gespeichert und danach nicht mehr
 * geaendert. Sonst verschoeben sich bereits abgerechnete Betraege
 * nachtraeglich.
 */
const BASE_URL = "https://api.frankfurter.dev/v1/latest";

/**
 * Der Kurs des Tages als Euro je eine Einheit der uebergebenen Waehrung.
 * Euro selbst braucht keinen Abruf und hat immer den Kurs 1.
 *
 * null, wenn die Quelle nicht erreichbar ist oder keinen brauchbaren Kurs
 * liefert — dann wird eine Ausgabe in fremder Waehrung nicht gespeichert.
 */
export async function fetchEuroRate(
  currency: Currency,
): Promise<number | null> {
  if (currency === "EUR") return 1;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}?base=${currency}&symbols=EUR`);
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  const rates = (body as Record<string, unknown> | null)?.rates as
    | Record<string, unknown>
    | undefined;
  const rate = rates?.EUR;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return rate;
}
