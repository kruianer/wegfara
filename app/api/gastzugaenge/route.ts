import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { findGuestAccess, revokeGuestAccess } from "@/lib/db/guest-access";
import {
  issueGuestAccess,
  mayManageGuestAccess,
  visibleGuestAccesses,
} from "@/lib/guests/create-guest-access";
import { readGuestDurationHours } from "@/lib/guests/duration";
import {
  GUEST_ACCESS_ERRORS,
  validateGuestAccessDraft,
} from "@/lib/guests/validate";

export const dynamic = "force-dynamic";

/**
 * Die Gastzugaenge einer Reise (req-038). Erstellen und widerrufen darf sie
 * der Reiseleiter der Reise, ein Account-Admin und der Gesamt-Admin im
 * Account, in den er gewechselt ist -- geprueft wird das hier und nicht nur
 * in der Oberflaeche: das Ausblenden ist Bequemlichkeit, kein Schutz.
 *
 * Ein Gast kommt hier nie an: seine Sitzung liegt in `guest_session` und
 * wird von `currentSession()` nicht gefunden -- er bekommt eine Abweisung.
 *
 * Der Gastlink selbst kommt genau einmal zurueck, unmittelbar nach dem
 * Erstellen. Gespeichert wird nur seine Pruefsumme; wer ihn verliert,
 * erzeugt einen neuen.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();

  const guestAccesses = await visibleGuestAccesses(
    getPool(),
    session.accountId,
    session.participant.id,
    session.accountAdmin,
    new Date(),
  );
  return Response.json({ guestAccesses });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return Response.json({ error: "invalid body" }, { status: 400 });

  const draft = {
    tripId: textOf(body.tripId),
    purpose: textOf(body.purpose),
  };
  const errors = validateGuestAccessDraft(draft);
  if (Object.keys(errors).length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  // Ohne Angabe gilt sieben Tage; mehr als 90 Tage wird abgelehnt statt
  // still gekuerzt (req-038).
  const duration = readGuestDurationHours(body.stunden);
  if (!duration.ok) {
    return Response.json(
      { errors: { hours: duration.error } },
      { status: 400 },
    );
  }

  const db = getPool();
  if (
    !(await mayManageGuestAccess(
      db,
      session.accountId,
      draft.tripId,
      session.participant.id,
      session.accountAdmin,
    ))
  ) {
    return forbidden();
  }

  const link = await issueGuestAccess(
    db,
    {
      accountId: session.accountId,
      tripId: draft.tripId,
      createdBy: session.participant.id,
      purpose: draft.purpose,
      hours: duration.hours,
    },
    new Date(),
  );
  if (!link) {
    return Response.json(
      { errors: { purpose: GUEST_ACCESS_ERRORS.failed } },
      { status: 400 },
    );
  }
  return Response.json({ link }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  const id = body ? textOf(body.id) : "";
  if (!body || id.length === 0) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const db = getPool();
  const now = new Date();
  // Ein Gastzugang eines fremden Accounts existiert fuer diese Sitzung
  // nicht -- auch dann nicht, wenn seine Kennung bekannt ist.
  const existing = await findGuestAccess(db, session.accountId, id, now);
  if (!existing) {
    return Response.json({ error: "unknown guest access" }, { status: 404 });
  }

  if (
    !(await mayManageGuestAccess(
      db,
      session.accountId,
      existing.tripId,
      session.participant.id,
      session.accountAdmin,
    ))
  ) {
    return forbidden();
  }

  const guestAccess = await revokeGuestAccess(db, session.accountId, id, now);
  if (!guestAccess) {
    return Response.json({ error: "unknown guest access" }, { status: 404 });
  }
  return Response.json({ guestAccess });
}
