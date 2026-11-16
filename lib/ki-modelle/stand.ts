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
  openAiModelleZwischengespeichert,
  type GemerkteAuswahl,
} from "../chat/modell-katalog-cache";
import {
  vorgewaehltesChatModell,
  waehlbareChatModelle,
  type ChatModell,
  type OpenAiModell,
} from "../chat/modelle";
import { fehlendes, merkeVerschwunden } from "./verschwunden";
import type { KiModellEintrag, KiModellFeld, KiZweck } from "./zwecke";

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
