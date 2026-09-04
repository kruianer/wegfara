// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyTestDb, createTestDb } from "../../tests/test-db";
import { listCredentials } from "../db/credentials";
import { findParticipantByEmail } from "../db/participants";
import { findSessionByToken } from "../db/sessions";
import {
  BOOTSTRAP_ACCOUNT_NAME,
  bootstrapAvailable,
  bootstrapEmail,
  completeBootstrap,
  isBootstrapParticipantId,
  newBootstrapParticipantId,
} from "./bootstrap";

const NOW = new Date("2026-09-04T12:00:00Z");

/** Eine frisch deployte, leere Umgebung. */
const leereUmgebung = createEmptyTestDb;

function passkey(id = "cred-1") {
  return {
    id,
    publicKey: "oeffentlicher-schluessel",
    counter: 0,
    transports: ["internal"],
    label: "iPhone",
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("bootstrapEmail (req-037)", () => {
  it("nimmt ohne Zutun die Adresse des Betreibers", () => {
    expect(bootstrapEmail({})).toBe("uwe@kremmel.org");
  });

  it("laesst sich per BOOTSTRAP_EMAIL uebersteuern", () => {
    expect(bootstrapEmail({ BOOTSTRAP_EMAIL: " Anna@Huber.DE " })).toBe(
      "anna@huber.de",
    );
  });
});

describe("bootstrapAvailable (req-037)", () => {
  it("steht offen, solange die Umgebung niemanden kennt", async () => {
    expect(await bootstrapAvailable(await leereUmgebung())).toBe(true);
  });

  it("ist mit dem ersten Teilnehmer dauerhaft zu", async () => {
    // Die bestehenden Umgebungen haben ihn seit req-016.
    expect(await bootstrapAvailable(createTestDb())).toBe(false);
  });
});

describe("isBootstrapParticipantId (req-037)", () => {
  it("nimmt eine frisch erzeugte Kennung an", () => {
    expect(isBootstrapParticipantId(newBootstrapParticipantId())).toBe(true);
  });

  it("weist alles ab, was keine Kennung ist", () => {
    // Sie kommt aus einem Cookie und damit vom Browser.
    expect(isBootstrapParticipantId("'; drop table participant; --")).toBe(
      false,
    );
    expect(isBootstrapParticipantId(null)).toBe(false);
  });
});

describe("completeBootstrap (req-037)", () => {
  it("legt Account, Betreiber und ersten Passkey in einem Zug an", async () => {
    const pool = await leereUmgebung();
    const participantId = newBootstrapParticipantId();

    const result = await completeBootstrap(pool, participantId, passkey(), NOW);

    expect(result).not.toBeNull();
    const { rows } = await pool.query("select name from account");
    expect(rows[0].name).toBe(BOOTSTRAP_ACCOUNT_NAME);
    expect(await listCredentials(pool, participantId)).toHaveLength(1);
  });

  it("meldet den Betreiber sofort an", async () => {
    const pool = await leereUmgebung();
    const participantId = newBootstrapParticipantId();

    const result = await completeBootstrap(pool, participantId, passkey(), NOW);

    expect(await findSessionByToken(pool, result!.token, NOW)).not.toBeNull();
  });

  it("bindet die Sitzung an den frisch angelegten Passkey", async () => {
    const pool = await leereUmgebung();

    await completeBootstrap(
      pool,
      newBootstrapParticipantId(),
      passkey("cred-iphone"),
      NOW,
    );

    const { rows } = await pool.query("select credential_id from session");
    expect(rows[0].credential_id).toBe("cred-iphone");
  });

  it("hinterlegt die Adresse von Anfang an, damit der Anmeldelink sofort steht", async () => {
    const pool = await leereUmgebung();

    await completeBootstrap(pool, newBootstrapParticipantId(), passkey(), NOW);

    const betreiber = await findParticipantByEmail(pool, "uwe@kremmel.org");
    expect(betreiber).not.toBeNull();
    // Zugang und Account-Admin von Anfang an -- sonst haette er niemanden,
    // der ihm beides gibt.
    expect(betreiber?.loginEnabled).toBe(true);
    expect(betreiber?.accountAdmin).toBe(true);
  });

  it("nimmt die Adresse aus BOOTSTRAP_EMAIL, wenn sie gesetzt ist", async () => {
    vi.stubEnv("BOOTSTRAP_EMAIL", "anna@huber.de");
    const pool = await leereUmgebung();

    await completeBootstrap(pool, newBootstrapParticipantId(), passkey(), NOW);

    expect(await findParticipantByEmail(pool, "anna@huber.de")).not.toBeNull();
  });

  it("laesst sich kein zweites Mal ausfuehren", async () => {
    const pool = await leereUmgebung();
    await completeBootstrap(pool, newBootstrapParticipantId(), passkey(), NOW);

    const zweiter = await completeBootstrap(
      pool,
      newBootstrapParticipantId(),
      passkey("cred-2"),
      NOW,
    );

    expect(zweiter).toBeNull();
    const { rows } = await pool.query("select id from account");
    expect(rows).toHaveLength(1);
  });
});
