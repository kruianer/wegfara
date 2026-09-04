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

/**
 * Die Ersteinrichtung einer leeren Umgebung (req-037). Sie existiert nur,
 * solange die Tabelle `participant` leer ist -- danach fuehrt auch die direkte
 * URL zurueck auf die Anmeldeseite.
 */
export const SETUP_PATH = "/ersteinrichtung";
export const SETUP_API = "/api/auth/ersteinrichtung";

export const LOGIN_LINK_PATH = "/anmeldung/link";
export const LOGIN_LINK_API = "/api/auth/anmeldelink";
export const RECOVERY_CODE_LOGIN_API = "/api/auth/notfallcode";
export const RECOVERY_CODES_API = "/api/auth/notfallcodes";
export const LOGOUT_API = "/api/auth/abmelden";
/** "Ueberall abmelden" -- alle Sitzungen des Kontos, auch diese (req-037). */
export const LOGOUT_ALL_API = "/api/auth/abmelden/ueberall";
/** "Meine Geraete": ein Passkey samt seiner Sitzungen (req-037). */
export const DEVICES_API = "/api/auth/geraete";
export const PASSKEY_LOGIN_API = "/api/auth/passkey/anmeldung";
export const PASSKEY_REGISTRATION_API = "/api/auth/passkey/registrierung";
