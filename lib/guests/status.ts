import type { GuestAccessStatus } from "./types";

/**
 * Der Zustand eines Gastzugangs (req-038). Er wird gerechnet und nie
 * gespeichert: der Widerruf gilt sofort und schlaegt den Ablauf, weil er
 * die staerkere Aussage ist -- ein widerrufener Zugang bleibt widerrufen,
 * auch nachdem seine Frist verstrichen ist.
 */
export function guestAccessStatus(
  access: { expiresAt: Date | string; revokedAt: Date | string | null },
  now: Date,
): GuestAccessStatus {
  if (access.revokedAt) return "widerrufen";
  const expiresAt = new Date(access.expiresAt);
  return expiresAt.getTime() <= now.getTime() ? "abgelaufen" : "aktiv";
}
