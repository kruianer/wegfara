// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { createAccount } from "../db/accounts";
import { listAccountSwitches } from "../db/account-switches";
import { createSession, findSessionByToken } from "../db/sessions";
import { returnToOwnAccount, switchToAccount } from "./switch-account";

const NOW = new Date("2026-09-03T12:00:00Z");

async function angemeldet(pool: ReturnType<typeof createTestDb>) {
  return createSession(pool, PARTICIPANT_ID, "token-1", NOW);
}

describe("switchToAccount (req-025)", () => {
  it("bringt die Sitzung in den fremden Account", async () => {
    const pool = createTestDb();
    const session = await angemeldet(pool);
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");

    const ok = await switchToAccount(pool, session, huber.id, NOW);

    expect(ok).toBe(true);
    const danach = await findSessionByToken(pool, "token-1", NOW);
    expect(danach?.accountId).toBe(huber.id);
    expect(danach?.actingAccount?.name).toBe("Familie Huber");
  });

  it("haelt den Wechsel fest: wer, in welchen Account, wann", async () => {
    const pool = createTestDb();
    const session = await angemeldet(pool);
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");

    await switchToAccount(pool, session, huber.id, NOW);

    expect(await listAccountSwitches(pool)).toEqual([
      {
        participantName: "Uwe Kremmel",
        accountName: "Familie Huber",
        accountId: huber.id,
        switchedAt: NOW,
      },
    ]);
  });

  it("wechselt nicht in einen Account, den es nicht gibt", async () => {
    const pool = createTestDb();
    const session = await angemeldet(pool);

    const ok = await switchToAccount(
      pool,
      session,
      "6f1f6a2b-0000-4000-8000-000000000000",
      NOW,
    );

    expect(ok).toBe(false);
    const danach = await findSessionByToken(pool, "token-1", NOW);
    expect(danach?.accountId).toBe(ACCOUNT_ID);
    expect(await listAccountSwitches(pool)).toEqual([]);
  });

  it("behandelt den eigenen Account als Rueckkehr und protokolliert ihn nicht", async () => {
    const pool = createTestDb();
    const session = await angemeldet(pool);
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");
    await switchToAccount(pool, session, huber.id, NOW);

    const ok = await switchToAccount(pool, session, ACCOUNT_ID, NOW);

    expect(ok).toBe(true);
    const danach = await findSessionByToken(pool, "token-1", NOW);
    expect(danach?.accountId).toBe(ACCOUNT_ID);
    expect(danach?.actingAccount).toBeNull();
    // Nur der Wechsel in einen fremden Account wird festgehalten.
    expect(await listAccountSwitches(pool)).toHaveLength(1);
  });
});

describe("returnToOwnAccount (req-025)", () => {
  it("bringt die Sitzung in den eigenen Account zurueck", async () => {
    const pool = createTestDb();
    const session = await angemeldet(pool);
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");
    await switchToAccount(pool, session, huber.id, NOW);

    await returnToOwnAccount(pool, session);

    const danach = await findSessionByToken(pool, "token-1", NOW);
    expect(danach?.accountId).toBe(ACCOUNT_ID);
    expect(danach?.actingAccount).toBeNull();
  });
});
