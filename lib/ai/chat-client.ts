import type { AiFehler, PlanFehlerArt, WebSucheFehlerArt } from "./fehler";

/**
 * Die austauschbare Schnittstelle zum Sprachmodell fuer eine Unterhaltung
 * (req-081) -- neben AiClient, der eine einzelne Frage stellt.
 *
 * Eine Unterhaltung braucht zwei Dinge, die jener nicht kann: den ganzen
 * Verlauf als Zusammenhang, und die Antwort stueckweise, waehrend sie
 * entsteht. Wie bei AiClient steht hier keine Spur des SDKs -- ein spaeterer
 * Wechsel des Anbieters oder auf ein lokales Modell darf die aufrufende Logik
 * nicht veraendern (stack.md).
 */

/** Eine Nachricht des Verlaufs, wie das Modell sie bekommt. */
export interface AiChatNachricht {
  rolle: "ich" | "ki";
  text: string;
}

/**
 * Eine Quelle, auf die sich eine Antwort beruft (req-092) -- so, wie der
 * Dienst sie nennt. Keine Adresse wird erfunden oder aus dem Text geraten.
 */
export interface AiQuelle {
  url: string;
  titel: string;
}

/**
 * Die lesenden Werkzeuge des Chats (req-093): was das Modell aus der
 * geoeffneten Reise erfragen kann. Keines aendert etwas. Ihre Beschreibungen
 * fuer das Modell stehen beim Anbieter (lib/ai/anthropic-client.ts), neben
 * der Web-Suche; hier steht nur, welche es gibt.
 */
export const PLAN_WERKZEUGE = [
  "reise_lesen",
  "pois_lesen",
  "tagesplan_lesen",
  "kosten_lesen",
] as const;

export type PlanWerkzeug = (typeof PLAN_WERKZEUGE)[number];

export function istPlanWerkzeug(name: unknown): name is PlanWerkzeug {
  return PLAN_WERKZEUGE.some((werkzeug) => werkzeug === name);
}

/**
 * Was ein lesendes Werkzeug zurueckgibt: die ausdruecklich zusammengestellte
 * Auskunft -- oder, wenn die Eingabe des Modells nicht passt (ein Tag, den
 * die Reise nicht hat), ein Hinweis an das Modell. Das ist kein Fehlschlag:
 * das Modell kann nachfassen, der Nutzer liest davon nichts.
 */
export type PlanAuskunft =
  | { ok: true; inhalt: Record<string, unknown> }
  | { ok: false; hinweis: string };

/**
 * Wer die Werkzeuge ausfuehrt (req-093). Die Reise steht beim Erzeugen fest
 * -- vom Server, aus der geprueften Anfrage --, und das Modell kann keine
 * andere nennen: die Eingabe, die es mitgibt, traegt hoechstens einen
 * Reisetag. Ein Fehlschlag beim Lesen wirft.
 */
export interface AiPlanLeser {
  lies(werkzeug: PlanWerkzeug, eingabe: unknown): Promise<PlanAuskunft>;
}

/**
 * Ein Stueck der entstehenden Antwort: Text, der hinten an die Antwort
 * kommt, oder der Grund, warum es nicht weitergeht (bug-032). Ein
 * Fehlschlag wird benannt und nicht verschluckt -- auch dann, wenn er erst
 * mitten im Strom auftritt.
 *
 * Seit req-092 darf das Modell im Web suchen. Dazu kommen drei Stuecke, die
 * die Antwort nicht beenden: eine Suche beginnt ("suche"), die Antwort
 * beruft sich auf eine Quelle ("quelle", je Adresse einmal), oder eine Suche
 * scheiterte ("suche_fehler") -- dann schreibt das Modell weiter.
 *
 * Seit req-093 sieht das Modell in den Plan: es holt eine Auskunft ("plan",
 * je Aufruf einmal), oder eine Auskunft blieb aus ("plan_fehler") -- auch
 * dann schreibt es weiter.
 */
export type ChatStromStueck =
  | { art: "text"; text: string }
  | { art: "suche" }
  | { art: "quelle"; quelle: AiQuelle }
  | { art: "suche_fehler"; fehler: WebSucheFehlerArt }
  | { art: "plan"; werkzeug: PlanWerkzeug }
  | { art: "plan_fehler"; fehler: PlanFehlerArt }
  | { art: "fehler"; fehler: AiFehler };

export interface AiChatAnfrage {
  /** Die Kennung des Modells, das antworten soll (siehe lib/chat/modelle.ts). */
  modell: string;
  /**
   * Der Verlauf in zeitlicher Folge, die zu beantwortende Frage zuletzt.
   * Reisedaten stehen nicht darin (req-081) -- die holt sich das Modell bei
   * Bedarf ueber die lesenden Werkzeuge (req-093).
   */
  verlauf: AiChatNachricht[];
  /**
   * Die lesenden Werkzeuge fuer die geoeffnete Reise (req-093). Ohne sie hat
   * das Modell nur die Web-Suche (req-092).
   */
  planLeser?: AiPlanLeser;
}

export interface AiChatClient {
  /**
   * Antwortet auf den Verlauf und liefert die Antwort stueckweise. Der Strom
   * endet entweder von selbst oder mit einem Stueck der Art "fehler" -- ein
   * Abbruch ohne Grund kommt nicht vor.
   */
  antworte(anfrage: AiChatAnfrage): AsyncIterable<ChatStromStueck>;
}

/** Der ganze Text eines Stroms -- fuer Tests und Aufrufer ohne Eile. */
export async function stromText(
  strom: AsyncIterable<ChatStromStueck>,
): Promise<{ text: string; fehler: AiFehler | null }> {
  let text = "";
  for await (const stueck of strom) {
    if (stueck.art === "fehler") return { text, fehler: stueck.fehler };
    if (stueck.art === "text") text += stueck.text;
  }
  return { text, fehler: null };
}
