import { isPlausibleEmail, normalizeEmail } from "../auth/email";
import { PARTICIPANT_NAME_MAX_LENGTH } from "../participants/validate";

/** Hoechstlaenge des Namens eines Accounts -- wie beim Namen einer Person. */
export const ACCOUNT_NAME_MAX_LENGTH = 80;

/** Die Eingaben zu einem neuen Account, bevor sie geprueft sind (req-025). */
export interface AccountDraft {
  /** Der Name des Accounts, z.B. "Familie Huber". */
  name: string;
  /** Der Name der ersten Person, z.B. "Anna Huber". */
  personName: string;
  /** Ihre E-Mail-Adresse -- ueber sie ist der Account erreichbar. */
  personEmail: string;
}

/** Eine geprueft zulaessige Eingabe, wie sie gespeichert wird. */
export interface AccountInput {
  name: string;
  personName: string;
  personEmail: string;
}

export type AccountField = keyof AccountDraft;

export type AccountFieldErrors = Partial<Record<AccountField, string>>;

/**
 * Die Rueckmeldungen zu unzulaessigen Eingaben. Sie stehen hier an einer
 * Stelle, damit Oberflaeche und Schnittstelle dieselben verwenden.
 */
export const ACCOUNT_ERRORS = {
  nameRequired: "Ein Name ist erforderlich.",
  nameTooLong: `Der Name darf höchstens ${ACCOUNT_NAME_MAX_LENGTH} Zeichen lang sein.`,
  personNameRequired: "Ein Name der ersten Person ist erforderlich.",
  personNameTooLong: `Der Name darf höchstens ${PARTICIPANT_NAME_MAX_LENGTH} Zeichen lang sein.`,
  emailRequired: "Eine E-Mail-Adresse ist erforderlich.",
  emailInvalid: "Das ist keine gültige E-Mail-Adresse.",
  emailTaken: "Diese E-Mail-Adresse ist bereits vergeben.",
  failed: "Der Bereich konnte nicht angelegt werden.",
} as const;

/**
 * Prueft die Eingaben zu einem neuen Account (req-025): Name des Accounts
 * und Name der ersten Person sind erforderlich, ihre E-Mail-Adresse
 * ebenfalls -- zu jedem neuen Account gehoert genau eine erste Person, und
 * ohne Adresse liesse sie sich nicht erreichen.
 *
 * Ob die Adresse schon vergeben ist, laesst sich hier nicht pruefen; dafuer
 * braucht es die Datenbank (siehe app/api/accounts/route.ts).
 */
export function validateAccountDraft(draft: AccountDraft): AccountFieldErrors {
  const errors: AccountFieldErrors = {};

  const name = draft.name.trim();
  if (name.length === 0) {
    errors.name = ACCOUNT_ERRORS.nameRequired;
  } else if (name.length > ACCOUNT_NAME_MAX_LENGTH) {
    errors.name = ACCOUNT_ERRORS.nameTooLong;
  }

  const personName = draft.personName.trim();
  if (personName.length === 0) {
    errors.personName = ACCOUNT_ERRORS.personNameRequired;
  } else if (personName.length > PARTICIPANT_NAME_MAX_LENGTH) {
    errors.personName = ACCOUNT_ERRORS.personNameTooLong;
  }

  const email = draft.personEmail.trim();
  if (email.length === 0) {
    errors.personEmail = ACCOUNT_ERRORS.emailRequired;
  } else if (!isPlausibleEmail(email)) {
    errors.personEmail = ACCOUNT_ERRORS.emailInvalid;
  }

  return errors;
}

/** Bringt eine gepruefte Eingabe in die Form, in der sie abgelegt wird. */
export function toAccountInput(draft: AccountDraft): AccountInput {
  return {
    name: draft.name.trim(),
    personName: draft.personName.trim(),
    personEmail: normalizeEmail(draft.personEmail.trim()),
  };
}
