import { LOGIN_PATH } from "./paths";

/** Wohin es nach der Anmeldung geht, wenn kein Ziel gemerkt wurde. */
export const DEFAULT_AFTER_LOGIN = "/";

/**
 * Das gemerkte Ziel kommt aus der Adresszeile und ist damit vom Nutzer
 * (oder von einem Angreifer) frei waehlbar. Erlaubt sind ausschliesslich
 * Pfade innerhalb dieser Anwendung -- sonst wird die Anmeldeseite zum
 * Sprungbrett auf eine fremde Seite.
 */
export function safeRedirectTarget(value: string | null | undefined): string {
  if (!value) return DEFAULT_AFTER_LOGIN;
  // Nur ein einzelner Slash am Anfang; "//host" und "/\host" wuerden vom
  // Browser als absolute Adresse gelesen.
  if (!value.startsWith("/")) return DEFAULT_AFTER_LOGIN;
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_AFTER_LOGIN;
  }
  // Steuerzeichen koennen in einem Location-Header eine zweite Kopfzeile
  // eroeffnen.
  if (/[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_AFTER_LOGIN;
  if (value === LOGIN_PATH || value.startsWith(`${LOGIN_PATH}/`)) {
    return DEFAULT_AFTER_LOGIN;
  }
  return value;
}

/** Baut die Adresse der Anmeldeseite mit gemerktem Ziel. */
export function loginUrlFor(target: string): string {
  const safeTarget = safeRedirectTarget(target);
  if (safeTarget === DEFAULT_AFTER_LOGIN) return LOGIN_PATH;
  return `${LOGIN_PATH}?weiter=${encodeURIComponent(safeTarget)}`;
}
