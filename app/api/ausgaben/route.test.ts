// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Expense } from "@/lib/expenses/types";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { createSession } = await import("@/lib/db/sessions");
const { createParticipant } = await import("@/lib/db/participants");
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { listExpenses } = await import("@/lib/db/expenses");
const { sumShares } = await import("@/lib/expenses/split");
const { DELETE, POST, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

function anfrage(method: string, body: unknown) {
  return new Request("https://dev.wegfara.com/api/ausgaben", {
    method,
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Eine weitere Person, die bei der Reise mitfaehrt. */
async function mitfahrer(name: string, minuten: number) {
  const person = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    { name, nickname: null, email: null, phone: null, iban: null },
    new Date(Date.UTC(2026, 6, 1, 0, minuten)),
  );
  await assignTripParticipant(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    person.id,
    "teilnehmer",
  );
  return person;
}

/** Die Kursquelle antwortet nie im Netz -- sie wird hier gestellt. */
function kursquelle(rate: number | "offline") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (rate === "offline") throw new Error("offline");
      return { ok: true, json: async () => ({ rates: { EUR: rate } }) };
    }),
  );
}

function gleichmaessig(beteiligte: string[], overrides: object = {}) {
  return {
    tripId: SUEDITALIEN_ID,
    title: "Abendessen",
    originalAmountCents: 6000,
    currency: "EUR",
    payerId: PARTICIPANT_ID,
    splitMode: "gleichmaessig",
    shares: beteiligte.map((participantId) => ({
      participantId,
      amountCents: 0,
    })),
    ...overrides,
  };
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/ausgaben (req-029)", () => {
  it("verlangt eine Anmeldung", async () => {
    const response = await POST(anfrage("POST", gleichmaessig([])));

    expect(response.status).toBe(401);
  });

  it("teilt 60,00 € gleichmaessig auf drei Personen", async () => {
    await angemeldet();
    const ben = await mitfahrer("Ben Berger", 1);
    const clara = await mitfahrer("Clara Berger", 2);

    const response = await POST(
      anfrage("POST", gleichmaessig([PARTICIPANT_ID, ben.id, clara.id])),
    );

    expect(response.status).toBe(200);
    const { expense } = (await response.json()) as { expense: Expense };
    expect(expense.amountCents).toBe(6000);
    expect(expense.shares.map((share) => share.amountCents)).toEqual([
      2000, 2000, 2000,
    ]);
  });

  it("trifft bei 10,00 € auf drei Personen in der Summe genau 10,00 €", async () => {
    await angemeldet();
    const ben = await mitfahrer("Ben Berger", 1);
    const clara = await mitfahrer("Clara Berger", 2);

    const response = await POST(
      anfrage(
        "POST",
        gleichmaessig([PARTICIPANT_ID, ben.id, clara.id], {
          originalAmountCents: 1000,
        }),
      ),
    );

    const { expense } = (await response.json()) as { expense: Expense };
    expect(sumShares(expense.shares)).toBe(1000);
    expect(
      expense.shares.find((share) => share.participantId === PARTICIPANT_ID)
        ?.amountCents,
    ).toBe(334);
  });

  it("gibt dem nicht beteiligten Zahler keinen Anteil", async () => {
    await angemeldet();
    const ben = await mitfahrer("Ben Berger", 1);

    const response = await POST(anfrage("POST", gleichmaessig([ben.id])));

    const { expense } = (await response.json()) as { expense: Expense };
    expect(expense.payerId).toBe(PARTICIPANT_ID);
    expect(
      expense.shares.some((share) => share.participantId === PARTICIPANT_ID),
    ).toBe(false);
    expect(sumShares(expense.shares)).toBe(6000);
  });

  it("ermittelt den Kurs und speichert ihn mit der Ausgabe", async () => {
    await angemeldet();
    kursquelle(1.06);

    const response = await POST(
      anfrage(
        "POST",
        gleichmaessig([PARTICIPANT_ID], {
          originalAmountCents: 9500,
          currency: "CHF",
        }),
      ),
    );

    expect(response.status).toBe(200);
    const { expense } = (await response.json()) as { expense: Expense };
    expect(expense.exchangeRate).toBe(1.06);
    expect(expense.originalAmountCents).toBe(9500);
    expect(expense.currency).toBe("CHF");
    expect(expense.amountCents).toBe(10070);
  });

  it("speichert eine Ausgabe in fremder Waehrung nicht ohne Kurs", async () => {
    await angemeldet();
    kursquelle("offline");

    const response = await POST(
      anfrage(
        "POST",
        gleichmaessig([PARTICIPANT_ID], {
          originalAmountCents: 9500,
          currency: "CHF",
        }),
      ),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "rateUnavailable" });
    expect(await listExpenses(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("speichert eine Ausgabe in Euro auch ohne erreichbare Kursquelle", async () => {
    await angemeldet();
    kursquelle("offline");

    const response = await POST(
      anfrage("POST", gleichmaessig([PARTICIPANT_ID])),
    );

    expect(response.status).toBe(200);
    expect(await listExpenses(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("speichert ohne Titel nicht", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", gleichmaessig([PARTICIPANT_ID], { title: "  " })),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "titleMissing" });
    expect(await listExpenses(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("speichert ohne beteiligte Person nicht", async () => {
    await angemeldet();

    const response = await POST(anfrage("POST", gleichmaessig([])));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "noParticipants" });
  });

  it("speichert nicht, wenn die individuellen Anteile abweichen", async () => {
    await angemeldet();
    const ben = await mitfahrer("Ben Berger", 1);
    const clara = await mitfahrer("Clara Berger", 2);

    const response = await POST(
      anfrage("POST", {
        ...gleichmaessig([]),
        splitMode: "individuell",
        shares: [
          { participantId: PARTICIPANT_ID, amountCents: 2000 },
          { participantId: ben.id, amountCents: 2000 },
          { participantId: clara.id, amountCents: 1500 },
        ],
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "sharesMismatch" });
    expect(await listExpenses(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("weist eine Person ab, die bei dieser Reise nicht mitfaehrt", async () => {
    await angemeldet();
    const daheim = await createParticipant(
      testDb.pool,
      ACCOUNT_ID,
      {
        name: "Dora Berger",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      new Date(),
    );

    const response = await POST(
      anfrage("POST", gleichmaessig([PARTICIPANT_ID, daheim.id])),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "notInTrip" });
  });

  it("weist eine unbrauchbare Anfrage ab", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", { ...gleichmaessig([PARTICIPANT_ID]), currency: "YEN" }),
    );

    expect(response.status).toBe(400);
  });
});

describe("PUT /api/ausgaben (req-029)", () => {
  async function angelegt(body: object = {}) {
    const response = await POST(
      anfrage("POST", gleichmaessig([PARTICIPANT_ID], body)),
    );
    const { expense } = (await response.json()) as { expense: Expense };
    return expense;
  }

  it("aendert Titel und Betrag", async () => {
    await angemeldet();
    const expense = await angelegt();

    const response = await PUT(
      anfrage("PUT", {
        id: expense.id,
        ...gleichmaessig([PARTICIPANT_ID], {
          title: "Mittagessen",
          originalAmountCents: 4000,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const geaendert = (await response.json()) as { expense: Expense };
    expect(geaendert.expense.title).toBe("Mittagessen");
    expect(geaendert.expense.amountCents).toBe(4000);
  });

  it("laesst den einmal ermittelten Kurs stehen", async () => {
    await angemeldet();
    kursquelle(1.06);
    const expense = await angelegt({
      originalAmountCents: 9500,
      currency: "CHF",
    });

    // Die Quelle nennt inzwischen einen anderen Kurs -- er darf die
    // bereits erfasste Ausgabe nicht mehr verschieben (req-029).
    kursquelle(1.2);
    const response = await PUT(
      anfrage("PUT", {
        id: expense.id,
        ...gleichmaessig([PARTICIPANT_ID], {
          originalAmountCents: 9500,
          currency: "CHF",
          title: "Abendessen in Zürich",
        }),
      }),
    );

    const { expense: geaendert } = (await response.json()) as {
      expense: Expense;
    };
    expect(geaendert.exchangeRate).toBe(1.06);
    expect(geaendert.amountCents).toBe(10070);
  });

  it("holt fuer eine andere Waehrung einen eigenen Kurs", async () => {
    await angemeldet();
    const expense = await angelegt();
    kursquelle(0.86);

    const response = await PUT(
      anfrage("PUT", {
        id: expense.id,
        ...gleichmaessig([PARTICIPANT_ID], {
          originalAmountCents: 6000,
          currency: "USD",
        }),
      }),
    );

    const { expense: geaendert } = (await response.json()) as {
      expense: Expense;
    };
    expect(geaendert.currency).toBe("USD");
    expect(geaendert.exchangeRate).toBe(0.86);
    expect(geaendert.amountCents).toBe(5160);
  });

  it("meldet eine unbekannte Ausgabe", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage("PUT", {
        id: "0f5c8a3e-1f6d-4a9b-9a1e-000000000000",
        ...gleichmaessig([PARTICIPANT_ID]),
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/ausgaben (req-029)", () => {
  it("entfernt die Ausgabe", async () => {
    await angemeldet();
    const response = await POST(
      anfrage("POST", gleichmaessig([PARTICIPANT_ID])),
    );
    const { expense } = (await response.json()) as { expense: Expense };

    const geloescht = await DELETE(anfrage("DELETE", { id: expense.id }));

    expect(geloescht.status).toBe(200);
    expect(await listExpenses(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("meldet eine unbekannte Ausgabe", async () => {
    await angemeldet();

    const response = await DELETE(
      anfrage("DELETE", { id: "0f5c8a3e-1f6d-4a9b-9a1e-000000000000" }),
    );

    expect(response.status).toBe(404);
  });
});
