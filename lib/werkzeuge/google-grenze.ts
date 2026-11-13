import type { Queryable } from "../db/queryable";
import { googleAbfragenAm, zaehleGoogleAbfrage } from "../db/mitdenka-zugang";

/**
 * Die Grenze fuer Google Places ueber die Lese-Schnittstelle (req-104).
 *
 * `ort_suchen` und `ort_nachschlagen` fragen Google und kosten Geld; eine
 * Frage in mitdenka kann eine Abfrage ausloesen, ohne dass man es merkt.
 * Deshalb ein Zaehler je Account und Tag -- in der Datenbank, nicht im
 * Arbeitsspeicher, der bei jedem Deploy vergisst.
 *
 * Gezaehlt wird nur, was ueber die Schnittstelle kam: wer im Planer sucht,
 * sieht, was er tut. `strecke_berechnen` zaehlt nicht mit -- OSRM ist
 * kostenlos.
 */
export const GOOGLE_ABFRAGEN_JE_TAG = 50;

/** Der Tag zaehlt in Europe/Berlin -- dort lebt der Betreiber. */
const ZEITZONE = "Europe/Berlin";

/** Der Kalendertag eines Zeitpunkts als "YYYY-MM-DD" in Europe/Berlin. */
export function kalendertag(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type GoogleKontingent =
  | { frei: true }
  | { frei: false; stand: number; grenze: number };

/**
 * Nimmt eine Abfrage aus dem Kontingent des Tages -- oder sagt, dass es
 * erschoepft ist. Dann geht KEINE Abfrage an Google. Gezaehlt wird vor der
 * Abfrage: auch eine, die bei Google scheitert, hat dort gekostet.
 */
export async function nimmGoogleAbfrage(
  db: Queryable,
  accountId: string,
  now: Date,
): Promise<GoogleKontingent> {
  const tag = kalendertag(now);
  const stand = await googleAbfragenAm(db, accountId, tag);
  if (stand >= GOOGLE_ABFRAGEN_JE_TAG) {
    return { frei: false, stand, grenze: GOOGLE_ABFRAGEN_JE_TAG };
  }
  await zaehleGoogleAbfrage(db, accountId, tag);
  return { frei: true };
}
