/** Die Seiten und Schnittstellen der Account-Verwaltung (req-025). */

/**
 * Die Account-Verwaltung. Sie liegt im Planer, weil sie zur Verwaltung
 * gehoert und nicht nach unterwegs -- sichtbar ist sie ausschliesslich fuer
 * den Gesamt-Admin.
 */
export const ACCOUNTS_PATH = "/plan/accounts";

/** Wohin es nach einem Wechsel geht: in den Planer des gewaehlten Accounts. */
export const PLANNER_PATH = "/plan";

export const ACCOUNTS_API = "/api/accounts";
export const ACCOUNT_SWITCH_API = "/api/accounts/wechsel";
export const ACCOUNT_INVITATION_API = "/api/accounts/einladung";
