import type { AccountUser, OpenInvitation } from "../db/account-users";
import type { Invitation } from "../invitations/types";
import type { ParticipantFieldErrors } from "../participants/validate";

export const USERS_API = "/api/nutzer";
export const USER_INVITATIONS_API = "/api/nutzer/einladungen";

export const USER_ERRORS = {
  loadFailed: "Die Nutzer konnten nicht geladen werden.",
  inviteFailed: "Die Einladung konnte nicht erzeugt werden.",
  withdrawFailed: "Die Einladung konnte nicht zurückgezogen werden.",
} as const;

export interface AccountUsers {
  users: AccountUser[];
  invitations: OpenInvitation[];
}

/** Laedt Personen und offene Einladungen des Accounts (req-038). */
export async function loadAccountUsers(): Promise<AccountUsers | null> {
  try {
    const response = await fetch(USERS_API);
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<AccountUsers>;
    return {
      users: payload.users ?? [],
      invitations: payload.invitations ?? [],
    };
  } catch {
    return null;
  }
}

export type InviteUserRequestResult =
  | { ok: true; invitation: Invitation; participantId: string }
  | { ok: false; errors: ParticipantFieldErrors };

/**
 * Laedt jemanden per E-Mail ein (req-038). Der Zugangslink kommt genau
 * einmal zurueck -- gespeichert ist nur seine Pruefsumme.
 */
export async function inviteUserRequest(draft: {
  name: string;
  email: string;
}): Promise<InviteUserRequestResult> {
  try {
    const response = await fetch(USER_INVITATIONS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      errors?: ParticipantFieldErrors;
      invitation?: Invitation;
      participant?: { id?: string };
    };
    if (!response.ok || !payload.invitation) {
      return {
        ok: false,
        errors: payload.errors ?? { email: USER_ERRORS.inviteFailed },
      };
    }
    return {
      ok: true,
      invitation: payload.invitation,
      participantId:
        payload.participant?.id ?? payload.invitation.participantId,
    };
  } catch {
    return { ok: false, errors: { email: USER_ERRORS.inviteFailed } };
  }
}

/** Zieht eine offene Einladung zurueck; der Link ist danach wertlos. */
export async function withdrawInvitationRequest(
  participantId: string,
): Promise<boolean> {
  try {
    const response = await fetch(USER_INVITATIONS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
