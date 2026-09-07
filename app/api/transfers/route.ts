import { getPool } from "@/lib/db/pool";
import {
  createTransfer,
  deleteTransfer,
  findTransferBetween,
  updateTransfer,
} from "@/lib/db/transfers";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { validateTransferInput } from "@/lib/transfers/validate";
import type { TransferMode } from "@/lib/transfers/types";

/**
 * Einen Transfer zwischen zwei Programmpunkten anlegen, aendern und
 * entfernen (req-052). Alle drei sind Vorgaenge, bei denen der Nutzer eine
 * Bestaetigung erwartet -- sie werden sofort geschrieben, nicht verzoegert
 * (siehe delivery/stack.md, Conventions).
 *
 * Der Mandant kommt aus der Anmeldung, nie aus der Anfrage (req-024):
 * Programmpunkte und Transfers anderer Accounts existieren fuer diese
 * Sitzung nicht. Zu welcher Reise ein Transfer gehoert, sagt die Anfrage
 * nicht -- das ergibt sich aus den beiden Programmpunkten.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
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

/**
 * Verkehrsmittel, Titel, Dauer und Strecke aus der Anfrage -- geprueft mit
 * derselben Domaenenlogik wie im Formular (siehe lib/transfers/validate.ts).
 * Zahlen duerfen als Zahl oder als getippter Text ankommen.
 */
function angabenAus(body: Record<string, unknown>) {
  return validateTransferInput({
    mode: textOf(body.mode) as TransferMode,
    title: textOf(body.title),
    durationMin: String(body.durationMin ?? ""),
    distanceKm: String(body.distanceKm ?? ""),
  }).values;
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const fromActivityId = textOf(body.fromActivityId).trim();
  const toActivityId = textOf(body.toActivityId).trim();
  if (fromActivityId.length === 0 || toActivityId.length === 0) {
    return invalidBody();
  }

  const values = angabenAus(body);
  if (!values) return invalidBody();

  // Zwischen zwei Programmpunkten gibt es genau einen Transfer (req-052).
  const vorhanden = await findTransferBetween(
    getPool(),
    session.accountId,
    fromActivityId,
    toActivityId,
  );
  if (vorhanden) {
    return Response.json({ error: "transfer exists" }, { status: 409 });
  }

  const transfer = await createTransfer(getPool(), session.accountId, {
    ...values,
    fromActivityId,
    toActivityId,
  });
  if (!transfer) {
    return Response.json({ error: "unknown activity" }, { status: 404 });
  }

  return Response.json({ transfer }, { status: 201 });
}

/** Aendert Verkehrsmittel, Titel, Dauer und Strecke eines Transfers. */
export async function PATCH(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id).trim();
  if (id.length === 0) return invalidBody();

  const values = angabenAus(body);
  if (!values) return invalidBody();

  const transfer = await updateTransfer(
    getPool(),
    session.accountId,
    id,
    values,
  );
  if (!transfer) {
    return Response.json({ error: "unknown transfer" }, { status: 404 });
  }

  return Response.json({ transfer });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const id = textOf(body.id).trim();
  if (id.length === 0) return invalidBody();

  const transfer = await deleteTransfer(getPool(), session.accountId, id);
  if (!transfer) {
    return Response.json({ error: "unknown transfer" }, { status: 404 });
  }

  return Response.json({ transfer });
}
