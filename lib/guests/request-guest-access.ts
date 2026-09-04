import { GUEST_ACCESS_API } from "./paths";
import { GUEST_ACCESS_ERRORS, type GuestAccessFieldErrors } from "./validate";
import type { GuestAccess, GuestLink } from "./types";

/**
 * Die Aufrufe des Bereichs "Gastzugaenge" (req-038). Erstellen und
 * Widerrufen sind Vorgaenge, bei denen der Nutzer eine Bestaetigung
 * erwartet -- sie werden sofort ausgefuehrt, nicht verzoegert (siehe
 * delivery/stack.md, Conventions).
 */

export type CreateGuestAccessResult =
  | { ok: true; link: GuestLink }
  | { ok: false; errors: GuestAccessFieldErrors };

export async function createGuestAccessRequest(input: {
  tripId: string;
  purpose: string;
  hours: number;
}): Promise<CreateGuestAccessResult> {
  try {
    const response = await fetch(GUEST_ACCESS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: input.tripId,
        purpose: input.purpose,
        stunden: input.hours,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        errors?: GuestAccessFieldErrors;
      };
      return {
        ok: false,
        errors: payload.errors ?? { purpose: GUEST_ACCESS_ERRORS.failed },
      };
    }
    const payload = (await response.json()) as { link?: GuestLink };
    if (!payload.link) {
      return { ok: false, errors: { purpose: GUEST_ACCESS_ERRORS.failed } };
    }
    return { ok: true, link: payload.link };
  } catch {
    return { ok: false, errors: { purpose: GUEST_ACCESS_ERRORS.failed } };
  }
}

export type RevokeGuestAccessResult =
  | { ok: true; guestAccess: GuestAccess }
  | { ok: false };

export async function revokeGuestAccessRequest(
  id: string,
): Promise<RevokeGuestAccessResult> {
  try {
    const response = await fetch(GUEST_ACCESS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) return { ok: false };
    const payload = (await response.json()) as { guestAccess?: GuestAccess };
    if (!payload.guestAccess) return { ok: false };
    return { ok: true, guestAccess: payload.guestAccess };
  } catch {
    return { ok: false };
  }
}
