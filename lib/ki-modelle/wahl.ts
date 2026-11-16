import type { Queryable } from "../db/queryable";
import { findAccountKiModelle } from "../db/account-ki-modelle";
import { gemerkteAuswahl } from "../chat/modell-katalog-cache";
import {
  vorgewaehltesChatModell,
  type ChatModell,
  type OpenAiModell,
} from "../chat/modelle";
import { fehlendes, merkeVerschwunden } from "./verschwunden";
import type { KiZweck } from "./zwecke";

/**
 * Was die KI-Anfragen von der Wahl des Accounts brauchen (req-108). Die
 * Reihenfolge -- Wahl, sonst Umgebung, sonst Standard -- entscheidet
 * `openAiModel` bzw. `openAiBildModell` in lib/ai/openai-client.ts; von hier
 * kommt nur die Wahl.
 *
 * Steht ein Katalog des Accounts im Zwischenspeicher, wird nebenbei
 * abgeglichen, ob das gewaehlte Modell darin noch steht -- ohne den Dienst
 * dafuer zu fragen. Fehlt es, erfaehrt es die Gesundheitspruefung.
 */

function gleicheAb(
  accountId: string,
  zweck: KiZweck,
  gewaehlt: string | null,
  modelle: { id: string }[] | null,
): void {
  if (gewaehlt === null || modelle === null) return;
  merkeVerschwunden(accountId, zweck, fehlendes(gewaehlt, modelle));
}

/** Die Wahl fuer Fragen und Bilder, zum Weiterreichen an createOpenAiClient. */
export async function openAiModellWahl(
  db: Queryable,
  accountId: string,
  now: number = Date.now(),
): Promise<{ modell: string | null; bildModell: string | null }> {
  const wahl = await findAccountKiModelle(db, accountId);
  const modelle =
    gemerkteAuswahl<OpenAiModell>("openai", accountId, now)?.modelle ?? null;
  gleicheAb(accountId, "fragen", wahl.fragen, modelle);
  gleicheAb(accountId, "bilder", wahl.bilder, modelle);
  return { modell: wahl.fragen, bildModell: wahl.bilder };
}

/**
 * Das Chat-Modell, mit dem eine Unterhaltung beginnt (req-108): die Wahl des
 * Accounts, wenn der Dienst sie zur Wahl nennt -- sonst das neueste Sonnet
 * (req-090). Umstellen laesst es sich im Chat weiterhin.
 */
export async function vorgewaehltesChatModellDesAccounts(
  db: Queryable,
  accountId: string,
  modelle: ChatModell[],
): Promise<string | null> {
  const { chat } = await findAccountKiModelle(db, accountId);
  gleicheAb(accountId, "chat", chat, modelle);
  if (chat !== null && modelle.some((modell) => modell.id === chat)) {
    return chat;
  }
  return vorgewaehltesChatModell(modelle);
}
