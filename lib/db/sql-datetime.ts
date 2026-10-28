/**
 * Wandelt einen timestamp-Wert aus der DB in "YYYY-MM-DDTHH:mm" (Ortszeit am
 * Reiseziel, ohne Zeitzone). Aus PostgreSQL kommen `timestamp without time
 * zone`-Spalten seit bug-071 als Zeichenkette (siehe `PG_TYPEN` in
 * pg-typen.ts) -- der Treiber hatte daraus ein Date in der Ortszeit des
 * Prozesses gemacht, und die UTC-Getter unten verschoben die Uhrzeit dann um
 * den Zonenversatz. Ein Date liefert nur noch die Datenbank im
 * Arbeitsspeicher der Tests; sie legt die Komponenten in UTC ab.
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
