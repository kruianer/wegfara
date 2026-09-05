import type { PoiType } from "./types";

/**
 * Die von Hand aenderbaren Angaben eines POI (req-035). Nummer und Status
 * stehen nicht darunter: die Nummer aendert sich nie (req-013), und der
 * Status wird vom Google-Import ohnehin nicht angefasst (req-026).
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
 * der Google-Import und die Aenderung von Hand miteinander abgeglichen
 * werden. `position` fasst lat und lng zusammen: eine verschobene Position
 * ist eine Aenderung, nicht zwei.
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

/**
 * Was beim Auffrischen aus einem Google-Maps-Link tatsaechlich geschrieben
 * wird (req-035): von Hand geaenderte Angaben bleiben stehen, alle uebrigen
 * uebernehmen den Stand von Google. Ohne diese Regel waere jede Korrektur
 * beim naechsten Import wieder weg.
 */
export function mergeGooglePoiUpdate(
  vorhanden: PoiFieldValues,
  ausGoogle: PoiFieldValues,
  manuell: readonly ManualPoiField[],
): PoiFieldValues {
  const behalten = (field: ManualPoiField) => manuell.includes(field);
  return {
    name: behalten("name") ? vorhanden.name : ausGoogle.name,
    // Der Ort wird beim Auffrischen immer neu abgeleitet, nie als von Hand
    // geaendert uebersprungen (req-041).
    ort: ausGoogle.ort,
    type: behalten("type") ? vorhanden.type : ausGoogle.type,
    // Ein selbst geschriebener Text ueberlebt das Auffrischen aus demselben
    // Link, wie die uebrigen von Hand geaenderten Angaben (req-044).
    shortText: behalten("shortText")
      ? vorhanden.shortText
      : ausGoogle.shortText,
    longText: behalten("longText") ? vorhanden.longText : ausGoogle.longText,
    lat: behalten("position") ? vorhanden.lat : ausGoogle.lat,
    lng: behalten("position") ? vorhanden.lng : ausGoogle.lng,
    web: behalten("web") ? vorhanden.web : ausGoogle.web,
    address: behalten("address") ? vorhanden.address : ausGoogle.address,
    phone: behalten("phone") ? vorhanden.phone : ausGoogle.phone,
    openingHours: behalten("openingHours")
      ? vorhanden.openingHours
      : ausGoogle.openingHours,
  };
}
