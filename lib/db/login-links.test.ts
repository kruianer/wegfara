// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "../../tests/test-db";
import { hashSecret } from "../auth/tokens";
import {
  consumeLoginLink,
  createLoginLink,
  invalidateLoginLinks,
} from "./login-links";

const NOW = new Date("2026-08-16T12:00:00Z");

function minutesLater(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60 * 1000);
}

describe("createLoginLink", () => {
  it("speichert das Token nie im Klartext (req-016)", async () => {
    const pool = createTestDb();
    await createLoginLink(pool, PARTICIPANT_ID, "token-1", NOW);

    const { rows } = await pool.query("select token_hash from login_link");

    expect(rows[0].token_hash).toBe(hashSecret("token-1"));
  });
});

describe("consumeLoginLink", () => {
  it("meldet die Person an, zu der der Link gehoert", async () => {
    const pool = createTestDb();
    await createLoginLink(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(await consumeLoginLink(pool, "token-1", minutesLater(1))).toBe(
      PARTICIPANT_ID,
    );
  });

  it("laesst denselben Link kein zweites Mal gelten (req-016)", async () => {
    const pool = createTestDb();
    await createLoginLink(pool, PARTICIPANT_ID, "token-1", NOW);
    await consumeLoginLink(pool, "token-1", minutesLater(1));

    expect(await consumeLoginLink(pool, "token-1", minutesLater(2))).toBeNull();
  });

  it("laesst einen Link nach 15 Minuten nicht mehr gelten (req-016)", async () => {
    const pool = createTestDb();
    await createLoginLink(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(
      await consumeLoginLink(pool, "token-1", minutesLater(16)),
    ).toBeNull();
  });

  it("nimmt ein fremdes Token nicht an", async () => {
    const pool = createTestDb();
    await createLoginLink(pool, PARTICIPANT_ID, "token-1", NOW);

    expect(await consumeLoginLink(pool, "token-2", minutesLater(1))).toBeNull();
  });
});

describe("invalidateLoginLinks", () => {
  it("entwertet den vorherigen Link, wenn ein neuer angefordert wird", async () => {
    const pool = createTestDb();
    await createLoginLink(pool, PARTICIPANT_ID, "token-1", NOW);

    await invalidateLoginLinks(pool, PARTICIPANT_ID, minutesLater(1));
    await createLoginLink(pool, PARTICIPANT_ID, "token-2", minutesLater(1));

    expect(await consumeLoginLink(pool, "token-1", minutesLater(2))).toBeNull();
    expect(await consumeLoginLink(pool, "token-2", minutesLater(2))).toBe(
      PARTICIPANT_ID,
    );
  });
});
