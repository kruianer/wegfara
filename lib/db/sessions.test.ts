// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "../../tests/test-db";
import { hashSecret } from "../auth/tokens";
import { SESSION_DURATION_MS } from "../auth/lifetime";
import {
  createSession,
  deleteExpiredSessions,
  deleteSessionByToken,
  deleteSessionsOfParticipant,
  findSessionByToken,
  renewSession,
  setActingAccount,
} from "./sessions";
import { createAccount } from "./accounts";
import { createCredential, listCredentials } from "./credentials";
import { createParticipant } from "./participants";

const NOW = new Date("2026-08-16T12:00:00Z");

function later(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("createSession", () => {
  it("liefert die Sitzung samt Konto und Mandant", async () => {
    const pool = createTestDb();

    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(session.participant).toMatchObject({
      id: PARTICIPANT_ID,
      accountId: ACCOUNT_ID,
      email: "uwe@kremmel.org",
    });
  });

  it("speichert das Sitzungs-Token nie im Klartext (req-016)", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    const { rows } = await pool.query("select token_hash from session");

    expect(rows[0].token_hash).toBe(hashSecret("token-1"));
    expect(rows[0].token_hash).not.toContain("token-1");
  });

  it("laesst die Sitzung erst nach 90 Tagen ablaufen", async () => {
    const pool = createTestDb();

    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(session.expiresAt.getTime() - NOW.getTime()).toBe(
      SESSION_DURATION_MS,
    );
  });
});

describe("findSessionByToken", () => {
  it("findet eine laufende Sitzung wieder", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    const session = await findSessionByToken(pool, "token-1", later(1));

    expect(session?.participant.id).toBe(PARTICIPANT_ID);
  });

  it("findet keine Sitzung zu einem fremden Token", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(await findSessionByToken(pool, "token-2", NOW)).toBeNull();
  });

  it("findet keine abgelaufene Sitzung", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(await findSessionByToken(pool, "token-1", later(91))).toBeNull();
  });
});

describe("renewSession", () => {
  it("verlaengert die Sitzung bei Nutzung (req-016)", async () => {
    const pool = createTestDb();
    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    await renewSession(pool, session.id, later(89));

    expect(await findSessionByToken(pool, "token-1", later(91))).not.toBeNull();
  });
});

describe("deleteSessionByToken", () => {
  it("beendet die Sitzung sofort (req-016)", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    await deleteSessionByToken(pool, "token-1");

    expect(await findSessionByToken(pool, "token-1", NOW)).toBeNull();
  });

  it("laesst die Sitzungen anderer Geraete unberuehrt", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);
    await createSession(pool, PARTICIPANT_ID, "token-2", NOW);

    await deleteSessionByToken(pool, "token-1");

    expect(await findSessionByToken(pool, "token-2", NOW)).not.toBeNull();
  });
});

describe("deleteExpiredSessions", () => {
  it("raeumt abgelaufene Sitzungen weg", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    await deleteExpiredSessions(pool, later(91));

    const { rows } = await pool.query("select id from session");
    expect(rows).toHaveLength(0);
  });
});

describe("Account in der Sitzung (req-025)", () => {
  it("arbeitet ohne Wechsel im eigenen Account", async () => {
    const pool = createTestDb();

    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(session.accountId).toBe(ACCOUNT_ID);
    expect(session.actingAccount).toBeNull();
  });

  it("kennzeichnet den Gesamt-Admin", async () => {
    const pool = createTestDb();

    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    // Gesetzt wird die Kennzeichnung ausschliesslich direkt in der
    // Datenbank (siehe migrations/0023_gesamt_admin.sql).
    expect(session.superAdmin).toBe(true);
  });

  it("arbeitet nach dem Wechsel im fremden Account", async () => {
    const pool = createTestDb();
    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");

    await setActingAccount(pool, session.id, huber.id);
    const gewechselt = await findSessionByToken(pool, "token-1", NOW);

    expect(gewechselt?.accountId).toBe(huber.id);
    expect(gewechselt?.actingAccount).toEqual({
      id: huber.id,
      name: "Familie Huber",
    });
    // Die eigene Person bleibt, wer sie ist -- gewechselt wird der Kontext.
    expect(gewechselt?.participant.accountId).toBe(ACCOUNT_ID);
  });

  it("bringt die Rueckkehr wieder in den eigenen Account", async () => {
    const pool = createTestDb();
    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");
    await setActingAccount(pool, session.id, huber.id);

    await setActingAccount(pool, session.id, null);
    const zurueck = await findSessionByToken(pool, "token-1", NOW);

    expect(zurueck?.accountId).toBe(ACCOUNT_ID);
    expect(zurueck?.actingAccount).toBeNull();
  });

  it("laesst eine gewoehnliche Person in keinem fremden Account arbeiten", async () => {
    const pool = createTestDb();
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");
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
    const session = await createSession(pool, clara.id, "token-2", NOW);

    // Selbst wenn der Wert an der Sitzung stuende -- ohne die Kennzeichnung
    // bleibt es beim eigenen Account.
    await setActingAccount(pool, session.id, huber.id);
    const ihre = await findSessionByToken(pool, "token-2", NOW);

    expect(ihre?.superAdmin).toBe(false);
    expect(ihre?.accountId).toBe(ACCOUNT_ID);
    expect(ihre?.actingAccount).toBeNull();
  });
});

describe("Account-Admin in der Sitzung (req-027)", () => {
  /** Eine gewoehnliche Person des Accounts, ohne die Kennzeichnung. */
  function clara(pool: ReturnType<typeof createTestDb>) {
    return createParticipant(
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
  }

  it("kennzeichnet den Account-Admin", async () => {
    const pool = createTestDb();

    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    // Die erste Person des Accounts traegt sie (siehe
    // migrations/0025_account_admin.sql).
    expect(session.accountAdmin).toBe(true);
    expect(session.participant.accountAdmin).toBe(true);
  });

  it("kennzeichnet eine Person ohne die Kennzeichnung nicht", async () => {
    const pool = createTestDb();
    const person = await clara(pool);

    const session = await createSession(pool, person.id, "token-2", NOW);

    expect(session.accountAdmin).toBe(false);
  });

  it("laesst den Gesamt-Admin im fremden Account als Account-Admin gelten", async () => {
    const pool = createTestDb();
    const session = await createSession(pool, PARTICIPANT_ID, "token-1", NOW);
    const huber = await createAccount(pool, "Familie Huber", "anna@huber.de");

    await setActingAccount(pool, session.id, huber.id);
    const gewechselt = await findSessionByToken(pool, "token-1", NOW);

    expect(gewechselt?.accountId).toBe(huber.id);
    expect(gewechselt?.accountAdmin).toBe(true);
  });
});

describe("Sitzung und Passkey (req-037)", () => {
  it("haelt fest, mit welchem Passkey die Sitzung entstanden ist", async () => {
    const pool = createTestDb();
    await createCredential(
      pool,
      {
        id: "cred-iphone",
        participantId: PARTICIPANT_ID,
        publicKey: "schluessel",
        counter: 0,
        transports: [],
        label: "iPhone",
      },
      NOW,
    );

    await createSession(pool, PARTICIPANT_ID, "token-1", NOW, "cred-iphone");

    const { rows } = await pool.query("select credential_id from session");
    expect(rows[0].credential_id).toBe("cred-iphone");
  });

  it("laesst Anmeldelink, Notfallcode und Einladung ohne Passkey", async () => {
    const pool = createTestDb();

    await createSession(pool, PARTICIPANT_ID, "token-1", NOW);

    const { rows } = await pool.query("select credential_id from session");
    expect(rows[0].credential_id).toBeNull();
  });
});

describe("deleteSessionsOfParticipant (req-037)", () => {
  it("beendet alle Sitzungen der Person -- auch die gerade benutzte", async () => {
    const pool = createTestDb();
    await createSession(pool, PARTICIPANT_ID, "token-iphone", NOW);
    await createSession(pool, PARTICIPANT_ID, "token-laptop", NOW);

    await deleteSessionsOfParticipant(pool, PARTICIPANT_ID);

    expect(await findSessionByToken(pool, "token-iphone", NOW)).toBeNull();
    expect(await findSessionByToken(pool, "token-laptop", NOW)).toBeNull();
  });

  it("laesst die Sitzungen anderer Personen bestehen", async () => {
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
    await createSession(pool, PARTICIPANT_ID, "token-uwe", NOW);
    await createSession(pool, clara.id, "token-clara", NOW);

    await deleteSessionsOfParticipant(pool, PARTICIPANT_ID);

    expect(await findSessionByToken(pool, "token-clara", NOW)).not.toBeNull();
  });

  it("laesst die Passkeys bestehen -- es ist ein Abmelden, kein Aussperren", async () => {
    const pool = createTestDb();
    await createCredential(
      pool,
      {
        id: "cred-1",
        participantId: PARTICIPANT_ID,
        publicKey: "schluessel",
        counter: 0,
        transports: [],
        label: "iPhone",
      },
      NOW,
    );
    await createSession(pool, PARTICIPANT_ID, "token-1", NOW, "cred-1");

    await deleteSessionsOfParticipant(pool, PARTICIPANT_ID);

    expect(await listCredentials(pool, PARTICIPANT_ID)).toHaveLength(1);
  });
});
