import type { AiFehler } from "./fehler";

/**
 * Was auf eine Frage an das Sprachmodell zurueckkommt: entweder der Text
 * oder der Grund, warum es keinen gibt (bug-032). Ein blosses null liess den
 * Aufrufer raten und den Nutzer bei seinem Zugangsschluessel suchen.
 */
export type AiAntwort =
  | { ok: true; text: string }
  | { ok: false; fehler: AiFehler };

/**
 * Austauschbare Schnittstelle zum Sprachmodell (siehe stack.md): ein
 * spaeterer Wechsel auf ein lokales Modell (Ollama) darf die aufrufende
 * Logik nicht veraendern.
 */
export interface AiClient {
  /** Fragt das Sprachmodell und liefert die Antwort als Text — oder den Grund, warum nicht. */
  complete(prompt: string): Promise<AiAntwort>;
  /**
   * Wie complete, aber das Modell darf dabei im Web nachschlagen (req-058).
   * Fuer Fragen, deren Antwort nicht im Modell steht -- etwa was ein Ort
   * ist, den es nicht kennt.
   *
   * Ein Modell ohne Websuche beantwortet die Frage aus eigenem Wissen; der
   * Aufrufer bekommt dann eine Antwort, die stimmen kann, aber nicht
   * nachgeschlagen ist.
   */
  completeWithWebSearch(prompt: string): Promise<AiAntwort>;
}
