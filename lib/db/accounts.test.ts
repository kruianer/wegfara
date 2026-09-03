// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import {
  accountExists,
  createAccount,
  emailTakenAnywhere,
  findFirstPersonOfAccount,
  listAccountsOverview,
} from "./accounts";
import { createParticipant, enableLogin } from "./participants";
import { createAccessLink } from "./access-links";

const NOW = new Date("2026-09-03T12:00:00Z");

function daysLater(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Der Account "Familie Huber" samt erster Person "Anna Huber" (req-025). */
async function familieHuber(pool: ReturnType<typeof createTestDb>) {
  const account = await createAccount(pool, "Familie Huber", "anna@huber.de");
  const anna = await createParticipant(
    pool,
    account.id,
    {
      name: "Anna Huber",
      nickname: null,
      email: "anna@huber.de",
      phone: null,
      iban: null,
    },
    NOW,
  );
  return { account, anna };
}

describe("createAccount (req-025)", () => {
  it("legt einen Account an, der danach existiert", async () => {
    const pool = createTestDb();

    const account = await createAccount(pool, "Familie Huber", "anna@huber.de");

    expect(account.name).toBe("Familie Huber");
    expect(await accountExists(pool, account.id)).toBe(true);
  });

  it("kennt einen erfundenen Account nicht", async () => {
    const pool = createTestDb();

    expect(
      await accountExists(pool, "6f1f6a2b-0000-4000-8000-000000000000"),
    ).toBe(false);
  });
});

describe("emailTakenAnywhere (req-025)", () => {
  it("erkennt die Adresse einer bestehenden Person", async () => {
    const pool = createTestDb();

    expect(await emailTakenAnywhere(pool, "uwe@kremmel.org")).toBe(true);
    // Die Adresse ist installationsweit eindeutig -- Gross- und
    // Kleinschreibung machen keinen Unterschied.
    expect(await emailTakenAnywhere(pool, "UWE@Kremmel.org")).toBe(true);
  });

  it("erkennt die Adresse eines bestehenden Accounts", async () => {
    const pool = createTestDb();
    await createAccount(pool, "Familie Huber", "anna@huber.de");

    expect(await emailTakenAnywhere(pool, "anna@huber.de")).toBe(true);
  });

  it("laesst eine unbenutzte Adresse durch", async () => {
    const pool = createTestDb();

    expect(await emailTakenAnywhere(pool, "neu@example.com")).toBe(false);
  });
});

describe("listAccountsOverview (req-025)", () => {
  it("nennt je Account Namen, Personenzahl und die erste Person", async () => {
    const pool = createTestDb();
    const { account, anna } = await familieHuber(pool);
    await createParticipant(
      pool,
      account.id,
      {
        name: "Bert Huber",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      daysLater(1),
    );

    const uebersicht = await listAccountsOverview(pool, NOW);
    const huber = uebersicht.find((entry) => entry.id === account.id);

    expect(huber).toMatchObject({
      name: "Familie Huber",
      personCount: 2,
    });
    // Die erste Person ist die aelteste des Accounts.
    expect(huber?.firstPerson).toMatchObject({
      id: anna.id,
      name: "Anna Huber",
    });
  });

  it("fuehrt alle Accounts auf, auch den eigenen", async () => {
    const pool = createTestDb();
    const { account } = await familieHuber(pool);

    const ids = (await listAccountsOverview(pool, NOW)).map(
      (entry) => entry.id,
    );

    expect(ids).toContain(ACCOUNT_ID);
    expect(ids).toContain(account.id);
  });

  it("zeigt die erste Person ohne Einladung als 'offen'", async () => {
    const pool = createTestDb();
    const { account } = await familieHuber(pool);

    const uebersicht = await listAccountsOverview(pool, NOW);

    expect(
      uebersicht.find((entry) => entry.id === account.id)?.firstPerson?.access,
    ).toBe("offen");
  });

  it("zeigt sie nach dem Erzeugen des Zugangslinks als 'eingeladen'", async () => {
    const pool = createTestDb();
    const { account, anna } = await familieHuber(pool);
    await createAccessLink(pool, anna.id, "geheim-1", NOW);

    const uebersicht = await listAccountsOverview(pool, NOW);

    expect(
      uebersicht.find((entry) => entry.id === account.id)?.firstPerson?.access,
    ).toBe("eingeladen");
  });

  it("zaehlt einen abgelaufenen Zugangslink nicht als Einladung", async () => {
    const pool = createTestDb();
    const { account, anna } = await familieHuber(pool);
    await createAccessLink(pool, anna.id, "geheim-1", NOW);

    const uebersicht = await listAccountsOverview(pool, daysLater(8));

    expect(
      uebersicht.find((entry) => entry.id === account.id)?.firstPerson?.access,
    ).toBe("offen");
  });

  it("zeigt sie nach dem Einloesen als 'eingeloest'", async () => {
    const pool = createTestDb();
    const { account, anna } = await familieHuber(pool);
    await createAccessLink(pool, anna.id, "geheim-1", NOW);
    await enableLogin(pool, anna.id);

    const uebersicht = await listAccountsOverview(pool, NOW);

    expect(
      uebersicht.find((entry) => entry.id === account.id)?.firstPerson?.access,
    ).toBe("eingeloest");
  });

  it("kommt mit einem Account ohne Personen zurecht", async () => {
    const pool = createTestDb();
    const leer = await createAccount(pool, "Noch leer", "leer@example.com");

    const uebersicht = await listAccountsOverview(pool, NOW);
    const eintrag = uebersicht.find((entry) => entry.id === leer.id);

    expect(eintrag?.personCount).toBe(0);
    expect(eintrag?.firstPerson).toBeNull();
  });
});

describe("findFirstPersonOfAccount (req-025)", () => {
  it("liefert die aelteste Person des Accounts", async () => {
    const pool = createTestDb();
    const { account, anna } = await familieHuber(pool);
    await createParticipant(
      pool,
      account.id,
      {
        name: "Bert Huber",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      daysLater(1),
    );

    expect(await findFirstPersonOfAccount(pool, account.id)).toMatchObject({
      id: anna.id,
      name: "Anna Huber",
    });
  });

  it("liefert null, wenn der Account keine Person hat", async () => {
    const pool = createTestDb();
    const leer = await createAccount(pool, "Noch leer", "leer@example.com");

    expect(await findFirstPersonOfAccount(pool, leer.id)).toBeNull();
  });
});
