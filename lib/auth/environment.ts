import { appUrl } from "./webauthn-config";

/**
 * Aus welcher Umgebung eine Nachricht stammt (req-037). Beide Umgebungen
 * verschicken unter derselben Absenderadresse; unterschieden wird im Betreff,
 * damit eine dev-Mail nicht mit einer echten verwechselt wird.
 *
 * Abgeleitet wird das aus APP_URL -- wie rpId und Origin des Passkeys und nie
 * aus einem Kopf der Anfrage (siehe delivery/devops.md: prod ist
 * app.wegfara.com, dev ist dev.wegfara.com).
 */

/** Der Rechnername der prod-Umgebung beginnt so; sie bleibt ohne Kennzeichnung. */
export const PRODUCTION_HOST_PREFIX = "app.";

export function environmentLabelFor(url: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (hostname.startsWith(PRODUCTION_HOST_PREFIX)) return null;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "lokal";
  // "dev.wegfara.com" -> "dev". Was nicht prod ist, nennt sich beim Namen
  // seines ersten Abschnitts.
  return hostname.split(".")[0] || null;
}

export function environmentLabel(): string | null {
  return environmentLabelFor(appUrl());
}
