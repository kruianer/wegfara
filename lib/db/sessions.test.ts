// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "../../tests/test-db";
import { hashSecret } from "../auth/tokens";
import { SESSION_DURATION_MS } from "../auth/lifetime";
import {
  createSession,
  deleteExpiredSessions,
  deleteSessionByToken,
  findSessionByToken,
  renewSession,
} from "./sessions";

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
