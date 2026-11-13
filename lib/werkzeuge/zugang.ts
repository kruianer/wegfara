import type { Queryable } from "../db/queryable";
import { createToken, hashSecret } from "../auth/tokens";
import { formatDeviceMoment } from "../auth/devices";
import {
  deleteMitdenkaZugang,
  findMitdenkaZugang,
  findMitdenkaZugangByHash,
  googleAbfragenAm,
  saveMitdenkaZugang,
  touchMitdenkaZugang,
} from "../db/mitdenka-zugang";
import { GOOGLE_ABFRAGEN_JE_TAG, kalendertag } from "./google-grenze";

/**
 * Der Zugang fuer mitdenka (req-104): ein Schluessel je Account, mit dem
 * mitdenka die Lese-Schnittstelle /api/werkzeuge abfragt.
 *
 * Er ist ein dauerhafter Zugang ohne Passkey und ohne Ablauf -- die heikelste
 * Stelle des Requirements. Deshalb darf er nur lesen, es gibt hoechstens einen
 * je Account, und die Karte nennt, wann er zuletzt benutzt wurde.
 *
 * Gespeichert wird nur seine Pruefsumme (lib/auth/tokens.ts). Der Klartext
 * verlaesst den Server genau einmal: in der Antwort auf das Erzeugen.
 */

/**
 * Woran man den Schluessel erkennt, wenn er irgendwo auftaucht -- in einer
 * Konfigurationsdatei oder einem Protokoll.
 */
const SCHLUESSEL_PRAEFIX = "wegfara_";

/** Was die Karte "Zugang fuer mitdenka" zeigt -- nie den Schluessel selbst. */
export interface MitdenkaZugangStand {
  vorhanden: boolean;
  /** Fertig formatiert vom Server (wie "Meine Geraete"); null = noch nie. */
  zuletztBenutzt: string | null;
  googleAbfragenHeute: number;
  googleGrenze: number;
}

export async function mitdenkaZugangStand(
  db: Queryable,
  accountId: string,
  now: Date,
): Promise<MitdenkaZugangStand> {
  const [zugang, heute] = await Promise.all([
    findMitdenkaZugang(db, accountId),
    googleAbfragenAm(db, accountId, kalendertag(now)),
  ]);
  return {
    vorhanden: zugang !== null,
    zuletztBenutzt: zugang?.zuletztBenutzt
      ? formatDeviceMoment(zugang.zuletztBenutzt)
      : null,
    googleAbfragenHeute: heute,
    googleGrenze: GOOGLE_ABFRAGEN_JE_TAG,
  };
}

/**
 * Erzeugt einen neuen Schluessel und liefert ihn im Klartext -- das einzige
 * Mal. Ein vorhandener wird ersetzt und ist damit sofort ungueltig.
 */
export async function erzeugeMitdenkaZugang(
  db: Queryable,
  accountId: string,
  now: Date,
): Promise<string> {
  const schluessel = `${SCHLUESSEL_PRAEFIX}${createToken()}`;
  await saveMitdenkaZugang(db, accountId, hashSecret(schluessel), now);
  return schluessel;
}

export async function widerrufeMitdenkaZugang(
  db: Queryable,
  accountId: string,
): Promise<void> {
  await deleteMitdenkaZugang(db, accountId);
}

/**
 * Der Schluessel aus dem Kopf `Authorization: Bearer …`; null, wenn keiner
 * da ist oder er nicht die Form eines Schluessels hat.
 */
export function schluesselAusKopf(kopf: string | null): string | null {
  const treffer = /^Bearer\s+(\S+)\s*$/i.exec(kopf ?? "");
  const schluessel = treffer?.[1] ?? null;
  return schluessel?.startsWith(SCHLUESSEL_PRAEFIX) ? schluessel : null;
}

/**
 * Zu welchem Account der Schluessel gehoert -- der einzige Weg, auf dem der
 * Account bei der Schnittstelle ankommt (req-104, Constraints: nie aus einem
 * Argument eines Werkzeugs). Jede gelungene Pruefung haelt fest, wann er
 * zuletzt benutzt wurde.
 */
export async function pruefeMitdenkaZugang(
  db: Queryable,
  schluessel: string,
  now: Date,
): Promise<string | null> {
  const zugang = await findMitdenkaZugangByHash(db, hashSecret(schluessel));
  if (!zugang) return null;
  await touchMitdenkaZugang(db, zugang.accountId, now);
  return zugang.accountId;
}
