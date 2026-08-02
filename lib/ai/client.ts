/**
 * Austauschbare Schnittstelle zum Sprachmodell (siehe stack.md): ein
 * spaeterer Wechsel auf ein lokales Modell (Ollama) darf die aufrufende
 * Logik nicht veraendern.
 */
export interface AiClient {
  /** Fragt das Sprachmodell und liefert die Antwort als Text, oder null bei einem Fehler. */
  complete(prompt: string): Promise<string | null>;
}
