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

/** Ein Zugangslink aus einer Einladung war abgelaufen oder schon benutzt. */
export const INVITATION_INVALID_NOTICE =
  "Dieser Zugangslink ist abgelaufen oder wurde bereits verwendet. Bitte lass dir vom Reiseleiter einen neuen geben.";

/**
 * Ein Gastlink war widerrufen oder abgelaufen (req-038). Ein Gast hat kein
 * Konto -- ihm hilft nur ein neuer Link vom Reiseleiter, nicht die
 * Anmeldung.
 */
export const GUEST_ACCESS_INVALID_NOTICE =
  "Dieser Gastzugang gilt nicht mehr. Bitte lass dir vom Reiseleiter einen neuen Link geben.";

/**
 * Die Sitzung endet, sobald jemand keiner freigegebenen Reise mehr
 * zugeordnet ist (req-023). Die Anmeldeseite nennt den Grund -- sonst
 * sieht es wie ein Fehler aus.
 */
export const NO_ACTIVE_TRIP_NOTICE =
  "Du bist derzeit keiner laufenden Reise zugeordnet. Sobald dich der Reiseleiter einer freigegebenen Reise zuordnet, kannst du dich wieder anmelden.";

/**
 * Womit die Anmeldeseite aufgerufen wurde -- der Grund steht in der
 * Adresszeile (`?fehler=`) und ueberlebt so die Weiterleitung.
 */
export const LOGIN_ERRORS = [
  "link",
  "einladung",
  "gastzugang",
  "keine-reise",
] as const;

export type LoginError = (typeof LOGIN_ERRORS)[number];

export const LOGIN_ERROR_NOTICE: Record<LoginError, string> = {
  link: LOGIN_LINK_INVALID_NOTICE,
  einladung: INVITATION_INVALID_NOTICE,
  gastzugang: GUEST_ACCESS_INVALID_NOTICE,
  "keine-reise": NO_ACTIVE_TRIP_NOTICE,
};

export function isLoginError(value: unknown): value is LoginError {
  return (
    typeof value === "string" &&
    (LOGIN_ERRORS as readonly string[]).includes(value)
  );
}

/** Gemeinsame Rueckmeldung fuer jeden gescheiterten Anmeldeversuch. */
export const LOGIN_FAILED_NOTICE =
  "Anmeldung nicht möglich. Bitte versuche es erneut.";

export const PASSKEY_FAILED_NOTICE =
  "Die Anmeldung mit dem Passkey hat nicht geklappt. Nutze den Anmeldelink oder einen Notfallcode.";

export const PASSKEY_CREATED_NOTICE =
  "Der Passkey ist eingerichtet. Du kannst dich damit auf diesem Gerät anmelden.";

export const PASSKEY_SETUP_FAILED_NOTICE =
  "Der Passkey konnte nicht eingerichtet werden.";
