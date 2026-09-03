import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import type {
  Currency,
  Expense,
  ExpenseShare,
  SplitMode,
} from "../expenses/types";

interface ExpenseRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  title: string;
  amount_cents: number;
  original_amount_cents: number;
  currency: Currency;
  exchange_rate: number;
  payer_id: string;
  split_mode: SplitMode;
  created_at: unknown;
}

interface ShareRow extends Record<string, unknown> {
  expense_id: string;
  participant_id: string;
  amount_cents: number;
}

const EXPENSE_COLUMNS = `e.id, e.trip_id, e.title, e.amount_cents,
                         e.original_amount_cents, e.currency, e.exchange_rate,
                         e.payer_id, e.split_mode, e.created_at`;

/** `timestamptz` liefert der Treiber als Date, das Test-Double als Text. */
function toIsoInstant(value: unknown): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function toExpense(row: ExpenseRow, shares: ExpenseShare[]): Expense {
  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    amountCents: Number(row.amount_cents),
    originalAmountCents: Number(row.original_amount_cents),
    currency: row.currency,
    exchangeRate: Number(row.exchange_rate),
    payerId: row.payer_id,
    splitMode: row.split_mode,
    shares,
    createdAt: toIsoInstant(row.created_at),
  };
}

/**
 * Die Angaben einer Ausgabe, wie sie in der Datenbank landen (req-029):
 * alle Betraege bereits in Euro-Cent umgerechnet, der beim Erfassen
 * ermittelte Kurs daneben.
 */
export interface ExpenseFields {
  title: string;
  amountCents: number;
  originalAmountCents: number;
  currency: Currency;
  exchangeRate: number;
  payerId: string;
  splitMode: SplitMode;
  shares: ExpenseShare[];
}

/**
 * Warum eine Ausgabe nicht geschrieben werden konnte:
 * `unknown` -- Reise oder Ausgabe gehoeren nicht zu diesem Account,
 * `notInTrip` -- Zahler oder Beteiligte fahren bei dieser Reise nicht mit.
 */
export type ExpenseFailure = "unknown" | "notInTrip";

export type ExpenseResult =
  | { ok: true; expense: Expense }
  | { ok: false; reason: ExpenseFailure };

function gruppiere(rows: ShareRow[]): Map<string, ExpenseShare[]> {
  const shares = new Map<string, ExpenseShare[]>();
  for (const row of rows) {
    const liste = shares.get(row.expense_id) ?? [];
    liste.push({
      participantId: row.participant_id,
      amountCents: Number(row.amount_cents),
    });
    shares.set(row.expense_id, liste);
  }
  return shares;
}

/**
 * Die Anteile aller Ausgaben des Accounts, nach Ausgabe gebuendelt. Sie
 * sind nach dem Alter der Person geordnet -- so steht in jeder Ausgabe
 * dieselbe Reihenfolge wie in der Personenliste.
 */
async function listShares(
  db: Queryable,
  accountId: string,
): Promise<Map<string, ExpenseShare[]>> {
  const { rows } = await db.query<ShareRow>(
    `select s.expense_id, s.participant_id, s.amount_cents
     from expense_share s
     join expense e on e.id = s.expense_id
     join trip t on t.id = e.trip_id
     join participant p on p.id = s.participant_id
     where t.account_id = $1
     order by p.created_at asc, p.name asc`,
    [accountId],
  );
  return gruppiere(rows);
}

/** Die Anteile einer einzelnen Ausgabe, in derselben Reihenfolge. */
async function sharesOfExpense(
  db: Queryable,
  expenseId: string,
): Promise<ExpenseShare[]> {
  const { rows } = await db.query<ShareRow>(
    `select s.expense_id, s.participant_id, s.amount_cents
     from expense_share s
     join participant p on p.id = s.participant_id
     where s.expense_id = $1
     order by p.created_at asc, p.name asc`,
    [expenseId],
  );
  return gruppiere(rows).get(expenseId) ?? [];
}

/**
 * Alle Ausgaben aller Reisen des Accounts (Mandantentrennung ueber trip),
 * die neueste zuerst (req-029).
 */
export async function listExpenses(
  db: Queryable,
  accountId: string,
): Promise<Expense[]> {
  const { rows } = await db.query<ExpenseRow>(
    `select ${EXPENSE_COLUMNS}
     from expense e
     join trip t on t.id = e.trip_id
     where t.account_id = $1
     order by e.created_at desc, e.id desc`,
    [accountId],
  );
  const shares = await listShares(db, accountId);
  return rows.map((row) => toExpense(row, shares.get(row.id) ?? []));
}

/** Ob die Reise zu diesem Account gehoert (req-024). */
async function tripInAccount(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `select id from trip where id = $1 and account_id = $2`,
    [tripId, accountId],
  );
  return rows.length > 0;
}

/**
 * Ob Zahler und Beteiligte alle bei dieser Reise mitfahren -- Zahler und
 * Beteiligte sind Teilnehmer der Reise (req-029, Constraints; req-021).
 */
async function allInTrip(
  db: Queryable,
  tripId: string,
  fields: ExpenseFields,
): Promise<boolean> {
  const { rows } = await db.query<{ participant_id: string }>(
    `select participant_id from trip_participant where trip_id = $1`,
    [tripId],
  );
  const mitfahrend = new Set(rows.map((row) => row.participant_id));
  return (
    mitfahrend.has(fields.payerId) &&
    fields.shares.every((share) => mitfahrend.has(share.participantId))
  );
}

async function writeShares(
  db: Queryable,
  expenseId: string,
  shares: ExpenseShare[],
): Promise<void> {
  for (const share of shares) {
    await db.query(
      `insert into expense_share (expense_id, participant_id, amount_cents)
       values ($1, $2, $3)`,
      [expenseId, share.participantId, share.amountCents],
    );
  }
}

/** Die gerade geschriebene Ausgabe samt Anteilen, wie sie in der DB steht. */
async function readExpense(
  db: Queryable,
  expenseId: string,
): Promise<Expense | null> {
  const { rows } = await db.query<ExpenseRow>(
    `select ${EXPENSE_COLUMNS} from expense e where e.id = $1`,
    [expenseId],
  );
  if (!rows[0]) return null;
  return toExpense(rows[0], await sharesOfExpense(db, expenseId));
}

/** Legt eine Ausgabe der Reise an (req-029). */
export async function createExpense(
  db: Queryable,
  accountId: string,
  tripId: string,
  fields: ExpenseFields,
  now: Date,
): Promise<ExpenseResult> {
  if (!(await tripInAccount(db, accountId, tripId))) {
    return { ok: false, reason: "unknown" };
  }
  if (!(await allInTrip(db, tripId, fields))) {
    return { ok: false, reason: "notInTrip" };
  }

  const id = randomUUID();
  await db.query(
    `insert into expense (id, trip_id, title, amount_cents,
                          original_amount_cents, currency, exchange_rate,
                          payer_id, split_mode, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      tripId,
      fields.title,
      fields.amountCents,
      fields.originalAmountCents,
      fields.currency,
      fields.exchangeRate,
      fields.payerId,
      fields.splitMode,
      now,
    ],
  );
  await writeShares(db, id, fields.shares);

  const expense = await readExpense(db, id);
  return expense ? { ok: true, expense } : { ok: false, reason: "unknown" };
}

/** Die Reise einer Ausgabe, sofern beide zu diesem Account gehoeren. */
async function tripOfExpense(
  db: Queryable,
  accountId: string,
  expenseId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ trip_id: string }>(
    `select e.trip_id
     from expense e
     join trip t on t.id = e.trip_id
     where e.id = $1 and t.account_id = $2`,
    [expenseId, accountId],
  );
  return rows[0]?.trip_id ?? null;
}

/**
 * Aendert eine Ausgabe (req-029). Die Reise bleibt dieselbe -- geaendert
 * wird eine Ausgabe dort, wo sie erfasst wurde.
 */
export async function updateExpense(
  db: Queryable,
  accountId: string,
  expenseId: string,
  fields: ExpenseFields,
): Promise<ExpenseResult> {
  const tripId = await tripOfExpense(db, accountId, expenseId);
  if (!tripId) return { ok: false, reason: "unknown" };
  if (!(await allInTrip(db, tripId, fields))) {
    return { ok: false, reason: "notInTrip" };
  }

  await db.query(
    `update expense
     set title = $2, amount_cents = $3, original_amount_cents = $4,
         currency = $5, exchange_rate = $6, payer_id = $7, split_mode = $8
     where id = $1`,
    [
      expenseId,
      fields.title,
      fields.amountCents,
      fields.originalAmountCents,
      fields.currency,
      fields.exchangeRate,
      fields.payerId,
      fields.splitMode,
    ],
  );
  await db.query(`delete from expense_share where expense_id = $1`, [
    expenseId,
  ]);
  await writeShares(db, expenseId, fields.shares);

  const expense = await readExpense(db, expenseId);
  return expense ? { ok: true, expense } : { ok: false, reason: "unknown" };
}

/**
 * Entfernt eine Ausgabe samt ihren Anteilen (req-029). Liefert false, wenn
 * es im Account keine solche Ausgabe gibt.
 */
export async function deleteExpense(
  db: Queryable,
  accountId: string,
  expenseId: string,
): Promise<boolean> {
  if (!(await tripOfExpense(db, accountId, expenseId))) return false;

  await db.query(`delete from expense_share where expense_id = $1`, [
    expenseId,
  ]);
  const { rows } = await db.query(
    `delete from expense where id = $1 returning id`,
    [expenseId],
  );
  return rows.length > 0;
}

/** Die Ausgabe einer Reise finden -- fuer den Kurs beim Aendern (req-029). */
export async function findExpense(
  db: Queryable,
  accountId: string,
  expenseId: string,
): Promise<Expense | null> {
  if (!(await tripOfExpense(db, accountId, expenseId))) return null;
  return readExpense(db, expenseId);
}
