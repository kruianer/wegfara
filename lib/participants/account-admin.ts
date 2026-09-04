import type { Participant } from "./types";

/**
 * Die Regeln rund um die Kennzeichnung Account-Admin (req-027). Sie stehen
 * hier ohne UI- und ohne Datenbankbezug, damit die Karte "Reiseteilnehmer"
 * und die Schnittstelle dieselbe Regel anwenden -- ein Aufruf an der Karte
 * vorbei kann dem letzten Account-Admin die Kennzeichnung genauso wenig
 * entziehen wie ein Klick.
 */

export const ACCOUNT_ADMIN_ERRORS = {
  /**
   * Ein Account hat immer mindestens einen Account-Admin (req-027). In der
   * Oberflaeche heisst beides seit req-036 "Bereich" und "Bereichs-Admin".
   */
  lastAdmin: "Der Bereich braucht mindestens einen Bereichs-Admin.",
  failed: "Die Kennzeichnung konnte nicht gespeichert werden.",
} as const;

/**
 * Fuer die Regeln zaehlt nur, wer die Kennzeichnung traegt -- Name und
 * Kontaktdaten spielen keine Rolle. So gilt dieselbe Regel fuer die Karte
 * "Reiseteilnehmer" (req-027) und den Bereich "Nutzer" (req-038), der eine
 * andere Sicht auf dieselben Personen zeigt.
 */
export interface AdminFlagged {
  id: string;
  accountAdmin: boolean;
}

/** Die Account-Admins unter diesen Personen. */
export function accountAdmins<T extends AdminFlagged>(participants: T[]): T[] {
  return participants.filter((participant) => participant.accountAdmin);
}

/** Ob diese Person der einzige Account-Admin des Accounts ist. */
export function isLastAccountAdmin(
  participants: AdminFlagged[],
  participantId: string,
): boolean {
  const admins = accountAdmins(participants);
  return admins.length === 1 && admins[0].id === participantId;
}

/**
 * Ob sich die Kennzeichnung so setzen laesst. Ernennen geht immer; entzogen
 * wird sie nur, solange jemand anderes sie noch traegt (req-027).
 */
export function canSetAccountAdmin(
  participants: AdminFlagged[],
  participantId: string,
  accountAdmin: boolean,
): boolean {
  if (accountAdmin) return true;
  return !isLastAccountAdmin(participants, participantId);
}

/**
 * Stellt sicher, dass der Account einen Account-Admin hat: hat er seinen
 * letzten verloren -- etwa weil die Person entfernt wurde --, rueckt die
 * dienstaelteste verbliebene nach (req-027). Ein Account ohne Personen
 * bleibt unberuehrt.
 *
 * Die Reihenfolge der Liste entscheidet, wer nachrueckt; sie folgt dem
 * Alter der Personen (siehe lib/db/participants.ts).
 */
export function promoteAccountAdminWhereMissing(
  participants: Participant[],
): Participant[] {
  if (accountAdmins(participants).length > 0) return participants;

  return participants.map((participant, index) =>
    index === 0 ? { ...participant, accountAdmin: true } : participant,
  );
}

/** Die Personen mit dieser Kennzeichnung an dieser Person. */
export function withAccountAdmin(
  participants: Participant[],
  participantId: string,
  accountAdmin: boolean,
): Participant[] {
  return participants.map((participant) =>
    participant.id === participantId
      ? { ...participant, accountAdmin }
      : participant,
  );
}
