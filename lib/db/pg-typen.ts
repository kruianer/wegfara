import { types } from "pg";
import type { CustomTypesConfig } from "pg";

/** `timestamp without time zone` -- die Spalten `start_at`/`end_at`. */
export const TIMESTAMP_OID = 1114;

/**
 * Wie der Treiber Spaltenwerte wandelt (bug-071). Ein `timestamp without
 * time zone` bleibt die Zeichenkette, die PostgreSQL liefert: die Spalte
 * kennt keine Zeitzone, also soll ihr Wert auch keine bekommen. Der Treiber
 * selbst machte daraus ein Date in der Ortszeit des Prozesses -- im
 * UTC-Container fiel das nicht auf, auf dem Runner am Beelink
 * (Europe/Berlin) verschob es jede Uhrzeit um den Zonenversatz. Der
 * Begleiter schickte die Wahl einer Options-Gruppe unter der verschobenen
 * Uhrzeit zurueck, und nach dem Neuladen passte sie zu keiner Gruppe mehr.
 *
 * Alle uebrigen Typen wandelt der Treiber wie gewohnt.
 */
export const PG_TYPEN: CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: "text" | "binary") => {
    if (oid === TIMESTAMP_OID && format !== "binary") {
      return (wert: string) => wert;
    }
    return types.getTypeParser(oid, format);
  }) as CustomTypesConfig["getTypeParser"],
};
