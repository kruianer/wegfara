import type { WebSucheFehlerArt } from "../ai/fehler";

/**
 * Der Verlauf des Chatfensters im Planer (req-081): eigene Nachrichten und
 * die Antworten der KI, in zeitlicher Folge.
 */

/** Von wem eine Nachricht kommt. */
export type ChatRolle = "ich" | "ki";

/**
 * Eine Quelle, auf die sich eine Antwort beruft (req-092): die Adresse und
 * der Titel der Seite, wie der Dienst sie nennt.
 */
export interface ChatQuelle {
  url: string;
  titel: string;
}

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
  /**
   * Die Quellen einer Antwort, die auf einer Web-Suche beruht (req-092) --
   * leer, wenn nicht gesucht wurde, und bei einer eigenen Nachricht immer.
   */
  quellen: ChatQuelle[];
  /** Warum eine Suche waehrend der Antwort scheiterte -- sonst null. */
  sucheFehler: WebSucheFehlerArt | null;
  createdAt: string;
}

/** Was eine neue Nachricht mitbringt -- Kennung und Zeit entstehen beim Ablegen. */
export interface NeueChatNachricht {
  rolle: ChatRolle;
  text: string;
  modell: string | null;
  /** Nur bei einer Antwort: ihre Quellen (req-092). */
  quellen?: ChatQuelle[];
  /** Nur bei einer Antwort: der Grund einer gescheiterten Suche. */
  sucheFehler?: WebSucheFehlerArt | null;
}
