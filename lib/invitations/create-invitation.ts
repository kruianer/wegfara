import type { Queryable } from "../db/queryable";
import { createAccessLink, invalidateAccessLinks } from "../db/access-links";
import { findFirstPersonOfAccount } from "../db/accounts";
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

  return issueInvitation(db, participantId, now);
}

/**
 * Erzeugt den Zugangslink fuer die erste Person eines Accounts (req-025).
 * Nach demselben Verfahren wie bei den Reiseteilnehmern: an die Person
 * gebunden, sieben Tage gueltig, genau einmal verwendbar; beim Einloesen
 * entsteht ein Passkey.
 *
 * Anders als dort ist keine Reise noetig -- der Account ist gerade erst
 * angelegt und hat noch keine. Ab dem Einloesen verwaltet die Person ihren
 * Account selbst.
 *
 * Vorbehalten ist das dem Gesamt-Admin; geprueft wird das in
 * app/api/accounts/einladung/route.ts.
 *
 * Liefert null, wenn der Account keine Person hat.
 */
export async function createFirstPersonInvitation(
  db: Queryable,
  accountId: string,
  now: Date,
): Promise<Invitation | null> {
  const person = await findFirstPersonOfAccount(db, accountId);
  if (!person) return null;

  return issueInvitation(db, person.id, now);
}

/**
 * Der gemeinsame Kern beider Wege (req-023, req-025): eine neue Einladung
 * entwertet die vorherige, gespeichert wird ausschliesslich die Pruefsumme
 * des Tokens, und der Klartext verlaesst diese Funktion genau einmal.
 */
export async function issueInvitation(
  db: Queryable,
  participantId: string,
  now: Date,
): Promise<Invitation> {
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
