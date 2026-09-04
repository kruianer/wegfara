import type { Queryable } from "../db/queryable";
import { createGuestAccess, listGuestAccesses } from "../db/guest-access";
import { leadsTrip, listLedTripIds } from "../db/trip-participants";
import { tripBelongsToAccount } from "../db/trips";
import { createToken } from "../auth/tokens";
import { absoluteUrl } from "../auth/webauthn-config";
import { qrCodeFor } from "../qr/qr-code";
import { GUEST_PATH } from "./paths";
import { guestAccessExpiresAt } from "./duration";
import type { GuestAccess, GuestLink } from "./types";

/**
 * Wer Gastzugaenge einer Reise erstellen und widerrufen darf (req-038): ihr
 * Reiseleiter, ein Account-Admin und -- als Account-Admin des Accounts, in
 * den er gewechselt ist -- der Gesamt-Admin. Ein Teilnehmer ohne diese
 * Kennzeichnungen darf es nicht, auch nicht ueber die Schnittstelle.
 */
export async function mayManageGuestAccess(
  db: Queryable,
  accountId: string,
  tripId: string,
  participantId: string,
  accountAdmin: boolean,
): Promise<boolean> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return false;
  if (accountAdmin) return true;
  return leadsTrip(db, accountId, tripId, participantId);
}

/**
 * Die Gastzugaenge, die diese Person sehen darf (req-038): ein
 * Account-Admin alle des Accounts, ein Reiseleiter die seiner Reisen. Wer
 * weder das eine noch das andere ist, sieht keine.
 */
export async function visibleGuestAccesses(
  db: Queryable,
  accountId: string,
  participantId: string,
  accountAdmin: boolean,
  now: Date,
): Promise<GuestAccess[]> {
  const all = await listGuestAccesses(db, accountId, now);
  if (accountAdmin) return all;

  const led = await listLedTripIds(db, accountId, participantId);
  return all.filter((access) => led.includes(access.tripId));
}

export interface IssueGuestAccessInput {
  accountId: string;
  tripId: string;
  createdBy: string;
  purpose: string;
  hours: number;
}

/**
 * Erzeugt einen Gastzugang samt Link (req-038). Das Geheimnis traegt 256
 * Bit Zufall und wird nur als Pruefsumme gespeichert; der Klartext verlaesst
 * diese Funktion genau einmal -- danach ist er nirgends mehr zu finden.
 *
 * Liefert null, wenn die Reise nicht zu diesem Account gehoert.
 */
export async function issueGuestAccess(
  db: Queryable,
  input: IssueGuestAccessInput,
  now: Date,
): Promise<GuestLink | null> {
  const token = createToken();
  const guestAccess = await createGuestAccess(
    db,
    {
      accountId: input.accountId,
      tripId: input.tripId,
      createdBy: input.createdBy,
      purpose: input.purpose,
      token,
      expiresAt: guestAccessExpiresAt(now, input.hours),
    },
    now,
  );
  if (!guestAccess) return null;

  const url = absoluteUrl(`${GUEST_PATH}?token=${encodeURIComponent(token)}`);
  return { guestAccess, url, qr: qrCodeFor(url) };
}
