/**
 * WebAuthn bindet einen Passkey an genau eine Domain. Beide Werte werden
 * aus APP_URL abgeleitet, damit dev und prod (dev.wegfara.com bzw.
 * app.wegfara.com) je eigene Passkeys haben und keiner der beiden Werte
 * im Repo festverdrahtet ist.
 */
export interface WebAuthnConfig {
  /** Die Domain, an die der Passkey gebunden ist. */
  rpId: string;
  /** Der Ursprung, den der Browser bei der Anmeldung mitschickt. */
  origin: string;
  /** Der Name, den der Browser bei der Einrichtung anzeigt. */
  rpName: string;
}

export const RP_NAME = "Wegfara";

/** Fuer die lokale Entwicklung, wenn APP_URL nicht gesetzt ist. */
export const DEFAULT_APP_URL = "http://localhost:3000";

export function webAuthnConfigFor(appUrl: string): WebAuthnConfig {
  const url = new URL(appUrl);
  return {
    rpId: url.hostname,
    origin: url.origin,
    rpName: RP_NAME,
  };
}

export function appUrl(): string {
  const configured = process.env.APP_URL?.trim();
  return configured ? configured : DEFAULT_APP_URL;
}

export function webAuthnConfig(): WebAuthnConfig {
  return webAuthnConfigFor(appUrl());
}

/** Baut eine absolute Adresse dieser Anwendung, z.B. fuer den Anmeldelink. */
export function absoluteUrl(path: string, baseUrl: string = appUrl()): string {
  return new URL(path, baseUrl).toString();
}
