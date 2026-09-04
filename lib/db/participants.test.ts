// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ID,
  createTestDb,
  PARTICIPANT_EMAIL,
  PARTICIPANT_ID,
} from "../../tests/test-db";
import {
  createParticipant,
  deleteParticipant,
  emailTakenInAccount,
  findParticipantByEmail,
  findParticipantById,
  findParticipantInAccount,
  listParticipants,
  setAccountAdmin,
  updateParticipant,
} from "./participants";
import { createAccount } from "./accounts";

const NOW = new Date("2026-09-03T10:00:00Z");

const CLARA = {
  name: "Clara Berger",
  nickname: "Clari",
  email: "clara@example.com",
  phone: "+43 664 1234567",
  iban: "AT611904300234573201",
};

describe("findParticipantByEmail", () => {
  it("findet das Konto des Betreibers (req-016)", async () => {
    const pool = createTestDb();

    const participant = await findParticipantByEmail(pool, PARTICIPANT_EMAIL);

    expect(participant).toEqual({
      id: PARTICIPANT_ID,
      accountId: ACCOUNT_ID,
      name: "Uwe Kremmel",
      nickname: null,
      email: PARTICIPANT_EMAIL,
      phone: null,
      iban: null,
      loginEnabled: true,
      // Die erste Person des Accounts ist Account-Admin (req-027).
      accountAdmin: true,
    });
  });

  it("findet das Konto unabhaengig von der Schreibweise", async () => {
    const pool = createTestDb();

    const participant = await findParticipantByEmail(pool, " Uwe@Kremmel.ORG ");

    expect(participant?.id).toBe(PARTICIPANT_ID);
  });

  it("liefert null fuer eine unbekannte Adresse", async () => {
    const pool = createTestDb();

    expect(await findParticipantByEmail(pool, "fremd@example.com")).toBeNull();
  });

  it("uebergeht eine erfasste Person ohne Zugang (req-019)", async () => {
    const pool = createTestDb();
    await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(await findParticipantByEmail(pool, CLARA.email)).toBeNull();
  });
});

describe("findParticipantById", () => {
  it("liefert den Mandanten mit, an dem die Reisedaten haengen", async () => {
    const pool = createTestDb();

    const participant = await findParticipantById(pool, PARTICIPANT_ID);

    expect(participant?.accountId).toBe(ACCOUNT_ID);
  });

  it("liefert null fuer eine unbekannte Id", async () => {
    const pool = createTestDb();

    expect(
      await findParticipantById(pool, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });

  it("uebergeht eine erfasste Person ohne Zugang (req-019)", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(await findParticipantById(pool, clara.id)).toBeNull();
    expect(
      await findParticipantInAccount(pool, ACCOUNT_ID, clara.id),
    ).not.toBeNull();
  });
});

describe("listParticipants (req-019)", () => {
  it("liefert die eigene Person des Accounts", async () => {
    const pool = createTestDb();

    const participants = await listParticipants(pool, ACCOUNT_ID);

    expect(participants).toHaveLength(1);
    expect(participants[0].id).toBe(PARTICIPANT_ID);
  });

  it("reiht neu Angelegtes hinter der eigenen Person ein", async () => {
    const pool = createTestDb();
    await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(
      (await listParticipants(pool, ACCOUNT_ID)).map((p) => p.name),
    ).toEqual(["Uwe Kremmel", "Clara Berger"]);
  });

  it("liefert keine Person eines anderen Accounts", async () => {
    const pool = createTestDb();
    await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(
      await listParticipants(pool, "8e5d4d05-2e42-4a2f-9e4a-6f1b2c3d4e5f"),
    ).toEqual([]);
  });
});

describe("createParticipant (req-019)", () => {
  it("legt die Person mit Telefonnummer und Bankverbindung an", async () => {
    const pool = createTestDb();

    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(clara).toMatchObject({ ...CLARA, accountId: ACCOUNT_ID });
    expect(await findParticipantInAccount(pool, ACCOUNT_ID, clara.id)).toEqual(
      clara,
    );
  });

  it("legt Name und Nickname nebeneinander ab (req-020)", async () => {
    const pool = createTestDb();

    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(clara).toMatchObject({ name: "Clara Berger", nickname: "Clari" });
    expect(
      await findParticipantInAccount(pool, ACCOUNT_ID, clara.id),
    ).toMatchObject({ name: "Clara Berger", nickname: "Clari" });
  });

  it("legt eine Person ohne Nicknamen an (req-020)", async () => {
    const pool = createTestDb();

    const gast = await createParticipant(
      pool,
      ACCOUNT_ID,
      { ...CLARA, name: "Max Gast", nickname: null, email: null },
      NOW,
    );

    expect(gast.nickname).toBeNull();
  });

  it("gibt der angelegten Person keinen Zugang zur Anwendung", async () => {
    const pool = createTestDb();

    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(clara.loginEnabled).toBe(false);
  });

  it("laesst mehrere Personen ohne Adresse zu", async () => {
    const pool = createTestDb();

    await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Max Gast",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      NOW,
    );
    await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Mia Gast",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      NOW,
    );

    expect(await listParticipants(pool, ACCOUNT_ID)).toHaveLength(3);
  });
});

describe("emailTakenInAccount (req-019)", () => {
  it("erkennt die Adresse der eigenen Person", async () => {
    const pool = createTestDb();

    expect(
      await emailTakenInAccount(pool, ACCOUNT_ID, " Uwe@Kremmel.ORG "),
    ).toBe(true);
  });

  it("nimmt die gerade geaenderte Person aus", async () => {
    const pool = createTestDb();

    expect(
      await emailTakenInAccount(
        pool,
        ACCOUNT_ID,
        PARTICIPANT_EMAIL,
        PARTICIPANT_ID,
      ),
    ).toBe(false);
  });

  it("meldet eine unbekannte Adresse als frei", async () => {
    const pool = createTestDb();

    expect(await emailTakenInAccount(pool, ACCOUNT_ID, CLARA.email)).toBe(
      false,
    );
  });
});

describe("updateParticipant (req-019)", () => {
  it("aendert die Telefonnummer", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    const geaendert = await updateParticipant(pool, ACCOUNT_ID, clara.id, {
      ...CLARA,
      phone: "+43 664 7654321",
    });

    expect(geaendert?.phone).toBe("+43 664 7654321");
    expect(
      (await findParticipantInAccount(pool, ACCOUNT_ID, clara.id))?.phone,
    ).toBe("+43 664 7654321");
  });

  it("entfernt den Nicknamen und laesst den Namen stehen (req-020)", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    const geaendert = await updateParticipant(pool, ACCOUNT_ID, clara.id, {
      ...CLARA,
      nickname: null,
    });

    expect(geaendert).toMatchObject({
      name: "Clara Berger",
      nickname: null,
    });
    expect(
      await findParticipantInAccount(pool, ACCOUNT_ID, clara.id),
    ).toMatchObject({ name: "Clara Berger", nickname: null });
  });

  it("laesst den Zugang unberuehrt", async () => {
    const pool = createTestDb();

    const geaendert = await updateParticipant(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      {
        name: "Uwe Kremmel",
        nickname: null,
        email: PARTICIPANT_EMAIL,
        phone: "+43 664 1111111",
        iban: null,
      },
    );

    expect(geaendert?.loginEnabled).toBe(true);
  });

  it("liefert null fuer eine Person eines anderen Accounts", async () => {
    const pool = createTestDb();

    expect(
      await updateParticipant(
        pool,
        "8e5d4d05-2e42-4a2f-9e4a-6f1b2c3d4e5f",
        PARTICIPANT_ID,
        { ...CLARA },
      ),
    ).toBeNull();
  });
});

describe("deleteParticipant (req-019)", () => {
  it("entfernt die Person", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(await deleteParticipant(pool, ACCOUNT_ID, clara.id)).toEqual({
      ok: true,
    });
    expect(await listParticipants(pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("weist eine Person eines anderen Accounts ab", async () => {
    const pool = createTestDb();

    expect(
      await deleteParticipant(
        pool,
        "8e5d4d05-2e42-4a2f-9e4a-6f1b2c3d4e5f",
        PARTICIPANT_ID,
      ),
    ).toEqual({ ok: false, reason: "unknown" });
    expect(await listParticipants(pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("weist das Entfernen des letzten Account-Admins ab (req-038)", async () => {
    const pool = createTestDb();
    await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    // Der Betreiber ist der einzige Account-Admin (siehe
    // migrations/0025_account_admin.sql) -- mit ihm verloere der Account
    // seinen letzten.
    expect(await deleteParticipant(pool, ACCOUNT_ID, PARTICIPANT_ID)).toEqual({
      ok: false,
      reason: "lastAdmin",
    });
    expect(
      await findParticipantInAccount(pool, ACCOUNT_ID, PARTICIPANT_ID),
    ).not.toBeNull();
  });

  it("entfernt einen Account-Admin, solange ein zweiter bleibt (req-038)", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await setAccountAdmin(pool, ACCOUNT_ID, clara.id, true);

    expect(await deleteParticipant(pool, ACCOUNT_ID, PARTICIPANT_ID)).toEqual({
      ok: true,
    });
    expect(
      (await findParticipantInAccount(pool, ACCOUNT_ID, clara.id))
        ?.accountAdmin,
    ).toBe(true);
  });
});

describe("setAccountAdmin (req-027)", () => {
  it("ernennt eine Person zum Account-Admin", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    const result = await setAccountAdmin(pool, ACCOUNT_ID, clara.id, true);

    expect(result).toMatchObject({ ok: true });
    expect(
      (await findParticipantInAccount(pool, ACCOUNT_ID, clara.id))
        ?.accountAdmin,
    ).toBe(true);
  });

  it("entzieht die Kennzeichnung wieder", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await setAccountAdmin(pool, ACCOUNT_ID, clara.id, true);

    const result = await setAccountAdmin(pool, ACCOUNT_ID, clara.id, false);

    expect(result).toMatchObject({ ok: true });
    expect(
      (await findParticipantInAccount(pool, ACCOUNT_ID, clara.id))
        ?.accountAdmin,
    ).toBe(false);
  });

  it("laesst dem letzten Account-Admin die Kennzeichnung", async () => {
    const pool = createTestDb();

    const result = await setAccountAdmin(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      false,
    );

    expect(result).toEqual({ ok: false, reason: "lastAdmin" });
    expect(
      (await findParticipantInAccount(pool, ACCOUNT_ID, PARTICIPANT_ID))
        ?.accountAdmin,
    ).toBe(true);
  });

  it("meldet eine Person eines anderen Accounts als unbekannt", async () => {
    const pool = createTestDb();

    expect(
      await setAccountAdmin(
        pool,
        "8e5d4d05-2e42-4a2f-9e4a-6f1b2c3d4e5f",
        PARTICIPANT_ID,
        false,
      ),
    ).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("Account-Admin beim Anlegen und Entfernen (req-027)", () => {
  it("gibt einer neu angelegten Person die Kennzeichnung nicht", async () => {
    const pool = createTestDb();

    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);

    expect(clara.accountAdmin).toBe(false);
    expect(
      (await findParticipantInAccount(pool, ACCOUNT_ID, clara.id))
        ?.accountAdmin,
    ).toBe(false);
  });

  it("gibt sie der ersten Person eines Accounts, wenn verlangt", async () => {
    const pool = createTestDb();
    const fremder = await createAccount(pool, "Familie Berger", CLARA.email);

    const erste = await createParticipant(pool, fremder.id, CLARA, NOW, true);

    expect(erste.accountAdmin).toBe(true);
    expect(
      (await findParticipantInAccount(pool, fremder.id, erste.id))
        ?.accountAdmin,
    ).toBe(true);
  });

  it("laesst nach dem Entfernen eines Account-Admins den verbliebenen unberuehrt", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(pool, ACCOUNT_ID, CLARA, NOW);
    await setAccountAdmin(pool, ACCOUNT_ID, clara.id, true);

    await deleteParticipant(pool, ACCOUNT_ID, PARTICIPANT_ID);

    expect(
      (await findParticipantInAccount(pool, ACCOUNT_ID, clara.id))
        ?.accountAdmin,
    ).toBe(true);
  });
});
