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

/**
 * Ein Modell aus dem Katalog von OpenAI (req-108). `GET /v1/models` nennt
 * keinen Lebenslauf und keinen Namen fuer Menschen -- nur die Kennung und
 * hoechstens ein Abschaltdatum. Mehr wird hier nicht behauptet: auch nicht,
 * ob es Bilder oder Text erzeugt, denn das nennt der Dienst nicht.
 */
export interface OpenAiKatalogModell {
  /** Die Kennung fuer die Anfrage -- zugleich das, was in der Auswahl steht. */
  id: string;
  /**
   * Der Tag, an dem OpenAI das Modell abschaltet ("YYYY-MM-DD"), aus dem
   * optionalen Feld `shutdown_date`. null, wenn der Dienst keines nennt. Die
   * Liste enthaelt auch Modelle, deren Datum schon vergangen ist.
   */
  abschaltungAm: string | null;
}

export type KatalogErgebnis<M = KatalogModell> =
  | { modelle: M[]; fehler: null }
  | { modelle: null; fehler: AiFehler };

export interface AiModellKatalog<M = KatalogModell> {
  /** Alle Modelle des Dienstes, in seiner Reihenfolge -- die neueren zuerst. */
  liste(): Promise<KatalogErgebnis<M>>;
}
