// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import {
  GOOGLE_ABFRAGEN_JE_TAG,
  kalendertag,
  nimmGoogleAbfrage,
} from "./google-grenze";
import { googleAbfragenAm } from "../db/mitdenka-zugang";

/** Die Grenze fuer Google je Account und Tag (req-104). */

let pool: ReturnType<typeof createTestDb>;

beforeEach(() => {
  pool = createTestDb();
});

describe("Kalendertag (req-104)", () => {
  it("zaehlt in Europe/Berlin, nicht in UTC", () => {
    // 23:30 UTC am 13. ist in Berlin schon der 14.
    expect(kalendertag(new Date("2026-11-13T23:30:00Z"))).toBe("2026-11-14");
    expect(kalendertag(new Date("2026-11-13T22:30:00Z"))).toBe("2026-11-13");
  });
});

describe("Kontingent fuer Google (req-104)", () => {
  const NOW = new Date("2026-11-13T10:00:00Z");

  it("zaehlt jede genommene Abfrage", async () => {
    await nimmGoogleAbfrage(pool, ACCOUNT_ID, NOW);
    await nimmGoogleAbfrage(pool, ACCOUNT_ID, NOW);

    expect(await googleAbfragenAm(pool, ACCOUNT_ID, "2026-11-13")).toBe(2);
  });

  it("gibt an der Grenze keine weitere frei und zaehlt nicht weiter", async () => {
    for (let i = 0; i < GOOGLE_ABFRAGEN_JE_TAG; i++) {
      expect((await nimmGoogleAbfrage(pool, ACCOUNT_ID, NOW)).frei).toBe(true);
    }

    expect(await nimmGoogleAbfrage(pool, ACCOUNT_ID, NOW)).toEqual({
      frei: false,
      stand: GOOGLE_ABFRAGEN_JE_TAG,
      grenze: GOOGLE_ABFRAGEN_JE_TAG,
    });
    expect(await googleAbfragenAm(pool, ACCOUNT_ID, "2026-11-13")).toBe(
      GOOGLE_ABFRAGEN_JE_TAG,
    );
  });

  it("beginnt am naechsten Tag von vorn", async () => {
    await nimmGoogleAbfrage(pool, ACCOUNT_ID, NOW);

    expect(await googleAbfragenAm(pool, ACCOUNT_ID, "2026-11-14")).toBe(0);
  });
});
