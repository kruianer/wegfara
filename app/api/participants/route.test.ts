// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_ID,
  createTestDb,
  PARTICIPANT_EMAIL,
  PARTICIPANT_ID,
} from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { PARTICIPANT_ERRORS } from "@/lib/participants/validate";
import type { Participant } from "@/lib/participants/types";

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

const { createSession, findSessionByToken, setActingAccount } = await import(
  "@/lib/db/sessions"
);
const { createAccount } = await import("@/lib/db/accounts");
const { findParticipantInAccount, listParticipants, setAccountAdmin } =
  await import("@/lib/db/participants");
const { DELETE, POST, PUT } = await import("./route");

const CLARA = {
  name: "Clara Berger",
  nickname: "Clari",
  email: "clara@example.com",
  phone: "+43 664 1234567",
  iban: "AT611904300234573201",
};

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/participants", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function anlegen(body: unknown): Promise<Participant> {
  const response = await POST(anfrage(body));
  const { participant } = (await response.json()) as {
    participant: Participant;
  };
  return participant;
}

async function fehler(
  response: Response,
): Promise<Record<string, string | undefined>> {
  const { errors } = (await response.json()) as {
    errors: Record<string, string>;
  };
  return errors;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/participants (req-019)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(anfrage(CLARA))).status).toBe(401);
  });

  it("legt die Person an und liefert sie zurueck", async () => {
    await angemeldet();

    const response = await POST(anfrage(CLARA));

    expect(response.status).toBe(201);
    const { participant } = (await response.json()) as {
      participant: Participant;
    };
    expect(participant).toMatchObject({ ...CLARA, loginEnabled: false });
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(2);
  });

  it("legt eine Person nur mit Namen an", async () => {
    await angemeldet();

    const response = await POST(anfrage({ name: "Max Gast" }));

    expect(response.status).toBe(201);
    const { participant } = (await response.json()) as {
      participant: Participant;
    };
    expect(participant).toMatchObject({
      name: "Max Gast",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    });
  });

  it("legt Name und Nickname nebeneinander an (req-020)", async () => {
    await angemeldet();

    const response = await POST(anfrage(CLARA));

    expect(response.status).toBe(201);
    const { participant } = (await response.json()) as {
      participant: Participant;
    };
    expect(participant).toMatchObject({
      name: "Clara Berger",
      nickname: "Clari",
    });
  });

  it("legt bei einem zu langen Nicknamen nichts an (req-020)", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...CLARA, nickname: "N".repeat(21) }),
    );

    expect(response.status).toBe(400);
    expect((await fehler(response)).nickname).toBe(
      PARTICIPANT_ERRORS.nicknameTooLong,
    );
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("legt eine Person nur mit Nicknamen nicht an (req-020)", async () => {
    await angemeldet();

    const response = await POST(anfrage({ nickname: "Clari" }));

    expect(response.status).toBe(400);
    expect((await fehler(response)).name).toBe(PARTICIPANT_ERRORS.nameRequired);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("legt ohne Namen nichts an und benennt die Stelle", async () => {
    await angemeldet();

    const response = await POST(anfrage({ ...CLARA, name: "  " }));

    expect(response.status).toBe(400);
    expect((await fehler(response)).name).toBe(PARTICIPANT_ERRORS.nameRequired);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("legt bei unzulaessiger Bankverbindung nichts an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...CLARA, iban: "AT611904300234573200" }),
    );

    expect(response.status).toBe(400);
    expect((await fehler(response)).iban).toBe(PARTICIPANT_ERRORS.ibanInvalid);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("legt bei bereits vergebener Adresse nichts an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...CLARA, email: PARTICIPANT_EMAIL }),
    );

    expect(response.status).toBe(400);
    expect((await fehler(response)).email).toBe(PARTICIPANT_ERRORS.emailTaken);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });
});

describe("PUT /api/participants (req-019)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await PUT(anfrage({ id: PARTICIPANT_ID, ...CLARA }))).status).toBe(
      401,
    );
  });

  it("aendert die Telefonnummer", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);

    const response = await PUT(
      anfrage({ id: clara.id, ...CLARA, phone: "+43 664 7654321" }),
    );

    expect(response.status).toBe(200);
    const { participant } = (await response.json()) as {
      participant: Participant;
    };
    expect(participant.phone).toBe("+43 664 7654321");
  });

  it("entfernt den Nicknamen und laesst den Namen stehen (req-020)", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);

    const response = await PUT(
      anfrage({ id: clara.id, ...CLARA, nickname: "" }),
    );

    expect(response.status).toBe(200);
    const { participant } = (await response.json()) as {
      participant: Participant;
    };
    expect(participant).toMatchObject({
      name: "Clara Berger",
      nickname: null,
    });
  });

  it("uebernimmt einen zu langen Nicknamen nicht (req-020)", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);

    const response = await PUT(
      anfrage({ id: clara.id, ...CLARA, nickname: "N".repeat(21) }),
    );

    expect(response.status).toBe(400);
    expect((await fehler(response)).nickname).toBe(
      PARTICIPANT_ERRORS.nicknameTooLong,
    );
    const unveraendert = await listParticipants(testDb.pool, ACCOUNT_ID);
    expect(unveraendert.at(-1)?.nickname).toBe("Clari");
  });

  it("aendert die Angaben der eigenen Person", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        id: PARTICIPANT_ID,
        name: "Uwe Kremmel",
        email: PARTICIPANT_EMAIL,
        phone: "+43 664 0000000",
        iban: "",
      }),
    );

    expect(response.status).toBe(200);
    const { participant } = (await response.json()) as {
      participant: Participant;
    };
    expect(participant).toMatchObject({
      phone: "+43 664 0000000",
      loginEnabled: true,
    });
  });

  it("laesst die Adresse der eigenen Person nicht entfernen", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({ id: PARTICIPANT_ID, name: "Uwe Kremmel", email: "" }),
    );

    expect(response.status).toBe(400);
    expect((await fehler(response)).email).toBe(
      PARTICIPANT_ERRORS.emailRequiredForLogin,
    );
  });

  it("laesst die Adresse einer anderen Person nicht uebernehmen", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);

    const response = await PUT(
      anfrage({ id: clara.id, ...CLARA, email: PARTICIPANT_EMAIL }),
    );

    expect(response.status).toBe(400);
    expect((await fehler(response)).email).toBe(PARTICIPANT_ERRORS.emailTaken);
  });

  it("laesst die eigene Adresse stehen", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);

    const response = await PUT(anfrage({ id: clara.id, ...CLARA }));

    expect(response.status).toBe(200);
  });

  it("kennt keine Person eines anderen Accounts", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({ id: "00000000-0000-4000-8000-000000000001", ...CLARA }),
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/participants (req-019)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await DELETE(anfrage({ id: PARTICIPANT_ID }))).status).toBe(401);
  });

  it("entfernt die Person", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);

    const response = await DELETE(anfrage({ id: clara.id }));

    expect(response.status).toBe(200);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("entfernt die eigene Person nicht", async () => {
    await angemeldet();

    const response = await DELETE(anfrage({ id: PARTICIPANT_ID }));

    expect(response.status).toBe(409);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("kennt keine Person eines anderen Accounts", async () => {
    await angemeldet();

    const response = await DELETE(
      anfrage({ id: "00000000-0000-4000-8000-000000000001" }),
    );

    expect(response.status).toBe(404);
  });

  it("meldet die entfernte Person sofort ab (req-038)", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);
    await createSession(testDb.pool, clara.id, "clara-token", new Date());

    await DELETE(anfrage({ id: clara.id }));

    expect(
      await findSessionByToken(testDb.pool, "clara-token", new Date()),
    ).toBeNull();
  });

  it("weist das Entfernen des letzten Bereichs-Admins ab (req-038)", async () => {
    // Der Gesamt-Admin wechselt in einen fremden Bereich, dessen einziger
    // Bereichs-Admin Clara ist. Auch er darf sie nicht entfernen -- ein
    // Bereich hat immer mindestens einen Bereichs-Admin (req-027).
    await angemeldet();
    const fremder = await createAccount(
      testDb.pool,
      "Familie Berger",
      "berger@example.com",
    );
    const sitzung = await findSessionByToken(
      testDb.pool,
      "token-1",
      new Date(),
    );
    await setActingAccount(testDb.pool, sitzung!.id, fremder.id);
    const erste = await anlegen(CLARA);
    await setAccountAdmin(testDb.pool, fremder.id, erste.id, true);

    const response = await DELETE(anfrage({ id: erste.id }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "lastAdmin" });
    expect(
      await findParticipantInAccount(testDb.pool, fremder.id, erste.id),
    ).not.toBeNull();
  });

  it("laesst einen Bereichs-Admin entfernen, solange ein zweiter bleibt (req-038)", async () => {
    await angemeldet();
    const clara = await anlegen(CLARA);
    await setAccountAdmin(testDb.pool, ACCOUNT_ID, clara.id, true);

    const response = await DELETE(anfrage({ id: clara.id }));

    expect(response.status).toBe(200);
  });
});

describe("Nur der Account-Admin darf verwalten (req-027)", () => {
  /**
   * Meldet eine Person an, die die Kennzeichnung Account-Admin nicht
   * traegt. Angelegt wird sie vom Betreiber -- er ist der Account-Admin
   * des Accounts (siehe migrations/0025_account_admin.sql).
   */
  async function angemeldetOhneKennzeichnung(): Promise<Participant> {
    await angemeldet();
    const clara = await anlegen(CLARA);
    await createSession(testDb.pool, clara.id, "token-2", new Date());
    cookieJar.werte[SESSION_COOKIE] = "token-2";
    return clara;
  }

  it("legt fuer eine Person ohne die Kennzeichnung nichts an", async () => {
    await angemeldetOhneKennzeichnung();

    const response = await POST(
      anfrage({ ...CLARA, name: "Max Gast", email: "max@example.com" }),
    );

    expect(response.status).toBe(403);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(2);
  });

  it("aendert fuer sie nichts", async () => {
    const clara = await angemeldetOhneKennzeichnung();

    const response = await PUT(
      anfrage({ ...CLARA, id: clara.id, phone: "+43 664 7654321" }),
    );

    expect(response.status).toBe(403);
    const unveraendert = await findParticipantInAccount(
      testDb.pool,
      ACCOUNT_ID,
      clara.id,
    );
    expect(unveraendert?.phone).toBe(CLARA.phone);
  });

  it("entfernt fuer sie nichts", async () => {
    await angemeldetOhneKennzeichnung();

    const response = await DELETE(anfrage({ id: PARTICIPANT_ID }));

    expect(response.status).toBe(403);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(2);
  });

  it("laesst den Account-Admin weiterhin anlegen", async () => {
    await angemeldet();

    const response = await POST(anfrage(CLARA));

    expect(response.status).toBe(201);
  });

  it("laesst den Gesamt-Admin im fremden Account anlegen", async () => {
    await angemeldet();
    const fremder = await createAccount(
      testDb.pool,
      "Familie Berger",
      "berger@example.com",
    );
    const sitzung = await findSessionByToken(
      testDb.pool,
      "token-1",
      new Date(),
    );
    await setActingAccount(testDb.pool, sitzung!.id, fremder.id);

    const response = await POST(anfrage(CLARA));

    expect(response.status).toBe(201);
    expect(await listParticipants(testDb.pool, fremder.id)).toHaveLength(1);
    expect(await listParticipants(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });
});
