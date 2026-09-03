// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/test-db";
import { listAccountsOverview } from "../db/accounts";
import { listParticipants } from "../db/participants";
import { createAccountWithFirstPerson } from "./create-account";
import type { AccountInput } from "./validate";

const NOW = new Date("2026-09-03T12:00:00Z");

const HUBER: AccountInput = {
  name: "Familie Huber",
  personName: "Anna Huber",
  personEmail: "anna@huber.de",
};

describe("createAccountWithFirstPerson (req-025)", () => {
  it("legt den Account samt seiner ersten Person an", async () => {
    const pool = createTestDb();

    const account = await createAccountWithFirstPerson(pool, HUBER, NOW);

    expect(account).toMatchObject({ name: "Familie Huber", personCount: 1 });
    expect(account?.firstPerson).toMatchObject({
      name: "Anna Huber",
      access: "offen",
    });
  });

  it("laesst den neuen Account in der Liste erscheinen", async () => {
    const pool = createTestDb();

    await createAccountWithFirstPerson(pool, HUBER, NOW);

    const namen = (await listAccountsOverview(pool, NOW)).map(
      (entry) => entry.name,
    );
    expect(namen).toContain("Familie Huber");
  });

  it("gibt der ersten Person noch keinen Zugang", async () => {
    const pool = createTestDb();

    const account = await createAccountWithFirstPerson(pool, HUBER, NOW);
    const personen = await listParticipants(pool, account!.id);

    // Zugang hat, wer seinen Zugangslink eingeloest hat (req-023) -- das
    // Anlegen allein reicht nicht.
    expect(personen).toHaveLength(1);
    expect(personen[0].loginEnabled).toBe(false);
    expect(personen[0].email).toBe("anna@huber.de");
  });

  it("macht die erste Person zum Account-Admin (req-027)", async () => {
    const pool = createTestDb();

    const account = await createAccountWithFirstPerson(pool, HUBER, NOW);
    const personen = await listParticipants(pool, account!.id);

    // Sonst haette der neue Account niemanden, der seine Personen
    // verwalten darf.
    expect(personen[0].accountAdmin).toBe(true);
  });

  it("legt keinen Account an, wenn die Adresse schon vergeben ist", async () => {
    const pool = createTestDb();

    const zweiter = await createAccountWithFirstPerson(
      pool,
      { ...HUBER, personEmail: "uwe@kremmel.org" },
      NOW,
    );

    expect(zweiter).toBeNull();
    const namen = (await listAccountsOverview(pool, NOW)).map(
      (entry) => entry.name,
    );
    expect(namen).not.toContain("Familie Huber");
  });
});
