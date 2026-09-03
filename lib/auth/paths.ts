/** Die Seiten und Schnittstellen der Anmeldung an einer Stelle. */

export const LOGIN_PATH = "/anmeldung";
export const RECOVERY_CODES_PATH = "/anmeldung/notfallcodes";
export const ACCOUNT_PATH = "/konto";

/**
 * Der Zugangslink einer Einladung (req-023). Bewusst kurz: er steht als
 * Text in der Einladung und steckt zugleich im QR-Code -- beides fuehrt an
 * dieselbe Stelle.
 */
export const INVITATION_PATH = "/einladung";
/** Nach dem Einloesen: hier richtet die eingeladene Person ihren Passkey ein. */
export const INVITATION_PASSKEY_PATH = "/einladung/passkey";
export const INVITATIONS_API = "/api/einladungen";

export const LOGIN_LINK_PATH = "/anmeldung/link";
export const LOGIN_LINK_API = "/api/auth/anmeldelink";
export const RECOVERY_CODE_LOGIN_API = "/api/auth/notfallcode";
export const RECOVERY_CODES_API = "/api/auth/notfallcodes";
export const LOGOUT_API = "/api/auth/abmelden";
export const PASSKEY_LOGIN_API = "/api/auth/passkey/anmeldung";
export const PASSKEY_REGISTRATION_API = "/api/auth/passkey/registrierung";
