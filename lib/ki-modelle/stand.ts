import type { Queryable } from "../db/queryable";
import { findAccountKiModelle } from "../db/account-ki-modelle";
import { accountApiKey } from "../api-keys/account-keys";
import { createAnthropicModellKatalog } from "../ai/anthropic-client";
import {
  createOpenAiModellKatalog,
  openAiBildModell,
  openAiModel,
} from "../ai/openai-client";
import {
  auswahlZwischengespeichert,
  gemerkteAuswahl,
  openAiModelleZwischengespeichert,
  type GemerkteAuswahl,
} from "../chat/modell-katalog-cache";
import {
  vorgewaehltesChatModell,
  waehlbareChatModelle,
  type ChatModell,
  type OpenAiModell,
} from "../chat/modelle";
import { merkeVerschwunden } from "./verschwunden";
import type {
  KiModellEintrag,
  KiModellFeld,
  KiModellWahl,
  KiZweck,
} from "./zwecke";

/**
 * Der Stand der Karte "KI-Modelle" (req-108): je Zweck die Wahl des
 * Accounts, die Modelle, die der Dienst nennt, und ob das eingestellte noch
 * darunter ist.
 *
 * Die Kataloge werden im Server erfragt, mit dem Schluessel des Accounts --
 * der verlaesst den Server nicht (req-028). Sie kommen aus dem geteilten
 * Zwischenspeicher (lib/chat/modell-katalog-cache.ts): zweimal Oeffnen
 * innerhalb von sechs Stunden fragt den Dienst einmal.
 */

function openAiEintraege(modelle: OpenAiModell[]): KiModellEintrag[] {
  return modelle.map((modell) => ({
    id: modell.id,
    name: modell.id,
    abschaltungAm: modell.abschaltungAm,
  }));
}

function chatEintraege(modelle: ChatModell[]): KiModellEintrag[] {
  return modelle.map((modell) => ({
    id: modell.id,
    name: modell.name,
    abschaltungAm: null,
  }));
}

/**
 * Welches eingestellte Modell der Dienst nicht mehr nennt. Geprueft wird
 * das, was tatsaechlich gilt -- auch ein Modell aus der Umgebung oder dem
 * Quelltext kann abgeschaltet sein (bug-076). Ohne Liste ist es nicht zu
 * sagen.
 */
function fehlendes(
  eingestellt: string | null,
  modelle: { id: string }[] | null,
): string | null {
  if (eingestellt === null || modelle === null) return null;
  return modelle.some((modell) => modell.id === eingestellt)
    ? null
    : eingestellt;
}

function feld(
  zweck: KiZweck,
  gewaehlt: string | null,
  ohneWahl: string | null,
  auswahl: GemerkteAuswahl<{ id: string }> | null,
  eintraege: KiModellEintrag[] | null,
  ohneSchluessel: boolean,
): KiModellFeld {
  if (ohneSchluessel) {
    return {
      zweck,
      gewaehlt,
      ohneWahl,
      modelle: null,
      grund: "schluessel",
      gemerktAm: null,
      verschwunden: null,
    };
  }
  return {
    zweck,
    gewaehlt,
    ohneWahl,
    modelle: eintraege,
    grund: eintraege ? null : "dienst",
    gemerktAm:
      auswahl?.gemerkt === true
        ? new Date(auswahl.geholtAm).toISOString()
        : null,
    verschwunden: fehlendes(gewaehlt ?? ohneWahl, auswahl?.modelle ?? null),
  };
}

export async function kiModelleStand(
  db: Queryable,
  accountId: string,
  now: number,
): Promise<KiModellFeld[]> {
  const [wahl, openAiKey, anthropicKey] = await Promise.all([
    findAccountKiModelle(db, accountId),
    accountApiKey(db, accountId, "ki_suche"),
    accountApiKey(db, accountId, "anthropic"),
  ]);

  // Fuer Fragen und Bilder derselbe Katalog -- eine Anfrage fuer beide.
  const [openAi, chat] = await Promise.all([
    openAiKey
      ? openAiModelleZwischengespeichert(
          accountId,
          () => createOpenAiModellKatalog({ apiKey: openAiKey }),
          now,
        )
      : null,
    anthropicKey
      ? auswahlZwischengespeichert(
          "anthropic",
          accountId,
          () => createAnthropicModellKatalog({ apiKey: anthropicKey }),
          waehlbareChatModelle,
          now,
        )
      : null,
  ]);

  const openAiListe = openAi ? openAiEintraege(openAi.modelle) : null;
  const felder = [
    feld("fragen", wahl.fragen, openAiModel(), openAi, openAiListe, !openAiKey),
    feld(
      "bilder",
      wahl.bilder,
      openAiBildModell(),
      openAi,
      openAiListe,
      !openAiKey,
    ),
    feld(
      "chat",
      wahl.chat,
      chat ? vorgewaehltesChatModell(chat.modelle) : null,
      chat,
      chat ? chatEintraege(chat.modelle) : null,
      !anthropicKey,
    ),
  ];

  for (const { zweck, verschwunden, grund } of felder) {
    // Ohne Liste ist nichts zu sagen -- der letzte Befund bleibt stehen.
    if (grund === null) merkeVerschwunden(accountId, zweck, verschwunden);
  }
  return felder;
}

/**
 * Die Modelle, mit denen die naechste Anfrage bei OpenAI hinausgeht
 * (req-108): die Wahl des Accounts; ohne sie entscheidet `openAiModel` bzw.
 * `openAiBildModell` -- Umgebung, sonst Standard.
 *
 * Steht ein Katalog des Accounts im Zwischenspeicher, wird nebenbei
 * abgeglichen, ob das Modell darin noch steht; gefragt wird der Dienst dafuer
 * nicht. Ist es verschwunden, erfaehrt es die Gesundheitspruefung.
 */
export async function openAiModellWahl(
  db: Queryable,
  accountId: string,
  now: number = Date.now(),
): Promise<{ modell: string | null; bildModell: string | null }> {
  const wahl: KiModellWahl = await findAccountKiModelle(db, accountId);
  const gemerkt = gemerkteAuswahl<OpenAiModell>("openai", accountId, now);
  if (gemerkt) {
    merkeVerschwunden(
      accountId,
      "fragen",
      fehlendes(openAiModel(wahl.fragen), gemerkt.modelle),
    );
    merkeVerschwunden(
      accountId,
      "bilder",
      fehlendes(openAiBildModell(wahl.bilder), gemerkt.modelle),
    );
  }
  return { modell: wahl.fragen, bildModell: wahl.bilder };
}

/**
 * Das Chat-Modell, mit dem eine Unterhaltung beginnt (req-108): die Wahl des
 * Accounts, wenn der Dienst sie zur Wahl nennt -- sonst das neueste Sonnet
 * (req-090).
 */
export async function vorgewaehltesChatModellDesAccounts(
  db: Queryable,
  accountId: string,
  modelle: ChatModell[],
): Promise<string | null> {
  const { chat } = await findAccountKiModelle(db, accountId);
  merkeVerschwunden(accountId, "chat", fehlendes(chat, modelle));
  if (chat !== null && modelle.some((modell) => modell.id === chat)) {
    return chat;
  }
  return vorgewaehltesChatModell(modelle);
}
