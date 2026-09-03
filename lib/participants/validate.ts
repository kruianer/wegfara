import { isPlausibleEmail, normalizeEmail } from "../auth/email";
import { isValidIban, normalizeIban } from "./iban";

/** Hoechstlaenge des Namens einer Person (siehe req-019, "Funktion"). */
export const PARTICIPANT_NAME_MAX_LENGTH = 80;

/** Hoechstlaenge des Nicknamens einer Person (siehe req-020, "Funktion"). */
export const PARTICIPANT_NICKNAME_MAX_LENGTH = 20;

/** Die Eingaben zu einer Person, bevor sie geprueft sind. */
export interface ParticipantDraft {
  name: string;
  /** Darf leer bleiben (req-020). */
  nickname: string;
  /** Darf leer bleiben (req-019). */
  email: string;
  /** Darf leer bleiben (req-019). */
  phone: string;
  /** Darf leer bleiben (req-019). */
  iban: string;
}

/** Eine geprueft zulaessige Eingabe, wie sie gespeichert wird. */
export interface ParticipantInput {
  name: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
}

export type ParticipantField = keyof ParticipantDraft;

export type ParticipantFieldErrors = Partial<Record<ParticipantField, string>>;

/**
 * Die Rueckmeldungen zu unzulaessigen Eingaben. Sie benennen die betroffene
 * Stelle (siehe req-019) und stehen hier an einer Stelle, damit Karte und
 * Schnittstelle dieselben verwenden.
 */
export const PARTICIPANT_ERRORS = {
  nameRequired: "Ein Name ist erforderlich.",
  nameTooLong: `Der Name darf höchstens ${PARTICIPANT_NAME_MAX_LENGTH} Zeichen lang sein.`,
  nicknameTooLong: `Der Nickname darf höchstens ${PARTICIPANT_NICKNAME_MAX_LENGTH} Zeichen lang sein.`,
  emailInvalid: "Das ist keine gültige E-Mail-Adresse.",
  emailTaken: "Diese E-Mail-Adresse gehört bereits zu einer anderen Person.",
  emailRequiredForLogin:
    "Diese Adresse wird für die Anmeldung gebraucht und darf nicht leer bleiben.",
  ibanInvalid: "Das ist keine gültige Bankverbindung (IBAN).",
} as const;

/**
 * Prueft die Eingaben zu einer Person (siehe req-019): Name erforderlich
 * und hoechstens 80 Zeichen; Nickname, E-Mail-Adresse, Telefonnummer und
 * Bankverbindung duerfen leer bleiben. Ein angegebener Nickname ist
 * hoechstens 20 Zeichen lang (req-020), eine angegebene Adresse muss eine
 * Adresse sein, eine angegebene Bankverbindung eine gueltige IBAN samt
 * Pruefziffer.
 *
 * Die Eindeutigkeit der Adresse laesst sich hier nicht pruefen -- dafuer
 * braucht es die uebrigen Personen des Accounts (siehe
 * app/api/participants/route.ts).
 *
 * Liefert je betroffenem Feld eine Rueckmeldung; ein leeres Ergebnis heisst
 * "zulaessig".
 */
export function validateParticipantDraft(
  draft: ParticipantDraft,
  options: {
    /** true fuer eine Person mit Zugang -- ohne Adresse kaeme sie nicht mehr hinein. */
    emailRequired?: boolean;
  } = {},
): ParticipantFieldErrors {
  const errors: ParticipantFieldErrors = {};

  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = PARTICIPANT_ERRORS.nameRequired;
  } else if (name.length > PARTICIPANT_NAME_MAX_LENGTH) {
    errors.name = PARTICIPANT_ERRORS.nameTooLong;
  }

  // Der Nickname ist freiwillig -- er ersetzt den Namen nur in der Anzeige
  // und kann ihn deshalb nicht ersetzen, wo er fehlt (req-020).
  const nickname = draft.nickname.trim();
  if (nickname.length > PARTICIPANT_NICKNAME_MAX_LENGTH) {
    errors.nickname = PARTICIPANT_ERRORS.nicknameTooLong;
  }

  const email = draft.email.trim();
  if (email.length === 0) {
    if (options.emailRequired) {
      errors.email = PARTICIPANT_ERRORS.emailRequiredForLogin;
    }
  } else if (!isPlausibleEmail(email)) {
    errors.email = PARTICIPANT_ERRORS.emailInvalid;
  }

  const iban = draft.iban.trim();
  if (iban.length > 0 && !isValidIban(iban)) {
    errors.iban = PARTICIPANT_ERRORS.ibanInvalid;
  }

  return errors;
}

/** Ob die Eingaben gespeichert werden duerfen. */
export function participantDraftIsValid(
  draft: ParticipantDraft,
  options: { emailRequired?: boolean } = {},
): boolean {
  return Object.keys(validateParticipantDraft(draft, options)).length === 0;
}

/**
 * Bringt eine gepruefte Eingabe in die Form, in der sie abgelegt wird:
 * ohne umgebende Leerzeichen, Adresse einheitlich klein geschrieben, IBAN
 * ohne Leerzeichen -- Leergelassenes wird zu null.
 */
export function toParticipantInput(draft: ParticipantDraft): ParticipantInput {
  const nickname = draft.nickname.trim();
  const email = draft.email.trim();
  const phone = draft.phone.trim();
  const iban = draft.iban.trim();
  return {
    name: draft.name.trim(),
    nickname: nickname.length > 0 ? nickname : null,
    email: email.length > 0 ? normalizeEmail(email) : null,
    phone: phone.length > 0 ? phone : null,
    iban: iban.length > 0 ? normalizeIban(iban) : null,
  };
}
