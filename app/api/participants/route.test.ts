// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PARTICIPANT_EMAIL,
  PARTICIPANT_ID,
  createTestDb,
} from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { ACCOUNT_ID } from "@/lib/account";
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

const { createSession } = await import("@/lib/db/sessions");
const { listParticipants } = await import("@/lib/db/participants");
const { DELETE, POST, PUT } = await import("./route");

const CLARA = {
  name: "Clara Berger",
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
      email: null,
      phone: null,
      iban: null,
    });
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
});
