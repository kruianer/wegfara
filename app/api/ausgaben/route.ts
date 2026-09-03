import { getPool } from "@/lib/db/pool";
import {
  createExpense,
  deleteExpense,
  findExpense,
  updateExpense,
  type ExpenseFailure,
  type ExpenseFields,
} from "@/lib/db/expenses";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { fetchEuroRate } from "@/lib/expenses/exchange-rate";
import { toEuroAmounts } from "@/lib/expenses/build";
import {
  validateExpenseDraft,
  type ExpenseDraft,
} from "@/lib/expenses/validate";
import {
  isCurrency,
  isSplitMode,
  type ExpenseShare,
} from "@/lib/expenses/types";

/**
 * Die Ausgaben einer Reise (req-029). Erfassen, Aendern und Entfernen sind
 * Vorgaenge, bei denen der Nutzer eine Bestaetigung erwartet -- sie werden
 * sofort geschrieben, nicht verzoegert (siehe delivery/stack.md,
 * Conventions).
 *
 * Reisen und Personen anderer Mandanten existieren fuer diese Sitzung
 * nicht: jeder Zugriff filtert nach dem Account der angemeldeten Person.
 * Dass Zahler und Beteiligte bei dieser Reise mitfahren, prueft der
 * Datenzugriffs-Layer -- ein Aufruf an der Oberflaeche vorbei kommt daran
 * nicht vorbei.
 *
 * Der Wechselkurs wird hier ermittelt und mit der Ausgabe gespeichert. Ist
 * die Kursquelle nicht erreichbar, wird eine Ausgabe in fremder Waehrung
 * nicht gespeichert; Euro ist davon nicht betroffen, dort ist der Kurs 1.
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

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

/** 404 fuer Unbekanntes, 409 fuer Personen ausserhalb der Reise. */
function failure(reason: ExpenseFailure) {
  return reason === "notInTrip"
    ? Response.json({ error: "notInTrip" }, { status: 409 })
    : Response.json({ error: "unknown" }, { status: 404 });
}

function readShares(value: unknown): ExpenseShare[] | null {
  if (!Array.isArray(value)) return null;
  const shares: ExpenseShare[] = [];
  for (const entry of value) {
    const record = entry as Record<string, unknown> | null;
    const participantId = textOf(record?.participantId);
    const amountCents = record?.amountCents;
    if (participantId.length === 0 || typeof amountCents !== "number") {
      return null;
    }
    shares.push({ participantId, amountCents });
  }
  return shares;
}

/** Liest die erfasste Ausgabe aus der Anfrage -- noch ungeprueft. */
function readDraft(body: Record<string, unknown>): ExpenseDraft | null {
  const tripId = textOf(body.tripId);
  const payerId = textOf(body.payerId);
  const shares = readShares(body.shares);
  if (
    tripId.length === 0 ||
    payerId.length === 0 ||
    shares === null ||
    typeof body.title !== "string" ||
    typeof body.originalAmountCents !== "number" ||
    !isCurrency(body.currency) ||
    !isSplitMode(body.splitMode)
  ) {
    return null;
  }
  return {
    tripId,
    title: body.title.trim(),
    originalAmountCents: body.originalAmountCents,
    currency: body.currency,
    payerId,
    splitMode: body.splitMode,
    shares,
  };
}

function rateUnavailable() {
  return Response.json({ error: "rateUnavailable" }, { status: 503 });
}

/** Die gepruefte Ausgabe, umgerechnet mit dem uebergebenen Kurs. */
function fieldsOf(draft: ExpenseDraft, rate: number): ExpenseFields {
  const { amountCents, shares } = toEuroAmounts(draft, rate);
  return {
    title: draft.title,
    amountCents,
    originalAmountCents: draft.originalAmountCents,
    currency: draft.currency,
    exchangeRate: rate,
    payerId: draft.payerId,
    splitMode: draft.splitMode,
    shares,
  };
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const draft = readDraft(body);
  if (!draft) return invalidBody();

  const problem = validateExpenseDraft(draft);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const rate = await fetchEuroRate(draft.currency);
  if (rate === null) return rateUnavailable();

  const result = await createExpense(
    getPool(),
    session.accountId,
    draft.tripId,
    fieldsOf(draft, rate),
    new Date(),
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ expense: result.expense });
}

export async function PUT(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const expenseId = textOf(body.id);
  const draft = readDraft(body);
  if (expenseId.length === 0 || !draft) return invalidBody();

  const problem = validateExpenseDraft(draft);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  const pool = getPool();
  const vorhanden = await findExpense(pool, session.accountId, expenseId);
  if (!vorhanden) return failure("unknown");

  // Der beim Erfassen ermittelte Kurs bleibt stehen -- sonst verschoeben
  // sich bereits abgerechnete Betraege nachtraeglich (req-029,
  // Constraints). Nur eine andere Waehrung braucht einen eigenen Kurs.
  const rate =
    vorhanden.currency === draft.currency
      ? vorhanden.exchangeRate
      : await fetchEuroRate(draft.currency);
  if (rate === null) return rateUnavailable();

  const result = await updateExpense(
    pool,
    session.accountId,
    expenseId,
    fieldsOf(draft, rate),
  );
  if (!result.ok) return failure(result.reason);

  return Response.json({ expense: result.expense });
}

export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  const body = await readBody(request);
  if (!body) return invalidBody();

  const expenseId = textOf(body.id);
  if (expenseId.length === 0) return invalidBody();

  const entfernt = await deleteExpense(getPool(), session.accountId, expenseId);
  if (!entfernt) return failure("unknown");

  return Response.json({ status: "ok" });
}
