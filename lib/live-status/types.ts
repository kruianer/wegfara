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
 * Der Verzug, den die Status-Pille zeigt (req-051, req-084):
 * - `im_zeitplan`     -- der laufende Programmpunkt: am Ort oder weniger
 *                        als 5 Fahrminuten entfernt ("ich bin da"),
 * - `ankunft_im_plan` -- der naechste Programmpunkt: die Fahrzeit reicht
 *                        bis zu seiner Startzeit, hoechstens knapp nicht
 *                        ("ich komme hin"),
 * - `verspaetet`      -- so viele Minuten zu spaet; beim laufenden Punkt die
 *                        Fahrzeit, beim naechsten ihre Ueberschreitung der
 *                        Startzeit,
 * - `unbekannt`       -- der Routing-Dienst ist nicht erreichbar,
 * - `keiner`          -- nicht berechenbar: niemand teilt seine Position,
 *                        der geplante Punkt hat keinen Ort, oder heute ist
 *                        nichts mehr geplant.
 *
 * `stand` steht nur, wenn der Routing-Dienst gerade ausfaellt und die
 * Fahrzeit aus einer frueheren Abfrage stammt (bug-067): der Zeitpunkt, zu
 * dem sie ermittelt wurde, als ISO-Zeitstempel.
 */
export type Verzug =
  | { art: "im_zeitplan"; stand?: string }
  | { art: "ankunft_im_plan"; stand?: string }
  | { art: "verspaetet"; minuten: number; stand?: string }
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
