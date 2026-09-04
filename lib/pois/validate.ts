import type { Poi, PoiPosition, PoiStatus, PoiType, PoiValues } from "./types";

/**
 * Was beim Anlegen und Aendern eines POI von Hand erfasst wird (req-035).
 * Erforderlich sind Name, Ort, Typ und Position; alles Weitere darf leer
 * bleiben. Die Nummer steht bewusst nicht darin -- sie bleibt nach der
 * Vergabe fest (req-013).
 */
export interface PoiInput {
  name: string;
  ort: string;
  type: PoiType;
  /** null heisst: noch keine gewaehlt -- gespeichert wird so nicht. */
  position: PoiPosition | null;
  status: PoiStatus;
  address: string;
  web: string;
  phone: string;
  /** Eine Zeile je Wochentag, wie in der Datenbank (req-026). */
  openingHours: string;
}

export type PoiInputField = keyof PoiInput;

export type PoiFieldErrors = Partial<Record<PoiInputField, string>>;

export const POI_NAME_MAX_LENGTH = 120;
export const POI_ORT_MAX_LENGTH = 120;
export const POI_ADDRESS_MAX_LENGTH = 200;
export const POI_WEB_MAX_LENGTH = 300;
export const POI_PHONE_MAX_LENGTH = 40;
export const POI_OPENING_HOURS_MAX_LENGTH = 500;

/** Ein leeres Formular: Typ und Status stehen auf ihrer Vorgabe (req-035). */
export function emptyPoiInput(): PoiInput {
  return {
    name: "",
    ort: "",
    type: "sehenswuerdigkeit",
    position: null,
    status: "weiss_nicht",
    address: "",
    web: "",
    phone: "",
    openingHours: "",
  };
}

/** Die Angaben eines vorhandenen POI als Formularstand. */
export function poiToInput(poi: Poi): PoiInput {
  return {
    name: poi.name,
    ort: poi.ort,
    type: poi.type,
    position: poi.position,
    status: poi.status,
    address: poi.address ?? "",
    web: poi.web ?? "",
    phone: poi.phone ?? "",
    openingHours: (poi.openingHours ?? []).join("\n"),
  };
}

/**
 * Eine eingetippte Webadresse ohne Schema ist keine, mit der ein Klick
 * weiterfuehrt -- statt sie abzuweisen, wird das gaengige Schema ergaenzt
 * (Vision: wenige Schritte statt viele Optionen).
 */
export function normalizeWeb(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}

function tooLong(value: string, max: number): boolean {
  return value.trim().length > max;
}

/**
 * Prueft die Eingaben eines POI-Formulars (req-035). Dieselbe Pruefung
 * laeuft in der Oberflaeche und in der Schnittstelle -- ein Aufruf an der
 * Oberflaeche vorbei kommt daran nicht vorbei.
 */
export function validatePoiInput(input: PoiInput): PoiFieldErrors {
  const errors: PoiFieldErrors = {};

  if (input.name.trim().length === 0) {
    errors.name = "Ein Name wird gebraucht.";
  } else if (tooLong(input.name, POI_NAME_MAX_LENGTH)) {
    errors.name = `Der Name darf höchstens ${POI_NAME_MAX_LENGTH} Zeichen haben.`;
  }

  if (input.ort.trim().length === 0) {
    errors.ort = "Ein Ort wird gebraucht.";
  } else if (tooLong(input.ort, POI_ORT_MAX_LENGTH)) {
    errors.ort = `Der Ort darf höchstens ${POI_ORT_MAX_LENGTH} Zeichen haben.`;
  }

  if (!input.position) {
    errors.position =
      "Eine Position wird gebraucht — über die Ortssuche oder einen Klick auf die Karte.";
  }

  if (tooLong(input.address, POI_ADDRESS_MAX_LENGTH)) {
    errors.address = `Die Adresse darf höchstens ${POI_ADDRESS_MAX_LENGTH} Zeichen haben.`;
  }
  if (tooLong(normalizeWeb(input.web), POI_WEB_MAX_LENGTH)) {
    errors.web = `Die Webseite darf höchstens ${POI_WEB_MAX_LENGTH} Zeichen haben.`;
  }
  if (tooLong(input.phone, POI_PHONE_MAX_LENGTH)) {
    errors.phone = `Die Telefonnummer darf höchstens ${POI_PHONE_MAX_LENGTH} Zeichen haben.`;
  }
  if (tooLong(input.openingHours, POI_OPENING_HOURS_MAX_LENGTH)) {
    errors.openingHours = `Die Öffnungszeiten dürfen höchstens ${POI_OPENING_HOURS_MAX_LENGTH} Zeichen haben.`;
  }

  return errors;
}

export function poiInputIsValid(input: PoiInput): boolean {
  return Object.keys(validatePoiInput(input)).length === 0;
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Der gepruefte Formularstand als die Angaben, die gespeichert werden.
 * Setzt eine gueltige Eingabe voraus (siehe poiInputIsValid) -- ohne
 * Position gibt es nichts zu speichern.
 */
export function poiInputToValues(input: PoiInput): PoiValues | null {
  if (!poiInputIsValid(input) || !input.position) return null;

  const zeilen = input.openingHours
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0);

  return {
    name: input.name.trim(),
    ort: input.ort.trim(),
    type: input.type,
    position: input.position,
    status: input.status,
    web: optional(normalizeWeb(input.web)),
    address: optional(input.address),
    phone: optional(input.phone),
    openingHours: zeilen.length > 0 ? zeilen : null,
  };
}
