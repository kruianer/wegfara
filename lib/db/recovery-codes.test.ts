// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "../../tests/test-db";
import { generateRecoveryCodes } from "../auth/recovery-codes";
import {
  consumeRecoveryCode,
  countUnusedRecoveryCodes,
  hasRecoveryCodes,
  replaceRecoveryCodes,
} from "./recovery-codes";

const NOW = new Date("2026-08-16T12:00:00Z");

describe("replaceRecoveryCodes", () => {
  it("speichert die Codes ausschliesslich als Pruefsumme (req-016)", async () => {
    const pool = createTestDb();
    const codes = generateRecoveryCodes();

    await replaceRecoveryCodes(pool, PARTICIPANT_ID, codes, NOW);

    const { rows } = await pool.query("select code_hash from recovery_code");
    const gespeichert = rows
      .map((row: { code_hash: string }) => row.code_hash)
      .join(" ");
    for (const code of codes) {
      expect(gespeichert).not.toContain(code);
    }
  });

  it("ersetzt einen vorhandenen Satz vollstaendig (req-016)", async () => {
    const pool = createTestDb();
    const alt = generateRecoveryCodes();
    await replaceRecoveryCodes(pool, PARTICIPANT_ID, alt, NOW);

    const neu = generateRecoveryCodes();
    await replaceRecoveryCodes(pool, PARTICIPANT_ID, neu, NOW);

    expect(await consumeRecoveryCode(pool, PARTICIPANT_ID, alt[0], NOW)).toBe(
      false,
    );
    expect(await consumeRecoveryCode(pool, PARTICIPANT_ID, neu[0], NOW)).toBe(
      true,
    );
  });
});

describe("countUnusedRecoveryCodes", () => {
  it("zaehlt die noch unverbrauchten Codes (req-016)", async () => {
    const pool = createTestDb();
    const codes = generateRecoveryCodes();
    await replaceRecoveryCodes(pool, PARTICIPANT_ID, codes, NOW);

    expect(await countUnusedRecoveryCodes(pool, PARTICIPANT_ID)).toBe(8);

    await consumeRecoveryCode(pool, PARTICIPANT_ID, codes[0], NOW);

    expect(await countUnusedRecoveryCodes(pool, PARTICIPANT_ID)).toBe(7);
  });
});

describe("hasRecoveryCodes", () => {
  it("ist vor der ersten Anmeldung falsch", async () => {
    const pool = createTestDb();

    expect(await hasRecoveryCodes(pool, PARTICIPANT_ID)).toBe(false);
  });

  it("bleibt wahr, auch wenn alle Codes verbraucht sind", async () => {
    const pool = createTestDb();
    const codes = generateRecoveryCodes();
    await replaceRecoveryCodes(pool, PARTICIPANT_ID, codes, NOW);
    for (const code of codes) {
      await consumeRecoveryCode(pool, PARTICIPANT_ID, code, NOW);
    }

    expect(await hasRecoveryCodes(pool, PARTICIPANT_ID)).toBe(true);
  });
});

describe("consumeRecoveryCode", () => {
  it("nimmt einen Code an, egal wie er geschrieben wurde", async () => {
    const pool = createTestDb();
    const codes = generateRecoveryCodes();
    await replaceRecoveryCodes(pool, PARTICIPANT_ID, codes, NOW);

    const eingetippt = codes[0].toLowerCase().replace(/-/g, "");

    expect(
      await consumeRecoveryCode(pool, PARTICIPANT_ID, eingetippt, NOW),
    ).toBe(true);
  });

  it("nimmt denselben Code kein zweites Mal an (req-016)", async () => {
    const pool = createTestDb();
    const codes = generateRecoveryCodes();
    await replaceRecoveryCodes(pool, PARTICIPANT_ID, codes, NOW);
    await consumeRecoveryCode(pool, PARTICIPANT_ID, codes[0], NOW);

    expect(await consumeRecoveryCode(pool, PARTICIPANT_ID, codes[0], NOW)).toBe(
      false,
    );
  });

  it("laesst die uebrigen Codes unberuehrt", async () => {
    const pool = createTestDb();
    const codes = generateRecoveryCodes();
    await replaceRecoveryCodes(pool, PARTICIPANT_ID, codes, NOW);
    await consumeRecoveryCode(pool, PARTICIPANT_ID, codes[0], NOW);

    expect(await consumeRecoveryCode(pool, PARTICIPANT_ID, codes[1], NOW)).toBe(
      true,
    );
  });

  it("nimmt einen unbekannten Code nicht an", async () => {
    const pool = createTestDb();
    await replaceRecoveryCodes(
      pool,
      PARTICIPANT_ID,
      generateRecoveryCodes(),
      NOW,
    );

    expect(
      await consumeRecoveryCode(pool, PARTICIPANT_ID, "AAAA-BBBB-CCCC", NOW),
    ).toBe(false);
  });
});
