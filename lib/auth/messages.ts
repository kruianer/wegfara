/**
 * Die Rueckmeldungen der Anmeldung an einer Stelle -- Schnittstelle und
 * Anmeldeseite muessen wortgleich dasselbe sagen.
 */

/**
 * Bei bekannter und unbekannter Adresse identisch: die Rueckmeldung darf
 * nicht verraten, welche Adressen hinterlegt sind (req-016).
 */
export const LOGIN_LINK_NOTICE =
  "Sofern die Adresse hinterlegt ist, wurde eine Nachricht mit einem Anmeldelink versandt.";

/** Ein Anmeldelink war abgelaufen oder bereits verwendet. */
export const LOGIN_LINK_INVALID_NOTICE =
  "Dieser Anmeldelink ist abgelaufen oder wurde bereits verwendet. Fordere bitte einen neuen an.";

/** Gemeinsame Rueckmeldung fuer jeden gescheiterten Anmeldeversuch. */
export const LOGIN_FAILED_NOTICE =
  "Anmeldung nicht möglich. Bitte versuche es erneut.";

export const PASSKEY_FAILED_NOTICE =
  "Die Anmeldung mit dem Passkey hat nicht geklappt. Nutze den Anmeldelink oder einen Notfallcode.";

export const PASSKEY_CREATED_NOTICE =
  "Der Passkey ist eingerichtet. Du kannst dich damit auf diesem Gerät anmelden.";

export const PASSKEY_SETUP_FAILED_NOTICE =
  "Der Passkey konnte nicht eingerichtet werden.";
