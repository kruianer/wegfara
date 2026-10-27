import type { AiFehler } from "./fehler";

/**
 * Der Katalog der Modelle, die der KI-Dienst anbietet (req-090) -- erfragt
 * beim Dienst und nicht im Quelltext gefuehrt: eine Liste hier veraltete
 * unbemerkt, die des Anbieters nie.
 *
 * Wie AiChatClient traegt die Schnittstelle keine Spur des SDKs (stack.md).
 */

/** Wo ein Modell in seinem Leben steht -- nur "active" kommt in eine Auswahl. */
export type ModellLebenslauf = "active" | "deprecated" | "retired";

export interface KatalogModell {
  /** Die Kennung fuer die Anfrage. */
  id: string;
  /** Der Name fuer Menschen, so wie der Dienst ihn nennt. */
  name: string;
  lebenslauf: ModellLebenslauf;
  /**
   * Die Reihe ("opus", "sonnet", "haiku", ...) aus dem Feld des Dienstes --
   * nie aus der Kennung geraten (req-090, Constraints). null, wenn das Modell
   * zu keiner Reihe gehoert.
   */
  reihe: string | null;
  /** Wie gross das Kontextfenster ist, in Token -- null, wenn unbekannt. */
  maxEingabeTokens: number | null;
}

export type KatalogErgebnis =
  | { modelle: KatalogModell[]; fehler: null }
  | { modelle: null; fehler: AiFehler };

export interface AiModellKatalog {
  /** Alle Modelle des Dienstes, in seiner Reihenfolge -- die neueren zuerst. */
  liste(): Promise<KatalogErgebnis>;
}
