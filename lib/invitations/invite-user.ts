import type { Queryable } from "../db/queryable";
import type { Mailer } from "../mail/mailer";
import { invitationMail } from "../mail/invitation-mail";
import { invalidateAccessLinks } from "../db/access-links";
import {
  createParticipant,
  findParticipantByEmailInAccount,
  emailTakenAnywhere,
} from "../db/participants";
import { environmentLabel } from "../auth/environment";
import { normalizeEmail } from "../auth/email";
import type { Participant } from "../participants/types";
import {
  PARTICIPANT_ERRORS,
  toParticipantInput,
  validateParticipantDraft,
  type ParticipantFieldErrors,
} from "../participants/validate";
import { issueInvitation } from "./create-invitation";
import type { Invitation } from "./types";

export interface InviteUserDraft {
  name: string;
  email: string;
}

export type InviteUserResult =
  | { ok: true; participant: Participant; invitation: Invitation }
  | { ok: false; errors: ParticipantFieldErrors };

/**
 * Laedt jemanden in den Account ein (req-038). Weitere Personen kommen
 * ausschliesslich so herein -- eine offene Selbstregistrierung gibt es
 * nicht.
 *
 * **Jedes Konto hat eine E-Mail-Adresse.** Sie ist hier erforderlich und
 * wird serverseitig verlangt, nicht nur im Formular: ohne sie haette die
 * eingeladene Person spaeter keinen Weg zurueck, wenn ihr Geraet verloren
 * geht. Ein Teilnehmer ohne hinterlegte Adresse entsteht auf diesem Weg
 * nicht.
 *
 * Eine Adresse, die im Account schon zu jemandem gehoert, laedt genau diese
 * Person erneut ein -- so wird aus einem Gast ein vollwertiger Teilnehmer,
 * und so kommt zurueck, wer ausgesperrt ist. Die vorherige Einladung wird
 * dabei entwertet (req-023).
 */
export async function inviteUser(
  db: Queryable,
  mailer: Mailer,
  accountId: string,
  draft: InviteUserDraft,
  now: Date,
): Promise<InviteUserResult> {
  const errors = validateParticipantDraft(
    { ...draft, nickname: "", phone: "", iban: "" },
    // Die Adresse ist bei einer Einladung Pflicht, anders als beim blossen
    // Erfassen einer Person (req-019).
    { emailRequired: true },
  );
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const email = normalizeEmail(draft.email.trim());
  const existing = await findParticipantByEmailInAccount(db, accountId, email);

  // Eine Adresse eines fremden Accounts laesst sich nicht in diesen holen:
  // sie ist installationsweit eindeutig (siehe migrations/0015_auth.sql).
  if (!existing && (await emailTakenAnywhere(db, email))) {
    return { ok: false, errors: { email: PARTICIPANT_ERRORS.emailTaken } };
  }

  const participant =
    existing ??
    (await createParticipant(
      db,
      accountId,
      toParticipantInput({ ...draft, nickname: "", phone: "", iban: "" }),
      now,
    ));

  // Eine neue Einladung entwertet die vorherige (req-023).
  await invalidateAccessLinks(db, participant.id, now);
  const invitation = await issueInvitation(db, participant.id, now);

  const versandt = await mailer.send(
    invitationMail(email, participant.name, invitation.url, environmentLabel()),
  );
  if (!versandt) {
    // Der Grund steht bereits im Log des Versands. Die Einladung bleibt
    // gueltig: Link und QR-Code werden zusaetzlich angezeigt und lassen sich
    // ueber jeden anderen Kanal weitergeben (req-023).
    console.error("Einladung konnte nicht versandt werden.");
  }

  return { ok: true, participant, invitation };
}
