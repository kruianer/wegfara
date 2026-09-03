// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
import { hashSecret } from "../auth/tokens";
import { ACCESS_LINK_DURATION_MS } from "../auth/lifetime";
import {
  consumeAccessLink,
  createAccessLink,
  invalidateAccessLinks,
} from "./access-links";

const NOW = new Date("2026-09-03T12:00:00Z");

function daysLater(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("createAccessLink (req-023)", () => {
  it("legt den Zugangslink nur als Pruefsumme ab, nie im Klartext", async () => {
    const pool = createTestDb();

    await createAccessLink(pool, PARTICIPANT_ID, "geheim-1", NOW);

    const { rows } = await pool.query("select token_hash from access_link");
    expect(rows).toHaveLength(1);
    const gespeichert = (rows[0] as { token_hash: string }).token_hash;
    expect(gespeichert).toBe(hashSecret("geheim-1"));
    expect(gespeichert).not.toContain("geheim-1");
  });

  it("gilt sieben Tage", async () => {
    const pool = createTestDb();

    const expiresAt = await createAccessLink(
      pool,
      PARTICIPANT_ID,
      "geheim-1",
      NOW,
    );

    expect(expiresAt.getTime() - NOW.getTime()).toBe(ACCESS_LINK_DURATION_MS);
  });
});

describe("consumeAccessLink (req-023)", () => {
  it("liefert die Person, an die der Link gebunden ist", async () => {
    const pool = createTestDb();
    await createAccessLink(pool, PARTICIPANT_ID, "geheim-1", NOW);

    expect(await consumeAccessLink(pool, "geheim-1", NOW)).toBe(PARTICIPANT_ID);
  });

  it("nimmt denselben Link kein zweites Mal an", async () => {
    const pool = createTestDb();
    await createAccessLink(pool, PARTICIPANT_ID, "geheim-1", NOW);
    await consumeAccessLink(pool, "geheim-1", NOW);

    expect(await consumeAccessLink(pool, "geheim-1", NOW)).toBeNull();
  });

  it("nimmt einen abgelaufenen Link nicht an", async () => {
    const pool = createTestDb();
    await createAccessLink(pool, PARTICIPANT_ID, "geheim-1", NOW);

    expect(await consumeAccessLink(pool, "geheim-1", daysLater(8))).toBeNull();
  });

  it("nimmt ihn am siebten Tag noch an", async () => {
    const pool = createTestDb();
    await createAccessLink(pool, PARTICIPANT_ID, "geheim-1", NOW);

    expect(await consumeAccessLink(pool, "geheim-1", daysLater(6))).toBe(
      PARTICIPANT_ID,
    );
  });

  it("nimmt ein erfundenes Token nicht an", async () => {
    const pool = createTestDb();

    expect(await consumeAccessLink(pool, "ausgedacht", NOW)).toBeNull();
    expect(await consumeAccessLink(pool, "", NOW)).toBeNull();
  });
});

describe("invalidateAccessLinks (req-023)", () => {
  it("entwertet die vorherige Einladung derselben Person", async () => {
    const pool = createTestDb();
    await createAccessLink(pool, PARTICIPANT_ID, "geheim-1", NOW);

    await invalidateAccessLinks(pool, PARTICIPANT_ID, NOW);
    await createAccessLink(pool, PARTICIPANT_ID, "geheim-2", NOW);

    expect(await consumeAccessLink(pool, "geheim-1", NOW)).toBeNull();
    expect(await consumeAccessLink(pool, "geheim-2", NOW)).toBe(PARTICIPANT_ID);
  });
});
