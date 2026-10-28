import type {
  AiFehlerArt,
  PlanFehlerArt,
  WebSucheFehlerArt,
} from "../ai/fehler";
import type { PlanWerkzeug } from "../ai/chat-client";
import type { ChatNachricht, ChatQuelle } from "./types";

/**
 * Was zwischen der Schnittstelle des Chats und dem Chatfenster hin und her
 * geht, waehrend eine Antwort entsteht (req-081).
 *
 * Die Antwort erscheint, waehrend sie entsteht, und nicht erst am Ende: die
 * Schnittstelle schickt deshalb keinen fertigen Koerper, sondern eine Zeile
 * je Stueck -- eine JSON-Zeile, mit "\n" abgeschlossen. Das Format steht hier
 * an einer Stelle; Sender und Empfaenger lesen dieselbe Datei.
 */

export type ChatEreignis =
  /** Die abgelegte Frage -- mit Kennung und Zeit, wie sie gespeichert ist. */
  | { art: "frage"; nachricht: ChatNachricht }
  /** Ein Stueck der entstehenden Antwort. */
  | { art: "text"; text: string }
  /** Das Modell sucht gerade im Web (req-092). */
  | { art: "suche" }
  /** Eine Quelle, auf die sich die entstehende Antwort beruft (req-092). */
  | { art: "quelle"; quelle: ChatQuelle }
  /**
   * Eine Suche scheiterte (req-092) -- die Antwort laeuft weiter, der Grund
   * steht spaeter unter ihr.
   */
  | { art: "suche_fehler"; fehler: WebSucheFehlerArt }
  /** Das Modell sieht gerade in diesen Teil des Plans (req-093). */
  | { art: "plan"; werkzeug: PlanWerkzeug }
  /**
   * Ein Blick in den Plan blieb aus (req-093) -- die Antwort laeuft weiter,
   * der Grund steht spaeter unter ihr.
   */
  | { art: "plan_fehler"; fehler: PlanFehlerArt }
  /** Die fertige, abgelegte Antwort -- sie ersetzt die entstehende. */
  | { art: "antwort"; nachricht: ChatNachricht }
  /**
   * Der Grund, warum keine Antwort zustande kam (bug-032). Er steht im
   * Verlauf an der Stelle, an der die Antwort stuende; die Frage bleibt
   * erhalten und laesst sich erneut senden.
   */
  | { art: "fehler"; grund: AiFehlerArt };

/** Eine Zeile des Stroms. */
export function chatZeile(ereignis: ChatEreignis): string {
  return `${JSON.stringify(ereignis)}\n`;
}

function istChatEreignis(wert: unknown): wert is ChatEreignis {
  if (typeof wert !== "object" || wert === null) return false;
  const art = (wert as { art?: unknown }).art;
  return (
    art === "frage" ||
    art === "text" ||
    art === "suche" ||
    art === "quelle" ||
    art === "suche_fehler" ||
    art === "plan" ||
    art === "plan_fehler" ||
    art === "antwort" ||
    art === "fehler"
  );
}

/**
 * Zerlegt eingetroffenen Text in vollstaendige Ereignisse und gibt den Rest
 * zurueck: ein Stueck kann mitten in einer Zeile enden, und eine halbe Zeile
 * ist kein Ereignis. Was nicht zu lesen ist, wird uebersprungen statt den
 * ganzen Strom zu verwerfen.
 */
export function leseChatZeilen(puffer: string): {
  ereignisse: ChatEreignis[];
  rest: string;
} {
  const teile = puffer.split("\n");
  const rest = teile.pop() ?? "";
  const ereignisse: ChatEreignis[] = [];
  for (const zeile of teile) {
    if (zeile.trim().length === 0) continue;
    try {
      const gelesen: unknown = JSON.parse(zeile);
      if (istChatEreignis(gelesen)) ereignisse.push(gelesen);
    } catch {
      // Eine unlesbare Zeile wird uebersprungen -- der Strom laeuft weiter.
    }
  }
  return { ereignisse, rest };
}
