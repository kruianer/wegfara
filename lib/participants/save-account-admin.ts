import type { Participant } from "./types";

const ACCOUNT_ADMIN_API = "/api/participants/account-admin";

/**
 * Warum die Kennzeichnung nicht gespeichert werden konnte (req-027).
 * `lastAdmin` heisst: es waere der letzte Account-Admin gewesen -- die
 * Karte nennt dann den Grund, statt kommentarlos nichts zu tun.
 */
export type AccountAdminFailureReason = "lastAdmin" | "failed";

export type AccountAdminSaveResult =
  | { ok: true; participant: Participant }
  | { ok: false; reason: AccountAdminFailureReason };

/**
 * Ernennt eine Person zum Account-Admin oder entzieht ihr die Kennzeichnung
 * (siehe req-027). Ein Vorgang, bei dem der Nutzer eine Bestaetigung
 * erwartet -- er wird sofort geschrieben, nicht verzoegert (siehe
 * delivery/stack.md, Conventions).
 */
export async function saveAccountAdmin(
  id: string,
  accountAdmin: boolean,
): Promise<AccountAdminSaveResult> {
  let response: Response;
  try {
    response = await fetch(ACCOUNT_ADMIN_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, accountAdmin }),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  if (response.status === 409) return { ok: false, reason: "lastAdmin" };

  try {
    const payload = (await response.json()) as { participant?: Participant };
    if (response.ok && payload.participant) {
      return { ok: true, participant: payload.participant };
    }
  } catch {
    return { ok: false, reason: "failed" };
  }
  return { ok: false, reason: "failed" };
}
