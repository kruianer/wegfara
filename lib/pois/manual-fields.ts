import type { PoiType } from "./types";

/**
 * Die von Hand aenderbaren Angaben eines POI (req-035) -- dieselben, die das
 * Suchfeld des Formulars aus einer Quelle fuellen kann (req-048). Nummer und
 * Status stehen nicht darunter: die Nummer aendert sich nie (req-013), und
 * der Status beschreibt, wie die Gruppe zu dem Ort steht, nicht den Ort.
 *
 * Der Ort steht seit req-041 ebenfalls nicht mehr darunter: er wird nicht
 * mehr von Hand gesetzt, sondern beim Speichern abgeleitet. Ein noch aus der
 * Zeit davor vermerktes "ort" wird beim Lesen uebergangen.
 */
export const MANUAL_POI_FIELDS = [
  "name",
  "type",
  "shortText",
  "longText",
  "position",
  "web",
  "address",
  "phone",
  "openingHours",
] as const;

export type ManualPoiField = (typeof MANUAL_POI_FIELDS)[number];

/**
 * Die Werte eines POI, wie sie in der Datenbank stehen -- die Form, in der
 * der gespeicherte Stand mit dem neuen verglichen wird. `position` fasst lat
 * und lng zusammen: eine verschobene Position ist eine Aenderung, nicht zwei.
 */
export interface PoiFieldValues {
  name: string;
  ort: string;
  type: PoiType;
  shortText: string | null;
  longText: string | null;
  lat: number;
  lng: number;
  web: string | null;
  address: string | null;
  phone: string | null;
  openingHours: string | null;
}

function isManualPoiField(value: string): value is ManualPoiField {
  return (MANUAL_POI_FIELDS as readonly string[]).includes(value);
}

/**
 * Die Vereinigung zweier Mengen von Angaben, in der Reihenfolge oben --
 * gebraucht, wenn das Suchfeld mehrfach fuellt (req-048).
 */
export function vereinigteFelder(
  eine: readonly ManualPoiField[],
  andere: readonly ManualPoiField[],
): ManualPoiField[] {
  return MANUAL_POI_FIELDS.filter(
    (field) => eine.includes(field) || andere.includes(field),
  );
}

/**
 * Was von Hand geaendert wurde: alles Geaenderte ausser dem, was das
 * Suchfeld selbst gefuellt hat (req-048). Was aus einer Quelle kommt, gilt
 * nicht als von Hand geaendert -- ein spaeteres Auffrischen aus Google darf
 * es ersetzen.
 */
export function ohneGefuellteFelder(
  geaendert: readonly ManualPoiField[],
  gefuellt: readonly ManualPoiField[],
): ManualPoiField[] {
  return geaendert.filter((field) => !gefuellt.includes(field));
}

/** Liest die Spalte `poi.manual_fields` -- kommagetrennt, leer erlaubt. */
export function parseManualFields(raw: string | null): ManualPoiField[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter(isManualPoiField);
}

/** Schreibt die Spalte `poi.manual_fields` in der Reihenfolge oben. */
export function serializeManualFields(
  fields: readonly ManualPoiField[],
): string {
  return MANUAL_POI_FIELDS.filter((field) => fields.includes(field)).join(",");
}

/** Welche Angaben sich zwischen zwei Staenden unterscheiden. */
export function changedPoiFields(
  vorher: PoiFieldValues,
  nachher: PoiFieldValues,
): ManualPoiField[] {
  return MANUAL_POI_FIELDS.filter((field) =>
    field === "position"
      ? vorher.lat !== nachher.lat || vorher.lng !== nachher.lng
      : vorher[field] !== nachher[field],
  );
}

/**
 * Die Kennzeichnung nach einer Aenderung von Hand: was schon als von Hand
 * geaendert galt, bleibt es -- eine spaetere Aenderung nimmt nichts zurueck.
 */
export function withManualFields(
  vorhanden: readonly ManualPoiField[],
  geaendert: readonly ManualPoiField[],
): ManualPoiField[] {
  return MANUAL_POI_FIELDS.filter(
    (field) => vorhanden.includes(field) || geaendert.includes(field),
  );
}
