// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, PARTICIPANT_ID, createTestDb } from "../../tests/test-db";
import {
  createCredential,
  deleteCredential,
  findCredentialById,
  listCredentials,
  updateCredentialUsage,
} from "./credentials";
import { createSession, findSessionByToken } from "./sessions";
import { createParticipant } from "./participants";

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

describe("deleteCredential (req-037)", () => {
  it("entfernt ein Geraet aus Meine Geraete", async () => {
    const pool = createTestDb();
    await createCredential(pool, passkey("cred-1", "iPhone"), NOW);
    await createCredential(pool, passkey("cred-2", "iPad"), NOW);

    expect(await deleteCredential(pool, PARTICIPANT_ID, "cred-2")).toBe(true);

    expect(
      (await listCredentials(pool, PARTICIPANT_ID)).map((c) => c.id),
    ).toEqual(["cred-1"]);
  });

  it("beendet die Sitzungen, die mit diesem Passkey entstanden sind", async () => {
    // Wer sein verlorenes iPad entfernt, erwartet, dass es damit draussen
    // ist -- nicht nur, dass sein Passkey weg ist.
    const pool = createTestDb();
    await createCredential(pool, passkey("cred-iphone", "iPhone"), NOW);
    await createCredential(pool, passkey("cred-ipad", "iPad"), NOW);
    await createSession(
      pool,
      PARTICIPANT_ID,
      "token-iphone",
      NOW,
      "cred-iphone",
    );
    await createSession(pool, PARTICIPANT_ID, "token-ipad", NOW, "cred-ipad");

    await deleteCredential(pool, PARTICIPANT_ID, "cred-ipad");

    expect(await findSessionByToken(pool, "token-ipad", NOW)).toBeNull();
    expect(await findSessionByToken(pool, "token-iphone", NOW)).not.toBeNull();
  });

  it("laesst eine Sitzung aus dem Anmeldelink unberuehrt", async () => {
    // Sie haengt an keinem Geraet und darf deshalb auch mit keinem enden.
    const pool = createTestDb();
    await createCredential(pool, passkey("cred-1"), NOW);
    await createSession(pool, PARTICIPANT_ID, "token-link", NOW);

    await deleteCredential(pool, PARTICIPANT_ID, "cred-1");

    expect(await findSessionByToken(pool, "token-link", NOW)).not.toBeNull();
  });

  it("reicht nie an den Passkey einer anderen Person", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      NOW,
    );
    await createCredential(
      pool,
      { ...passkey("cred-clara"), participantId: clara.id },
      NOW,
    );

    expect(await deleteCredential(pool, PARTICIPANT_ID, "cred-clara")).toBe(
      false,
    );
    expect(await findCredentialById(pool, "cred-clara")).not.toBeNull();
  });

  it("meldet einen unbekannten Passkey", async () => {
    const pool = createTestDb();

    expect(await deleteCredential(pool, PARTICIPANT_ID, "cred-erfunden")).toBe(
      false,
    );
  });
});
