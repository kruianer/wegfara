import type {
  AiFehlerArt,
  PlanFehlerArt,
  WebSucheFehlerArt,
} from "../ai/fehler";
import type { PlanWerkzeug } from "../ai/chat-client";
import { leseChatZeilen, type ChatEreignis } from "./strom";
import type { ChatModell } from "./modelle";
import type { ChatNachricht, ChatQuelle } from "./types";

/**
 * Der Browser-Anschluss an die Schnittstelle des Chats (req-081): eine Frage
 * senden, den Verlauf holen, ihn verwerfen.
 *
 * Die Antwort wird gelesen, waehrend sie entsteht -- Zeile fuer Zeile, so wie
 * die Schnittstelle sie schickt (siehe lib/chat/strom.ts). Deshalb nicht
 * `response.json()`: das wartet bis zum Ende, und genau das soll der Nutzer
 * nicht erleben.
 */

const CHAT_PFAD = "/api/chat";
const MODELLE_PFAD = "/api/chat/modelle";

/**
 * Die Modellauswahl, wie die Schnittstelle sie liefert (req-090). Ohne Liste
 * steht der Grund dabei: "schluessel" -- kein Zugangsschluessel hinterlegt --
 * oder "dienst" -- die Liste ist gerade nicht zu holen.
 */
export type ChatModelleAntwort =
  | { modelle: ChatModell[]; grund: null }
  | { modelle: null; grund: "schluessel" | "dienst" };

/** Was waehrend einer Antwort geschieht -- die Ansicht zieht Stueck fuer Stueck nach. */
export interface ChatVerlaufEmpfaenger {
  /** Die abgelegte Frage, mit Kennung und Zeit. */
  frage: (nachricht: ChatNachricht) => void;
  /** Ein Stueck der entstehenden Antwort, hinten anzuhaengen. */
  text: (stueck: string) => void;
  /** Das Modell sucht gerade im Web (req-092). */
  suche?: () => void;
  /** Eine Quelle der entstehenden Antwort (req-092). */
  quelle?: (quelle: ChatQuelle) => void;
  /** Eine Suche scheiterte, die Antwort laeuft weiter (req-092). */
  sucheFehler?: (fehler: WebSucheFehlerArt) => void;
  /** Das Modell sieht gerade in diesen Teil des Plans (req-093). */
  plan?: (werkzeug: PlanWerkzeug) => void;
  /** Ein Blick in den Plan blieb aus, die Antwort laeuft weiter (req-093). */
  planFehler?: (fehler: PlanFehlerArt) => void;
  /** Die fertige Antwort -- sie tritt an die Stelle der entstehenden. */
  antwort: (nachricht: ChatNachricht) => void;
  /** Der Grund, warum keine Antwort zustande kam (bug-032). */
  fehler: (grund: AiFehlerArt) => void;
}

export interface ChatFrage {
  tripId: string;
  text: string;
  modell: string;
  /**
   * Ein erneuter Versuch derselben Frage nach einem Fehlschlag (req-081). Sie
   * steht dann schon im Verlauf und wird nicht ein zweites Mal abgelegt.
   */
  wiederholen?: boolean;
}

/**
 * Welcher Grund hinter einer Abweisung der Schnittstelle steckt. Ein 409
 * heisst: kein Zugangsschluessel hinterlegt -- derselbe Satz wie bei einem
 * abgelehnten Schluessel schickt den Nutzer an die richtige Stelle. Alles
 * andere ist eine Stoerung, die nicht am Schluessel liegt.
 */
function grundAusStatus(status: number): AiFehlerArt {
  return status === 409 ? "zugang" : "dienst";
}

function melde(empfaenger: ChatVerlaufEmpfaenger, ereignis: ChatEreignis) {
  switch (ereignis.art) {
    case "frage":
      empfaenger.frage(ereignis.nachricht);
      return;
    case "text":
      empfaenger.text(ereignis.text);
      return;
    case "suche":
      empfaenger.suche?.();
      return;
    case "quelle":
      empfaenger.quelle?.(ereignis.quelle);
      return;
    case "suche_fehler":
      empfaenger.sucheFehler?.(ereignis.fehler);
      return;
    case "plan":
      empfaenger.plan?.(ereignis.werkzeug);
      return;
    case "plan_fehler":
      empfaenger.planFehler?.(ereignis.fehler);
      return;
    case "antwort":
      empfaenger.antwort(ereignis.nachricht);
      return;
    case "fehler":
      empfaenger.fehler(ereignis.grund);
      return;
  }
}

/**
 * Sendet eine Frage und meldet jedes Stueck der Antwort, sobald es da ist.
 * Ein Fehlschlag wird benannt und nicht verschluckt (bug-032) -- auch der des
 * Netzes, der die Schnittstelle nie erreicht.
 */
export async function sendeChatFrage(
  frage: ChatFrage,
  empfaenger: ChatVerlaufEmpfaenger,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(CHAT_PFAD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(frage),
    });
  } catch {
    empfaenger.fehler("netz");
    return;
  }

  if (!response.ok) {
    empfaenger.fehler(grundAusStatus(response.status));
    return;
  }

  let puffer = "";
  function verarbeite(stueck: string) {
    const gelesen = leseChatZeilen(puffer + stueck);
    puffer = gelesen.rest;
    for (const ereignis of gelesen.ereignisse) melde(empfaenger, ereignis);
  }

  // Ohne lesbaren Strom bleibt nur der ganze Koerper am Ende -- die Antwort
  // steht dann auf einmal da, statt zu wachsen. Besser als nichts.
  if (!response.body) {
    try {
      verarbeite(await response.text());
    } catch {
      empfaenger.fehler("netz");
    }
    return;
  }

  const leser = response.body.getReader();
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await leser.read();
      if (done) break;
      verarbeite(decoder.decode(value, { stream: true }));
    }
  } catch {
    // Reisst die Verbindung mitten in der Antwort, ist das ein Fehlschlag mit
    // Namen und kein stummes Ende.
    empfaenger.fehler("netz");
  }
}

/**
 * Die Unterhaltung einer Reise. Liefert null, wenn sie sich nicht holen
 * laesst -- die Ansicht sagt das dann statt einen leeren Verlauf zu zeigen,
 * der so aussaehe, als haette man nie geredet.
 */
export async function holeChatVerlauf(
  tripId: string,
): Promise<ChatNachricht[] | null> {
  try {
    const response = await fetch(
      `${CHAT_PFAD}?tripId=${encodeURIComponent(tripId)}`,
    );
    if (!response.ok) return null;
    const { nachrichten } = (await response.json()) as {
      nachrichten: ChatNachricht[];
    };
    return nachrichten;
  } catch {
    return null;
  }
}

/** Verwirft die Unterhaltung einer Reise -- true, wenn es geklappt hat. */
export async function verwerfeChatVerlauf(tripId: string): Promise<boolean> {
  try {
    const response = await fetch(CHAT_PFAD, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Die Modelle, die zur Wahl stehen (req-090). Erreicht die Anfrage die
 * Schnittstelle nicht, ist die Liste ebenso nicht zu holen wie beim Schweigen
 * des Dienstes -- die Ansicht sagt das, statt eine leere Auswahl zu zeigen.
 */
export async function holeChatModelle(): Promise<ChatModelleAntwort> {
  try {
    const response = await fetch(MODELLE_PFAD);
    if (!response.ok) return { modelle: null, grund: "dienst" };
    const antwort = (await response.json()) as ChatModelleAntwort;
    if (Array.isArray(antwort.modelle) && antwort.modelle.length > 0) {
      return { modelle: antwort.modelle, grund: null };
    }
    return {
      modelle: null,
      grund: antwort.grund === "schluessel" ? "schluessel" : "dienst",
    };
  } catch {
    return { modelle: null, grund: "dienst" };
  }
}
