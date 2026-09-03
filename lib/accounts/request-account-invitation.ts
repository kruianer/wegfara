import type { Invitation } from "../invitations/types";
import type { InvitationResult } from "../invitations/request-invitation";
import { ACCOUNT_INVITATION_API } from "./paths";

/**
 * Laesst den Zugangslink fuer die erste Person eines Accounts erzeugen
 * (req-025) -- nach demselben Verfahren wie bei den Reiseteilnehmern
 * (req-023).
 */
export async function requestAccountInvitation(
  accountId: string,
): Promise<InvitationResult> {
  try {
    const response = await fetch(ACCOUNT_INVITATION_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    if (!response.ok) return { ok: false };

    const payload = (await response.json()) as { invitation?: Invitation };
    if (!payload.invitation) return { ok: false };
    return { ok: true, invitation: payload.invitation };
  } catch {
    return { ok: false };
  }
}
