/**
 * Der Verlauf des Chatfensters im Planer (req-081): eigene Nachrichten und
 * die Antworten der KI, in zeitlicher Folge.
 */

/** Von wem eine Nachricht kommt. */
export type ChatRolle = "ich" | "ki";

export interface ChatNachricht {
  id: string;
  /** Die Reise, zu deren Unterhaltung die Nachricht gehoert (req-081). */
  tripId: string;
  rolle: ChatRolle;
  text: string;
  /**
   * Welches Modell geantwortet hat (req-081) -- bei einer eigenen Nachricht
   * null: sie kam von keinem. Gespeichert wird die Kennung des Modells, nicht
   * sein Name: Modelle werden abgeloest, eine alte Antwort behaelt damit ihre
   * Herkunft (siehe lib/chat/modelle.ts).
   */
  modell: string | null;
  createdAt: string;
}

/** Was eine neue Nachricht mitbringt -- Kennung und Zeit entstehen beim Ablegen. */
export interface NeueChatNachricht {
  rolle: ChatRolle;
  text: string;
  modell: string | null;
}
