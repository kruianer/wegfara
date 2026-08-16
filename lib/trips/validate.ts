import type { MainPlace } from "./types";
import { isIsoDate } from "./date-utils";

/** Hoechstlaenge des Reisetitels (siehe req-017, "Regeln für die Eingaben"). */
export const TRIP_TITLE_MAX_LENGTH = 80;

/** Die Eingaben einer Reise, bevor sie geprueft sind. */
export interface TripDraft {
  title: string;
  /** ISO-Datum (YYYY-MM-DD), ohne Uhrzeit. */
  startDate: string;
  /** ISO-Datum (YYYY-MM-DD), ohne Uhrzeit. */
  endDate: string;
  /** null, solange in der Ortssuche noch nichts gewaehlt wurde. */
  mainPlace: MainPlace | null;
}

/** Eine geprueft vollstaendige Reise-Eingabe. */
export interface TripInput extends TripDraft {
  mainPlace: MainPlace;
}

export type TripField = keyof TripDraft;

export type TripFieldErrors = Partial<Record<TripField, string>>;

/**
 * Die Rueckmeldungen zu unzulaessigen Eingaben. Sie benennen die betroffene
 * Stelle (siehe req-017) und stehen hier an einer Stelle, damit Formular und
 * Schnittstelle dieselben verwenden.
 */
export const TRIP_ERRORS = {
  titleRequired: "Ein Titel ist erforderlich.",
  titleTooLong: `Der Titel darf höchstens ${TRIP_TITLE_MAX_LENGTH} Zeichen lang sein.`,
  startRequired: "Ein Beginn ist erforderlich.",
  startInvalid: "Der Beginn ist kein gültiges Datum.",
  endRequired: "Ein Ende ist erforderlich.",
  endInvalid: "Das Ende ist kein gültiges Datum.",
  endBeforeStart: "Das Ende darf nicht vor dem Beginn liegen.",
  mainPlaceRequired:
    "Ein Hauptort ist erforderlich — bitte aus der Suche wählen.",
} as const;

/**
 * Prueft die Eingaben einer Reise (siehe req-017): Titel erforderlich und
 * hoechstens 80 Zeichen, Beginn und Ende erforderlich, das Ende nicht vor dem
 * Beginn, Hauptort erforderlich. Zurueckliegende Zeitraeume sind zulaessig,
 * damit vergangene Reisen nachgetragen werden koennen.
 *
 * Liefert je betroffenem Feld eine Rueckmeldung; ein leeres Ergebnis heisst
 * "zulaessig".
 */
export function validateTripDraft(draft: TripDraft): TripFieldErrors {
  const errors: TripFieldErrors = {};

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = TRIP_ERRORS.titleRequired;
  } else if (title.length > TRIP_TITLE_MAX_LENGTH) {
    errors.title = TRIP_ERRORS.titleTooLong;
  }

  if (draft.startDate.length === 0) {
    errors.startDate = TRIP_ERRORS.startRequired;
  } else if (!isIsoDate(draft.startDate)) {
    errors.startDate = TRIP_ERRORS.startInvalid;
  }

  if (draft.endDate.length === 0) {
    errors.endDate = TRIP_ERRORS.endRequired;
  } else if (!isIsoDate(draft.endDate)) {
    errors.endDate = TRIP_ERRORS.endInvalid;
  } else if (!errors.startDate && draft.endDate < draft.startDate) {
    errors.endDate = TRIP_ERRORS.endBeforeStart;
  }

  if (!draft.mainPlace) {
    errors.mainPlace = TRIP_ERRORS.mainPlaceRequired;
  }

  return errors;
}

/** Ob die Eingaben gespeichert werden duerfen. */
export function tripDraftIsValid(draft: TripDraft): draft is TripInput {
  return Object.keys(validateTripDraft(draft)).length === 0;
}
