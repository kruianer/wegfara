import type { AiFehler, WebSucheFehlerArt } from "./fehler";

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
 * Ein Stueck der entstehenden Antwort: Text, der hinten an die Antwort
 * kommt, oder der Grund, warum es nicht weitergeht (bug-032). Ein
 * Fehlschlag wird benannt und nicht verschluckt -- auch dann, wenn er erst
 * mitten im Strom auftritt.
 *
 * Seit req-092 darf das Modell im Web suchen. Dazu kommen drei Stuecke, die
 * die Antwort nicht beenden: eine Suche beginnt ("suche"), die Antwort
 * beruft sich auf eine Quelle ("quelle", je Adresse einmal), oder eine Suche
 * scheiterte ("suche_fehler") -- dann schreibt das Modell weiter.
 */
export type ChatStromStueck =
  | { art: "text"; text: string }
  | { art: "suche" }
  | { art: "quelle"; quelle: AiQuelle }
  | { art: "suche_fehler"; fehler: WebSucheFehlerArt }
  | { art: "fehler"; fehler: AiFehler };

export interface AiChatAnfrage {
  /** Die Kennung des Modells, das antworten soll (siehe lib/chat/modelle.ts). */
  modell: string;
  /**
   * Der Verlauf in zeitlicher Folge, die zu beantwortende Frage zuletzt. Die
   * KI bekommt nichts weiter -- keine Reisedaten (req-081, Constraints), und
   * als einziges Werkzeug die Web-Suche des Dienstes (req-092).
   */
  verlauf: AiChatNachricht[];
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
