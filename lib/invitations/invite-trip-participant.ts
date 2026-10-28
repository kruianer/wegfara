import type { Queryable } from "../db/queryable";
import type { Mailer } from "../mail/mailer";
import { invitationMail } from "../mail/invitation-mail";
import { findParticipantInAccount } from "../db/participants";
import { environmentLabel } from "../auth/environment";
import { createInvitation } from "./create-invitation";
import type { Invitation, InvitationMail } from "./types";

export interface TripInvitation {
  invitation: Invitation;
  mail: InvitationMail;
}

/**
 * "Einladen" in der Karte "Wer faehrt mit" (req-085): erzeugt die Einladung
 * wie bisher (req-023) und schickt sie zusaetzlich per E-Mail, wenn fuer die
 * Person eine Adresse hinterlegt ist.
 *
 * Scheitert der Versand, bleibt die Einladung gueltig -- Link und QR-Code
 * lassen sich ueber jeden anderen Kanal weitergeben. Der Grund steht bereits
 * im Log des Versands.
 *
 * Liefert null, wenn die Person nicht zu diesem Account gehoert oder keiner
 * Reise zugeordnet ist.
 */
export async function inviteTripParticipant(
  db: Queryable,
  mailer: Mailer,
  accountId: string,
  participantId: string,
  now: Date,
): Promise<TripInvitation | null> {
  const invitation = await createInvitation(db, accountId, participantId, now);
  if (!invitation) return null;

  const participant = await findParticipantInAccount(
    db,
    accountId,
    participantId,
  );
  const email = participant?.email ?? null;
  if (!participant || !email) {
    return { invitation, mail: { status: "keineAdresse" } };
  }

  const versandt = await mailer.send(
    invitationMail(email, participant.name, invitation.url, environmentLabel()),
  );
  if (!versandt) {
    console.error("Einladung konnte nicht versandt werden.");
    return { invitation, mail: { status: "fehlgeschlagen", an: email } };
  }
  return { invitation, mail: { status: "versandt", an: email } };
}
