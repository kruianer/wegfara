import type { KiZweck } from "./zwecke";

/**
 * Welche eingestellten Modelle der Dienst nicht mehr nennt (req-108) -- fuer
 * die Gesundheitspruefung (`/api/health`). Sie fragt bewusst keine Datenbank
 * und keinen Dienst; was sie meldet, haben die Karte "KI-Modelle" und die
 * KI-Anfragen beim Abgleich mit dem Katalog hier hinterlassen.
 *
 * Gemerkt wird im Server und je Account, damit der Abgleich eines Accounts
 * den eines anderen nicht ueberschreibt. Nach aussen geht nur Zweck und
 * Modell, nie der Account: der Endpunkt ist oeffentlich.
 */

export interface VerschwundenesModell {
  zweck: KiZweck;
  modell: string;
}

const verschwunden = new Map<string, Map<KiZweck, string>>();

/**
 * Haelt fest, ob das eingestellte Modell eines Zwecks fehlt (`modell`) oder
 * dasteht (null).
 */
export function merkeVerschwunden(
  accountId: string,
  zweck: KiZweck,
  modell: string | null,
): void {
  const jeZweck = verschwunden.get(accountId) ?? new Map<KiZweck, string>();
  if (modell === null) jeZweck.delete(zweck);
  else jeZweck.set(zweck, modell);
  if (jeZweck.size === 0) verschwunden.delete(accountId);
  else verschwunden.set(accountId, jeZweck);
}

/** Alle fehlenden Modelle, je Zweck und Modell einmal. */
export function verschwundeneModelle(): VerschwundenesModell[] {
  const gesehen = new Set<string>();
  const liste: VerschwundenesModell[] = [];
  for (const jeZweck of verschwunden.values()) {
    for (const [zweck, modell] of jeZweck) {
      const key = `${zweck}:${modell}`;
      if (gesehen.has(key)) continue;
      gesehen.add(key);
      liste.push({ zweck, modell });
    }
  }
  return liste;
}

export function clearVerschwundeneModelle(): void {
  verschwunden.clear();
}
