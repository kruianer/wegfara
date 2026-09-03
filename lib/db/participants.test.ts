// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PARTICIPANT_EMAIL,
  PARTICIPANT_ID,
  createTestDb,
} from "../../tests/test-db";
import { ACCOUNT_ID } from "../account";
import {
  createParticipant,
  deleteParticipant,
  emailTakenInAccount,
  findParticipantByEmail,
  findParticipantById,
  findParticipantInAccount,
  listParticipants,
  updateParticipant,
} from "./participants";

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

    expect(await deleteParticipant(pool, ACCOUNT_ID, clara.id)).toBe(true);
    expect(await listParticipants(pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("liefert false fuer eine Person eines anderen Accounts", async () => {
    const pool = createTestDb();

    expect(
      await deleteParticipant(
        pool,
        "8e5d4d05-2e42-4a2f-9e4a-6f1b2c3d4e5f",
        PARTICIPANT_ID,
      ),
    ).toBe(false);
    expect(await listParticipants(pool, ACCOUNT_ID)).toHaveLength(1);
  });
});
