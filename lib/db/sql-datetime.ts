/**
 * Wandelt einen timestamp-Wert aus der DB in "YYYY-MM-DDTHH:mm" (Ortszeit am
 * Reiseziel, ohne Zeitzone). `timestamp without time zone`-Spalten liefert der
 * Treiber als Date, dessen Komponenten er als UTC interpretiert hat, egal in
 * welcher Zeitzone der Prozess läuft — deshalb werden hier die UTC-Getter
 * gelesen, nicht die lokalen. Lokale Getter würden die Uhrzeit um den
 * Zonenversatz der ausführenden Umgebung verschieben.
 */
export function toIsoDateTimeString(value: unknown): string {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    const hours = String(value.getUTCHours()).padStart(2, "0");
    const minutes = String(value.getUTCMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  return String(value).slice(0, 16).replace(" ", "T");
}
