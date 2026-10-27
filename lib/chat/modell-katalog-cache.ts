import type { AiModellKatalog } from "../ai/modell-katalog";
import { waehlbareChatModelle, type ChatModell } from "./modelle";

/**
 * Der Zwischenspeicher fuer die Modellauswahl des Chats (req-090). Er liegt
 * im Server, nicht im Browser: der Katalog wird mit dem Zugangsschluessel
 * des Accounts erfragt, und der verlaesst den Server nicht.
 *
 * Der Katalog aendert sich selten -- das Oeffnen des Chats soll nicht jedes
 * Mal beim Dienst anfragen. Gemerkt wird je Account, weil jeder mit seinem
 * eigenen Schluessel fragt (req-028).
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

const geholt = new Map<string, { modelle: ChatModell[]; geholtAm: number }>();
const gescheitert = new Map<string, number>();
const unterwegs = new Map<string, Promise<ChatModell[] | null>>();

/** Der gemerkte Katalog, solange er beim Ausfall noch taugt -- sonst null. */
export function gemerkteChatModelle(
  accountId: string,
  now: number,
): ChatModell[] | null {
  const eintrag = geholt.get(accountId);
  if (!eintrag || now - eintrag.geholtAm > KATALOG_RUECKFALL_MS) return null;
  return eintrag.modelle;
}

/**
 * Die Modelle, die zur Wahl stehen. Ist der gemerkte Katalog frisch, gilt er
 * ohne Anfrage; sonst wird der Dienst gefragt, und schweigt er, traegt der
 * gemerkte weiter. null heisst: die Liste ist gerade nicht zu holen.
 *
 * Nennt der Dienst kein einziges aktives Modell, gilt das als nicht geholt:
 * eine leere Auswahl macht den Chat unbenutzbar (req-090).
 */
export async function chatModelleZwischengespeichert(
  accountId: string,
  katalog: () => AiModellKatalog,
  now: number,
): Promise<ChatModell[] | null> {
  const eintrag = geholt.get(accountId);
  if (eintrag && now - eintrag.geholtAm <= KATALOG_HOECHSTALTER_MS) {
    return eintrag.modelle;
  }
  const letzterFehlschlag = gescheitert.get(accountId);
  if (
    letzterFehlschlag !== undefined &&
    now - letzterFehlschlag < KATALOG_FEHLPAUSE_MS
  ) {
    return gemerkteChatModelle(accountId, now);
  }

  // Oeffnen zwei Fenster zugleich, geht trotzdem nur eine Anfrage hinaus.
  const laufend = unterwegs.get(accountId);
  if (laufend) return laufend;

  const anfrage = (async () => {
    const ergebnis = await katalog().liste();
    const modelle = ergebnis.modelle
      ? waehlbareChatModelle(ergebnis.modelle)
      : [];
    if (modelle.length > 0) {
      geholt.set(accountId, { modelle, geholtAm: now });
      gescheitert.delete(accountId);
      return modelle;
    }
    if (ergebnis.modelle) {
      console.error(
        "modell-katalog: der Dienst nennt kein aktives Modell -- die Auswahl bleibt beim gemerkten Stand",
      );
    }
    gescheitert.set(accountId, now);
    return gemerkteChatModelle(accountId, now);
  })();
  unterwegs.set(accountId, anfrage);
  try {
    return await anfrage;
  } finally {
    unterwegs.delete(accountId);
  }
}

export function clearChatModellCache(): void {
  geholt.clear();
  gescheitert.clear();
  unterwegs.clear();
}
