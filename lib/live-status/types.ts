import type { Activity } from "@/lib/activities/types";

/**
 * Was zur aktuellen Uhrzeit unter "Laut Plan" steht (req-051): der gerade
 * laufende Programmpunkt, sonst der naechste anstehende des Tages. Ist
 * heute nichts mehr geplant, gibt es keinen.
 */
export type PlanEintrag =
  | { art: "laufend"; activity: Activity }
  | { art: "naechster"; activity: Activity }
  | null;

/**
 * Der Verzug, den die Status-Pille zeigt (req-051):
 * - `im_zeitplan`   -- am Ort oder weniger als 5 Fahrminuten entfernt,
 * - `verspaetet`    -- so viele Fahrminuten liegen zwischen Ist und Soll,
 * - `unbekannt`     -- der Routing-Dienst ist nicht erreichbar,
 * - `keiner`        -- nicht berechenbar: niemand teilt seine Position,
 *                      oder es laeuft gerade kein Programmpunkt.
 */
export type Verzug =
  | { art: "im_zeitplan" }
  | { art: "verspaetet"; minuten: number }
  | { art: "unbekannt" }
  | { art: "keiner" };

/**
 * Was der Server zur Lage beisteuert: der Ort unter "Laut GPS" und der
 * daraus errechnete Verzug. `ort` ist null, wenn niemand seine Position
 * teilt -- dann bleibt die Spalte "Laut GPS" ganz weg.
 */
export interface Standortlage {
  ort: string | null;
  verzug: Verzug;
}

/** Solange niemand seine Position teilt, gibt es weder Ort noch Verzug. */
export const OHNE_STANDORT: Standortlage = {
  ort: null,
  verzug: { art: "keiner" },
};
