// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "../../tests/test-db";
import {
  createCredential,
  findCredentialById,
  listCredentials,
  updateCredentialUsage,
} from "./credentials";

const NOW = new Date("2026-08-16T12:00:00Z");

function passkey(id: string, label = "Passkey") {
  return {
    id,
    participantId: PARTICIPANT_ID,
    publicKey: "oeffentlicher-schluessel",
    counter: 0,
    transports: ["internal", "hybrid"],
    label,
  };
}

describe("createCredential", () => {
  it("hinterlegt einen Passkey am Konto", async () => {
    const pool = createTestDb();

    await createCredential(pool, passkey("cred-1", "Telefon"), NOW);

    const credentials = await listCredentials(pool, PARTICIPANT_ID);
    expect(credentials).toHaveLength(1);
    expect(credentials[0]).toMatchObject({
      id: "cred-1",
      label: "Telefon",
      transports: ["internal", "hybrid"],
      counter: 0,
    });
  });

  it("laesst mehrere Passkeys je Konto zu, fuer mehrere Geraete (req-016)", async () => {
    const pool = createTestDb();

    await createCredential(pool, passkey("cred-1", "Telefon"), NOW);
    await createCredential(pool, passkey("cred-2", "Laptop"), NOW);

    expect(await listCredentials(pool, PARTICIPANT_ID)).toHaveLength(2);
  });

  it("kommt ohne Transportangaben aus", async () => {
    const pool = createTestDb();

    await createCredential(pool, { ...passkey("cred-1"), transports: [] }, NOW);

    expect((await listCredentials(pool, PARTICIPANT_ID))[0].transports).toEqual(
      [],
    );
  });
});

describe("findCredentialById", () => {
  it("findet den Passkey, mit dem sich jemand anmeldet", async () => {
    const pool = createTestDb();
    await createCredential(pool, passkey("cred-1"), NOW);

    expect((await findCredentialById(pool, "cred-1"))?.participantId).toBe(
      PARTICIPANT_ID,
    );
  });

  it("liefert null fuer einen unbekannten Passkey", async () => {
    const pool = createTestDb();

    expect(await findCredentialById(pool, "cred-fremd")).toBeNull();
  });
});

describe("updateCredentialUsage", () => {
  it("schreibt den Zaehler fort, mit dem geklonte Geraete auffallen", async () => {
    const pool = createTestDb();
    await createCredential(pool, passkey("cred-1"), NOW);

    await updateCredentialUsage(pool, "cred-1", 7, NOW);

    const credential = await findCredentialById(pool, "cred-1");
    expect(credential?.counter).toBe(7);
    expect(credential?.lastUsedAt).toEqual(NOW);
  });
});
