/** Der Zweck eines Gastzugangs -- kurz, aber erforderlich (req-038). */
export const GUEST_PURPOSE_MAX_LENGTH = 80;

export const GUEST_ACCESS_ERRORS = {
  purposeRequired:
    "Gib einen Zweck an, damit später erkennbar ist, wem der Link gehört.",
  purposeTooLong: `Der Zweck darf höchstens ${GUEST_PURPOSE_MAX_LENGTH} Zeichen haben.`,
  tripRequired: "Wähle die Reise, die der Gast sehen darf.",
  failed: "Der Gastzugang konnte nicht erzeugt werden.",
} as const;

export type GuestAccessFieldErrors = {
  purpose?: string;
  tripId?: string;
  hours?: string;
};

export interface GuestAccessDraft {
  tripId: string;
  purpose: string;
}

/**
 * Prueft die Eingaben eines neuen Gastzugangs. Dieselbe Pruefung gilt in
 * der Oberflaeche und in der Schnittstelle -- ein Aufruf am Formular vorbei
 * legt keinen Zugang ohne Zweck an.
 */
export function validateGuestAccessDraft(
  draft: GuestAccessDraft,
): GuestAccessFieldErrors {
  const errors: GuestAccessFieldErrors = {};

  const purpose = draft.purpose.trim();
  if (purpose.length === 0) {
    errors.purpose = GUEST_ACCESS_ERRORS.purposeRequired;
  } else if (purpose.length > GUEST_PURPOSE_MAX_LENGTH) {
    errors.purpose = GUEST_ACCESS_ERRORS.purposeTooLong;
  }

  if (draft.tripId.trim().length === 0) {
    errors.tripId = GUEST_ACCESS_ERRORS.tripRequired;
  }

  return errors;
}
