import type { AiFehler } from "./fehler";

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
 * Ein Stueck der entstehenden Antwort: entweder Text, der hinten an die
 * Antwort kommt, oder der Grund, warum es nicht weitergeht (bug-032). Ein
 * Fehlschlag wird benannt und nicht verschluckt -- auch dann, wenn er erst
 * mitten im Strom auftritt.
 */
export type ChatStromStueck =
  | { art: "text"; text: string }
  | { art: "fehler"; fehler: AiFehler };

export interface AiChatAnfrage {
  /** Die Kennung des Modells, das antworten soll (siehe lib/chat/modelle.ts). */
  modell: string;
  /**
   * Der Verlauf in zeitlicher Folge, die zu beantwortende Frage zuletzt. Die
   * KI bekommt in diesem Schritt nichts weiter -- keine Werkzeuge und keine
   * Reisedaten (req-081, Constraints).
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
    text += stueck.text;
  }
  return { text, fehler: null };
}
