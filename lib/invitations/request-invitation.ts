import { INVITATIONS_API } from "../auth/paths";
import type { Invitation } from "./types";

/** Rueckmeldung, wenn sich keine Einladung erzeugen liess. */
export const INVITATION_ERRORS = {
  failed: "Die Einladung konnte nicht erzeugt werden.",
} as const;

export type InvitationResult =
  | { ok: true; invitation: Invitation }
  | { ok: false };

/**
 * Laesst eine Einladung erzeugen (siehe req-023). Ein Vorgang, bei dem der
 * Nutzer eine Bestaetigung erwartet -- er wird sofort ausgefuehrt, nicht
 * verzoegert (siehe delivery/stack.md, Conventions).
 */
export async function requestInvitation(
  participantId: string,
): Promise<InvitationResult> {
  try {
    const response = await fetch(INVITATIONS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    if (!response.ok) return { ok: false };

    const payload = (await response.json()) as { invitation?: Invitation };
    if (!payload.invitation) return { ok: false };
    return { ok: true, invitation: payload.invitation };
  } catch {
    return { ok: false };
  }
}
