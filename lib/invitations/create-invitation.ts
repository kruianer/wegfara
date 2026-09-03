import type { Queryable } from "../db/queryable";
import { createAccessLink, invalidateAccessLinks } from "../db/access-links";
import { findParticipantInAccount } from "../db/participants";
import { isInAnyTrip } from "../db/trip-participants";
import { createToken } from "../auth/tokens";
import { absoluteUrl } from "../auth/webauthn-config";
import { INVITATION_PATH } from "../auth/paths";
import { qrCodeFor } from "../qr/qr-code";
import type { Invitation } from "./types";

/**
 * Erzeugt eine Einladung fuer eine Person, die einer Reise zugeordnet ist
 * (req-023). Die Einladung ist an genau diese Person gebunden -- einen frei
 * einloesbaren Gruppenlink gibt es nicht.
 *
 * Eine neue Einladung entwertet die vorherige: es soll immer nur der
 * zuletzt herausgegebene Link gelten. Genau darueber kommt auch zurueck,
 * wer ausgesperrt ist -- neues Geraet, geloeschte Browserdaten, kein
 * Zugriff aufs Postfach.
 *
 * Liefert null, wenn die Person nicht zu diesem Account gehoert oder
 * keiner Reise zugeordnet ist.
 */
export async function createInvitation(
  db: Queryable,
  accountId: string,
  participantId: string,
  now: Date,
): Promise<Invitation | null> {
  // Eine Person eines anderen Accounts existiert fuer diese Sitzung nicht.
  const participant = await findParticipantInAccount(
    db,
    accountId,
    participantId,
  );
  if (!participant) return null;
  if (!(await isInAnyTrip(db, accountId, participantId))) return null;

  await invalidateAccessLinks(db, participantId, now);

  const token = createToken();
  const expiresAt = await createAccessLink(db, participantId, token, now);
  const url = absoluteUrl(
    `${INVITATION_PATH}?token=${encodeURIComponent(token)}`,
  );

  return {
    participantId,
    url,
    qr: qrCodeFor(url),
    expiresAt: expiresAt.toISOString(),
  };
}
