// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { createParticipant, deleteParticipant } from "./participants";
import { assignTripParticipant } from "./trip-participants";
import {
  createExpense,
  deleteExpense,
  findExpense,
  listExpenses,
  updateExpense,
  type ExpenseFields,
} from "./expenses";
import { sumShares } from "../expenses/split";
import type { Participant } from "../participants/types";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

const NOW = new Date("2026-07-20T18:00:00.000Z");
const SPAETER = new Date("2026-07-21T09:00:00.000Z");

type Pool = ReturnType<typeof createTestDb>;

/** Eine weitere Person des Accounts, der Reise zugeordnet. */
async function mitfahrer(
  pool: Pool,
  name: string,
  minuten: number,
  tripId = SUEDITALIEN_ID,
): Promise<Participant> {
  const participant = await createParticipant(
    pool,
    ACCOUNT_ID,
    { name, nickname: null, email: null, phone: null, iban: null },
    new Date(Date.UTC(2026, 6, 1, 0, minuten)),
  );
  await assignTripParticipant(
    pool,
    ACCOUNT_ID,
    tripId,
    participant.id,
    "teilnehmer",
  );
  return participant;
}

function abendessen(
  payerId: string,
  beteiligte: string[],
  overrides: Partial<ExpenseFields> = {},
): ExpenseFields {
  const anteil = Math.floor(6000 / beteiligte.length);
  const rest = 6000 - anteil * beteiligte.length;
  return {
    title: "Abendessen",
    amountCents: 6000,
    originalAmountCents: 6000,
    currency: "EUR",
    exchangeRate: 1,
    payerId,
    splitMode: "gleichmaessig",
    shares: beteiligte.map((participantId, index) => ({
      participantId,
      amountCents: anteil + (index === 0 ? rest : 0),
    })),
    ...overrides,
  };
}

async function fremderAccountMitReise(pool: Pool) {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const participantId = randomUUID();
  await pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  await pool.query(
    `insert into participant (id, account_id, name, email, created_at)
     values ($1, $2, 'Fremde Person', 'fremd@example.com', $3)`,
    [participantId, accountId, new Date()],
  );
  await pool.query(
    `insert into trip_participant (trip_id, participant_id, role)
     values ($1, $2, 'reiseleiter')`,
    [tripId, participantId],
  );
  return { accountId, tripId, participantId };
}

describe("createExpense (req-029)", () => {
  it("legt eine Ausgabe mit ihren Anteilen an", async () => {
    const pool = createTestDb();
    const ben = await mitfahrer(pool, "Ben Berger", 1);

    const result = await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID, ben.id]),
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.title).toBe("Abendessen");
    expect(result.expense.amountCents).toBe(6000);
    expect(sumShares(result.expense.shares)).toBe(6000);
    expect(result.expense.createdAt).toBe("2026-07-20T18:00:00.000Z");
  });

  it("speichert den Kurs und den urspruenglichen Betrag mit", async () => {
    const pool = createTestDb();

    const result = await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID], {
        amountCents: 10070,
        originalAmountCents: 9500,
        currency: "CHF",
        exchangeRate: 1.06,
        shares: [{ participantId: PARTICIPANT_ID, amountCents: 10070 }],
      }),
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.currency).toBe("CHF");
    expect(result.expense.originalAmountCents).toBe(9500);
    expect(result.expense.exchangeRate).toBe(1.06);
    expect(result.expense.amountCents).toBe(10070);
  });

  it("weist eine Reise ab, die nicht zu diesem Account gehoert", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    const result = await createExpense(
      pool,
      ACCOUNT_ID,
      fremd.tripId,
      abendessen(fremd.participantId, [fremd.participantId]),
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });

  it("weist einen Zahler ab, der bei dieser Reise nicht mitfaehrt", async () => {
    const pool = createTestDb();
    const daheim = await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      NOW,
    );

    const result = await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(daheim.id, [daheim.id]),
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "notInTrip" });
  });

  it("weist eine beteiligte Person ab, die bei dieser Reise nicht mitfaehrt", async () => {
    const pool = createTestDb();
    const daheim = await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      NOW,
    );

    const result = await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID, daheim.id]),
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "notInTrip" });
  });
});

describe("listExpenses (req-029)", () => {
  it("liefert die neueste Ausgabe zuerst", async () => {
    const pool = createTestDb();
    await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID]),
      NOW,
    );
    await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID], { title: "Sprit" }),
      SPAETER,
    );

    const expenses = await listExpenses(pool, ACCOUNT_ID);

    expect(expenses.map((expense) => expense.title)).toEqual([
      "Sprit",
      "Abendessen",
    ]);
  });

  it("liefert die Ausgaben eines fremden Accounts nicht mit", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    await createExpense(
      pool,
      fremd.accountId,
      fremd.tripId,
      abendessen(fremd.participantId, [fremd.participantId]),
      NOW,
    );

    expect(await listExpenses(pool, ACCOUNT_ID)).toEqual([]);
    expect(await listExpenses(pool, fremd.accountId)).toHaveLength(1);
  });

  it("haelt die Ausgaben der Reisen auseinander", async () => {
    const pool = createTestDb();
    await createExpense(
      pool,
      ACCOUNT_ID,
      WIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID], { title: "Kaffeehaus" }),
      NOW,
    );

    const expenses = await listExpenses(pool, ACCOUNT_ID);

    expect(expenses).toHaveLength(1);
    expect(expenses[0].tripId).toBe(WIEN_ID);
  });
});

describe("updateExpense (req-029)", () => {
  it("aendert Titel, Betrag und Anteile", async () => {
    const pool = createTestDb();
    const ben = await mitfahrer(pool, "Ben Berger", 1);
    const angelegt = await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID, ben.id]),
      NOW,
    );
    expect(angelegt.ok).toBe(true);
    if (!angelegt.ok) return;

    const result = await updateExpense(
      pool,
      ACCOUNT_ID,
      angelegt.expense.id,
      abendessen(ben.id, [ben.id], {
        title: "Mittagessen",
        amountCents: 4000,
        originalAmountCents: 4000,
        splitMode: "individuell",
        shares: [{ participantId: ben.id, amountCents: 4000 }],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expense.title).toBe("Mittagessen");
    expect(result.expense.payerId).toBe(ben.id);
    expect(result.expense.splitMode).toBe("individuell");
    expect(result.expense.shares).toEqual([
      { participantId: ben.id, amountCents: 4000 },
    ]);
  });

  it("weist eine Ausgabe eines fremden Accounts ab", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    const angelegt = await createExpense(
      pool,
      fremd.accountId,
      fremd.tripId,
      abendessen(fremd.participantId, [fremd.participantId]),
      NOW,
    );
    expect(angelegt.ok).toBe(true);
    if (!angelegt.ok) return;

    const result = await updateExpense(
      pool,
      ACCOUNT_ID,
      angelegt.expense.id,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID]),
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("deleteExpense (req-029)", () => {
  it("entfernt die Ausgabe samt ihren Anteilen", async () => {
    const pool = createTestDb();
    const angelegt = await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID]),
      NOW,
    );
    expect(angelegt.ok).toBe(true);
    if (!angelegt.ok) return;

    expect(await deleteExpense(pool, ACCOUNT_ID, angelegt.expense.id)).toBe(
      true,
    );
    expect(await listExpenses(pool, ACCOUNT_ID)).toEqual([]);
    const { rows } = await pool.query(
      "select expense_id from expense_share where expense_id = $1",
      [angelegt.expense.id],
    );
    expect(rows).toEqual([]);
  });

  it("entfernt keine Ausgabe eines fremden Accounts", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    const angelegt = await createExpense(
      pool,
      fremd.accountId,
      fremd.tripId,
      abendessen(fremd.participantId, [fremd.participantId]),
      NOW,
    );
    expect(angelegt.ok).toBe(true);
    if (!angelegt.ok) return;

    expect(await deleteExpense(pool, ACCOUNT_ID, angelegt.expense.id)).toBe(
      false,
    );
    expect(await listExpenses(pool, fremd.accountId)).toHaveLength(1);
  });
});

describe("findExpense (req-029)", () => {
  it("findet die Ausgabe des eigenen Accounts, nicht die fremde", async () => {
    const pool = createTestDb();
    const angelegt = await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(PARTICIPANT_ID, [PARTICIPANT_ID]),
      NOW,
    );
    expect(angelegt.ok).toBe(true);
    if (!angelegt.ok) return;

    const fremd = await fremderAccountMitReise(pool);
    expect(
      await findExpense(pool, ACCOUNT_ID, angelegt.expense.id),
    ).not.toBeNull();
    expect(
      await findExpense(pool, fremd.accountId, angelegt.expense.id),
    ).toBeNull();
  });
});

describe("Ausgaben und entfernte Personen (req-029)", () => {
  it("laesst eine Person entfernen, die schon einmal gezahlt hat", async () => {
    const pool = createTestDb();
    const ben = await mitfahrer(pool, "Ben Berger", 1);
    await createExpense(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      abendessen(ben.id, [ben.id, PARTICIPANT_ID]),
      NOW,
    );

    expect(await deleteParticipant(pool, ACCOUNT_ID, ben.id)).toBe(true);
    expect(await listExpenses(pool, ACCOUNT_ID)).toEqual([]);
  });
});
