/**
 * Die Modelle, mit denen der Chat des Planers redet (req-081). Sie stehen an
 * genau dieser Stelle im Quelltext: Modelle werden abgeloest, und eine zweite
 * Liste daneben veraltet unbemerkt (req-081, Constraints).
 *
 * Alle drei kommen von Anthropic und werden ueber den Zugangsschluessel der
 * Art `anthropic` abgerechnet (req-028). Der Schluessel `ki_suche` ist ein
 * OpenAI-Schluessel und taugt dafuer nicht.
 */

export interface ChatModell {
  /** Die Kennung, unter der der Dienst das Modell kennt. */
  id: string;
  /** Wie die Auswahl es nennt. */
  label: string;
  /** Wofuer man es nimmt -- der Satz steht hinter dem Namen in der Auswahl. */
  eignung: string;
}

export const CHAT_MODELLE: ChatModell[] = [
  { id: "claude-opus-5", label: "Opus 5", eignung: "stark, teuer" },
  { id: "claude-sonnet-5", label: "Sonnet 5", eignung: "ausgewogen" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", eignung: "schnell, günstig" },
];

/**
 * Das Modell, mit dem eine Unterhaltung beginnt (req-081): das ausgewogene.
 * Wer nichts waehlt, redet mit Sonnet 5.
 */
export const VORGEWAEHLTES_CHAT_MODELL = "claude-sonnet-5";

export function istChatModell(value: unknown): value is string {
  return (
    typeof value === "string" &&
    CHAT_MODELLE.some((modell) => modell.id === value)
  );
}

/**
 * Wie die Kennung des Modells im Verlauf dasteht: Welche Antwort von welchem
 * Modell kam, soll ablesbar sein (req-081). Eine unbekannte Kennung bleibt
 * stehen, wie sie ist -- eine Antwort aus einem abgeloesten Modell soll ihre
 * Herkunft nicht verlieren.
 */
export function chatModellLabel(id: string): string {
  return CHAT_MODELLE.find((modell) => modell.id === id)?.label ?? id;
}
