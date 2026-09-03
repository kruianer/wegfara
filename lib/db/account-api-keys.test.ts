// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { createAccountWithFirstPerson } from "../accounts/create-account";
import {
  accountApiKey,
  accountApiKeyStates,
  removeAccountApiKey,
  storeAccountApiKey,
} from "../api-keys/account-keys";

/**
 * Die Zugangsschluessel eines Accounts (req-028): verschluesselt abgelegt,
 * nie wieder ausgegeben, und strikt je Account getrennt.
 */

const NOW = new Date("2026-09-03T12:00:00Z");

type Pool = ReturnType<typeof createTestDb>;

let pool: Pool;

/** Ein zweiter Account, um die Trennung zu pruefen. */
async function zweiterAccount(): Promise<string> {
  const account = await createAccountWithFirstPerson(
    pool,
    {
      name: "Familie Huber",
      personName: "Anna Huber",
      personEmail: "anna@huber.de",
    },
    NOW,
  );
  return account!.id;
}

async function zeile(accountId: string, kind: string) {
  const { rows } = await pool.query(
    `select ciphertext, last_four from account_api_key
     where account_id = $1 and kind = $2`,
    [accountId, kind],
  );
  return rows[0] as { ciphertext: string; last_four: string } | undefined;
}

beforeEach(() => {
  pool = createTestDb();
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
});

describe("Zugangsschluessel je Account (req-028)", () => {
  it("meldet ohne hinterlegten Schluessel beide Arten als nicht gesetzt", async () => {
    expect(await accountApiKeyStates(pool, ACCOUNT_ID)).toEqual([
      { kind: "ki_suche", lastFour: null },
      { kind: "google", lastFour: null },
    ]);
  });

  it("zeigt nach dem Hinterlegen die letzten vier Zeichen", async () => {
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-test-a3f9", NOW);

    expect(await accountApiKeyStates(pool, ACCOUNT_ID)).toEqual([
      { kind: "ki_suche", lastFour: "a3f9" },
      { kind: "google", lastFour: null },
    ]);
  });

  it("legt den Schluessel nicht im Klartext ab", async () => {
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-test-a3f9", NOW);

    const gespeichert = await zeile(ACCOUNT_ID, "ki_suche");
    expect(gespeichert?.ciphertext).not.toContain("sk-test-a3f9");
    expect(gespeichert?.ciphertext).not.toContain("sk-test");
  });

  it("gibt den Schluessel fuer die Abfrage beim Dienst wieder heraus", async () => {
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-test-a3f9", NOW);

    expect(await accountApiKey(pool, ACCOUNT_ID, "ki_suche")).toBe(
      "sk-test-a3f9",
    );
  });

  it("ersetzt einen vorhandenen Schluessel, statt einen zweiten anzulegen", async () => {
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-test-a3f9", NOW);

    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-neu-bbbb", NOW);

    expect(await accountApiKey(pool, ACCOUNT_ID, "ki_suche")).toBe(
      "sk-neu-bbbb",
    );
    const { rows } = await pool.query(
      `select kind from account_api_key where account_id = $1`,
      [ACCOUNT_ID],
    );
    expect(rows).toHaveLength(1);
  });

  it("haelt die beiden Arten auseinander", async () => {
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-ki-1111", NOW);
    await storeAccountApiKey(pool, ACCOUNT_ID, "google", "goo-gle-2222", NOW);

    expect(await accountApiKey(pool, ACCOUNT_ID, "ki_suche")).toBe(
      "sk-ki-1111",
    );
    expect(await accountApiKey(pool, ACCOUNT_ID, "google")).toBe(
      "goo-gle-2222",
    );
  });

  it("meldet einen entfernten Schluessel wieder als nicht gesetzt", async () => {
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-test-a3f9", NOW);

    const danach = await removeAccountApiKey(pool, ACCOUNT_ID, "ki_suche");

    expect(danach).toContainEqual({ kind: "ki_suche", lastFour: null });
    expect(await accountApiKey(pool, ACCOUNT_ID, "ki_suche")).toBeNull();
  });

  it("gibt den Schluessel eines Accounts keinem anderen", async () => {
    const fremder = await zweiterAccount();
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-test-a3f9", NOW);

    expect(await accountApiKey(pool, fremder, "ki_suche")).toBeNull();
    expect(await accountApiKeyStates(pool, fremder)).toEqual([
      { kind: "ki_suche", lastFour: null },
      { kind: "google", lastFour: null },
    ]);
  });

  it("legt ohne Geheimnis in der Umgebung nichts ab", async () => {
    vi.stubEnv("AUTH_SECRET", "");

    const ergebnis = await storeAccountApiKey(
      pool,
      ACCOUNT_ID,
      "ki_suche",
      "sk-test-a3f9",
      NOW,
    );

    expect(ergebnis).toBeNull();
    expect(await zeile(ACCOUNT_ID, "ki_suche")).toBeUndefined();
  });

  it("liefert nichts, wenn das Geheimnis der Umgebung ein anderes ist", async () => {
    await storeAccountApiKey(pool, ACCOUNT_ID, "ki_suche", "sk-test-a3f9", NOW);

    // Ein Backup allein laesst sich nicht auswerten: der zum Entschluesseln
    // noetige Wert steht nicht in der Datenbank (req-028, Constraints).
    vi.stubEnv("AUTH_SECRET", "ein-ganz-anderes-geheimnis");

    expect(await accountApiKey(pool, ACCOUNT_ID, "ki_suche")).toBeNull();
  });
});
