// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { hashSecret } from "../auth/tokens";
import {
  erzeugeMitdenkaZugang,
  mitdenkaZugangStand,
  pruefeMitdenkaZugang,
  schluesselAusKopf,
  widerrufeMitdenkaZugang,
} from "./zugang";
import { GOOGLE_ABFRAGEN_JE_TAG } from "./google-grenze";

/**
 * Der Zugang fuer mitdenka (req-104): ein Schluessel je Account, gespeichert
 * nur als Pruefsumme, jederzeit widerrufbar.
 */

const NOW = new Date("2026-11-13T10:00:00Z");
const SPAETER = new Date("2026-11-14T09:30:00Z");

let pool: ReturnType<typeof createTestDb>;

beforeEach(() => {
  pool = createTestDb();
});

describe("Zugang fuer mitdenka (req-104)", () => {
  it("liefert den Schluessel beim Erzeugen im Klartext", async () => {
    const schluessel = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);

    expect(schluessel).toMatch(/^wegfara_[A-Za-z0-9_-]{40,}$/);
  });

  it("speichert vom Schluessel nur die Pruefsumme", async () => {
    const schluessel = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);

    const { rows } = await pool.query(`select * from mitdenka_zugang`);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(schluessel);
    expect(rows[0].token_hash).toBe(hashSecret(schluessel));
  });

  it("nennt beim Stand nie den Schluessel", async () => {
    const schluessel = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);

    const stand = await mitdenkaZugangStand(pool, ACCOUNT_ID, NOW);
    expect(JSON.stringify(stand)).not.toContain(schluessel);
    expect(stand).toEqual({
      vorhanden: true,
      zuletztBenutzt: null,
      googleAbfragenHeute: 0,
      googleGrenze: GOOGLE_ABFRAGEN_JE_TAG,
    });
  });

  it("erkennt den Account am Schluessel", async () => {
    const schluessel = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);

    expect(await pruefeMitdenkaZugang(pool, schluessel, NOW)).toBe(ACCOUNT_ID);
  });

  it("weist einen unbekannten Schluessel ab", async () => {
    await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);

    expect(
      await pruefeMitdenkaZugang(pool, "wegfara_unbekannt", NOW),
    ).toBeNull();
  });

  it("macht den ersten Schluessel mit dem zweiten sofort ungueltig", async () => {
    const erster = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);
    const zweiter = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);

    expect(await pruefeMitdenkaZugang(pool, erster, NOW)).toBeNull();
    expect(await pruefeMitdenkaZugang(pool, zweiter, NOW)).toBe(ACCOUNT_ID);
    const { rows } = await pool.query(`select * from mitdenka_zugang`);
    expect(rows).toHaveLength(1);
  });

  it("weist einen widerrufenen Schluessel ab", async () => {
    const schluessel = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);
    await widerrufeMitdenkaZugang(pool, ACCOUNT_ID);

    expect(await pruefeMitdenkaZugang(pool, schluessel, NOW)).toBeNull();
    expect((await mitdenkaZugangStand(pool, ACCOUNT_ID, NOW)).vorhanden).toBe(
      false,
    );
  });

  it("haelt fest, wann der Schluessel zuletzt benutzt wurde", async () => {
    const schluessel = await erzeugeMitdenkaZugang(pool, ACCOUNT_ID, NOW);
    await pruefeMitdenkaZugang(pool, schluessel, SPAETER);

    expect(
      (await mitdenkaZugangStand(pool, ACCOUNT_ID, SPAETER)).zuletztBenutzt,
    ).toBe("14.11.2026");
  });
});

describe("Schluessel aus dem Kopf der Anfrage (req-104)", () => {
  it("liest ihn aus Authorization: Bearer", () => {
    expect(schluesselAusKopf("Bearer wegfara_abc")).toBe("wegfara_abc");
  });

  it("nimmt ohne Kopf, ohne Bearer oder ohne Praefix keinen an", () => {
    expect(schluesselAusKopf(null)).toBeNull();
    expect(schluesselAusKopf("wegfara_abc")).toBeNull();
    expect(schluesselAusKopf("Basic wegfara_abc")).toBeNull();
    expect(schluesselAusKopf("Bearer abc")).toBeNull();
  });
});
