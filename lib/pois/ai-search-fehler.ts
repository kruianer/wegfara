import { AI_FEHLER_TEXT, type AiFehlerArt } from "@/lib/ai/fehler";

/**
 * Warum ein Lauf der KI-Suche nicht zustande kam (bug-032). Das sind die
 * Gruende des Sprachmodells und einer, der davor liegt: ohne die Region um
 * das Suchgebiet gibt es gar keine Frage, die sich stellen liesse.
 *
 * Wie bei den Fotos (bug-027) steht der Typ in einem eigenen Modul ohne
 * Server-Bezug: die Oberflaeche braucht ihn und seinen Text.
 */
export type AiSearchFehlerArt = AiFehlerArt | "region";

export interface AiSearchFehler {
  art: AiSearchFehlerArt;
  /** Was der beteiligte Dienst selbst dazu sagt; leer, wenn er nichts sagte. */
  detail: string;
}

export const AI_SEARCH_FEHLER_TEXT: Record<AiSearchFehlerArt, string> = {
  ...AI_FEHLER_TEXT,
  region:
    "Zum Suchgebiet ließ sich keine Region ermitteln — OpenStreetMap hat nicht geantwortet. Nicht der Zugangsschlüssel ist die Ursache; bitte später erneut versuchen.",
};

/**
 * Ob das, was aus der Schnittstelle kommt, ein benannter Grund ist. Alles
 * Unbekannte gilt als unbekannter Grund und nicht als "kein Fehler" -- die
 * Suche ist ja gescheitert.
 */
export function istAiSearchFehler(value: unknown): value is AiSearchFehler {
  const kandidat = value as AiSearchFehler | null;
  return (
    typeof kandidat?.art === "string" &&
    kandidat.art in AI_SEARCH_FEHLER_TEXT &&
    typeof kandidat.detail === "string"
  );
}

/**
 * Der Satz an den Nutzer samt dem, was der Dienst selbst gesagt hat. Der
 * Zusatz ist der einzige Hinweis, der genau benennt, was fehlt -- ohne ihn
 * bliebe es beim "Fehler", der niemanden weiterbringt (bug-032).
 */
export function aiSearchFehlerText(fehler: AiSearchFehler): string {
  const satz = AI_SEARCH_FEHLER_TEXT[fehler.art];
  return fehler.detail.trim().length > 0
    ? `${satz} (Antwort des Dienstes: „${fehler.detail.trim()}“)`
    : satz;
}

/** Der Grund, wenn nicht einmal einer ankam — etwa bei einem Abbruch im Netz. */
export const UNBEKANNTER_AI_SEARCH_FEHLER: AiSearchFehler = {
  art: "netz",
  detail: "",
};
