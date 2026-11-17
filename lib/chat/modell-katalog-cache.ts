import type {
  AiModellKatalog,
  OpenAiKatalogModell,
} from "../ai/modell-katalog";
import {
  waehlbareChatModelle,
  waehlbareOpenAiModelle,
  type ChatModell,
  type OpenAiModell,
} from "./modelle";

/**
 * Der Zwischenspeicher fuer die Modellauswahl des Chats (req-090). Er liegt
 * im Server, nicht im Browser: der Katalog wird mit dem Zugangsschluessel
 * des Accounts erfragt, und der verlaesst den Server nicht.
 *
 * Der Katalog aendert sich selten -- das Oeffnen des Chats soll nicht jedes
 * Mal beim Dienst anfragen. Gemerkt wird je Account, weil jeder mit seinem
 * eigenen Schluessel fragt (req-028).
 *
 * Seit req-108 fuehrt er auch den Katalog von OpenAI fuer die Karte
 * "KI-Modelle" -- geteilt, nicht kopiert, mit denselben Zeiten.
 */

/** Wie lange ein geholter Katalog gilt, bevor er neu erfragt wird. */
export const KATALOG_HOECHSTALTER_MS = 6 * 60 * 60 * 1000;

/**
 * Wie lange ein Katalog beim Ausfall des Dienstes die Auswahl weitertraegt
 * (wie bug-067 es fuer die Fahrzeit verlangt). Danach waere er eher
 * irrefuehrend: in einer Woche kann ein Modell abgeschaltet sein.
 */
export const KATALOG_RUECKFALL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Wie lange nach einem Fehlschlag nicht erneut gefragt wird. Schweigt der
 * Dienst, soll nicht jedes Oeffnen des Chats die naechste vergebliche
 * Anfrage ausloesen.
 */
export const KATALOG_FEHLPAUSE_MS = 60 * 1000;

/**
 * Die Dienste, deren Katalog hier gemerkt wird: Anthropic fuer den Chat
 * (req-090) und seit req-108 OpenAI fuer Fragen und Bilder. Dieselben Zeiten
 * fuer beide -- sie sind erprobt und stehen an dieser einen Stelle.
 */
export type KatalogDienst = "anthropic" | "openai";

interface Eintrag {
  modelle: unknown[];
  geholtAm: number;
}

/** Was aus dem Zwischenspeicher kommt: die Auswahl und ihr Stand. */
export interface GemerkteAuswahl<M> {
  modelle: M[];
  /** Wann der Dienst sie genannt hat (ms seit 1970). */
  geholtAm: number;
  /**
   * Ob sie nur noch gemerkt ist, weil der Dienst gerade nicht antwortet -- die
   * Karte "KI-Modelle" sagt das dann (req-108).
   */
  gemerkt: boolean;
}

const geholt = new Map<string, Eintrag>();
const gescheitert = new Map<string, number>();
const unterwegs = new Map<string, Promise<GemerkteAuswahl<unknown> | null>>();

/** Gemerkt wird je Dienst und Account: jeder fragt mit seinem Schluessel. */
function schluessel(dienst: KatalogDienst, accountId: string): string {
  return `${dienst}:${accountId}`;
}

/**
 * Der gemerkte Katalog eines Dienstes, solange er beim Ausfall noch taugt --
 * sonst null. Fragt nie beim Dienst.
 */
export function gemerkteAuswahl<M>(
  dienst: KatalogDienst,
  accountId: string,
  now: number,
): GemerkteAuswahl<M> | null {
  const eintrag = geholt.get(schluessel(dienst, accountId));
  if (!eintrag || now - eintrag.geholtAm > KATALOG_RUECKFALL_MS) return null;
  return {
    modelle: eintrag.modelle as M[],
    geholtAm: eintrag.geholtAm,
    gemerkt: now - eintrag.geholtAm > KATALOG_HOECHSTALTER_MS,
  };
}

/**
 * Die Modelle eines Dienstes, die zur Wahl stehen. Ist der gemerkte Katalog
 * frisch, gilt er ohne Anfrage; sonst wird der Dienst gefragt, und schweigt
 * er, traegt der gemerkte weiter. null heisst: die Liste ist gerade nicht zu
 * holen.
 *
 * `waehle` macht aus dem Katalog die Auswahl (lib/chat/modelle.ts); gemerkt
 * wird erst, was daraus hervorgeht. Bleibt nichts zur Wahl, gilt das als
 * nicht geholt: eine leere Auswahl macht die Funktion unbenutzbar (req-090).
 */
export async function auswahlZwischengespeichert<R, M>(
  dienst: KatalogDienst,
  accountId: string,
  katalog: () => AiModellKatalog<R>,
  waehle: (katalog: R[]) => M[],
  now: number,
): Promise<GemerkteAuswahl<M> | null> {
  const key = schluessel(dienst, accountId);
  const eintrag = geholt.get(key);
  if (eintrag && now - eintrag.geholtAm <= KATALOG_HOECHSTALTER_MS) {
    return {
      modelle: eintrag.modelle as M[],
      geholtAm: eintrag.geholtAm,
      gemerkt: false,
    };
  }
  const letzterFehlschlag = gescheitert.get(key);
  if (
    letzterFehlschlag !== undefined &&
    now - letzterFehlschlag < KATALOG_FEHLPAUSE_MS
  ) {
    return alsGemerkt(gemerkteAuswahl<M>(dienst, accountId, now));
  }

  // Oeffnen zwei Fenster zugleich, geht trotzdem nur eine Anfrage hinaus.
  const laufend = unterwegs.get(key);
  if (laufend) return (await laufend) as GemerkteAuswahl<M> | null;

  const anfrage = (async (): Promise<GemerkteAuswahl<M> | null> => {
    const ergebnis = await katalog().liste();
    const modelle = ergebnis.modelle ? waehle(ergebnis.modelle) : [];
    if (modelle.length > 0) {
      geholt.set(key, { modelle, geholtAm: now });
      gescheitert.delete(key);
      return { modelle, geholtAm: now, gemerkt: false };
    }
    if (ergebnis.modelle) {
      console.error(
        `modell-katalog: ${dienst} nennt kein waehlbares Modell -- die Auswahl bleibt beim gemerkten Stand`,
      );
    }
    gescheitert.set(key, now);
    return alsGemerkt(gemerkteAuswahl<M>(dienst, accountId, now));
  })();
  unterwegs.set(key, anfrage);
  try {
    return await anfrage;
  } finally {
    unterwegs.delete(key);
  }
}

/** Was nach einem Fehlschlag weitertraegt, ist gemerkt -- auch wenn es jung ist. */
function alsGemerkt<M>(
  auswahl: GemerkteAuswahl<M> | null,
): GemerkteAuswahl<M> | null {
  return auswahl && { ...auswahl, gemerkt: true };
}

/** Der gemerkte Katalog des Chats, solange er beim Ausfall noch taugt -- sonst null. */
export function gemerkteChatModelle(
  accountId: string,
  now: number,
): ChatModell[] | null {
  return (
    gemerkteAuswahl<ChatModell>("anthropic", accountId, now)?.modelle ?? null
  );
}

/**
 * Die Modelle, die im Chat zur Wahl stehen (req-090) -- nur die aktiven, aus
 * dem Katalog von Anthropic. null heisst: die Liste ist gerade nicht zu holen.
 */
export async function chatModelleZwischengespeichert(
  accountId: string,
  katalog: () => AiModellKatalog,
  now: number,
): Promise<ChatModell[] | null> {
  const auswahl = await auswahlZwischengespeichert(
    "anthropic",
    accountId,
    katalog,
    waehlbareChatModelle,
    now,
  );
  return auswahl?.modelle ?? null;
}

/**
 * Die Modelle von OpenAI, die zur Wahl stehen (req-108) -- fuer Fragen und
 * Bilder derselbe Katalog, also eine Anfrage fuer beide Felder.
 */
export function openAiModelleZwischengespeichert(
  accountId: string,
  katalog: () => AiModellKatalog<OpenAiKatalogModell>,
  now: number,
): Promise<GemerkteAuswahl<OpenAiModell> | null> {
  return auswahlZwischengespeichert(
    "openai",
    accountId,
    katalog,
    (modelle) => waehlbareOpenAiModelle(modelle, now),
    now,
  );
}

export function clearChatModellCache(): void {
  geholt.clear();
  gescheitert.clear();
  unterwegs.clear();
}
