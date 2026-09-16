// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ID,
  createMigratedTestDb,
  createTestDb,
  PARTICIPANT_ID,
} from "@/tests/test-db";
import { createParticipant, setAccountAdmin } from "../db/participants";
import { assignTripParticipant } from "../db/trip-participants";
import { setTripState } from "../db/trips";
import {
  castVote,
  endRatingRound,
  startRatingRound,
} from "../db/rating-rounds";
import { sessionRemainsValid } from "./session-access";

type Pool = ReturnType<typeof createTestDb>;

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
/** Ein POI der Suditalien Rundreise (migrations/0011_seed_pois.sql). */
const POMPEJI = "462f6811-13cc-4247-99aa-8b9693955ab7";
const NOW = new Date("2026-09-03T12:00:00Z");

/** Clara Berger — eine Mitreisende ohne eigene Reise. */
async function clara(pool: Pool) {
  return createParticipant(
    pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: "clara@example.com",
      phone: null,
      iban: null,
    },
    NOW,
  );
}

describe("sessionRemainsValid (req-023)", () => {
  it("gilt fuer den Reiseleiter, auch wenn keine Reise freigegeben ist", async () => {
    const pool = createTestDb();

    // Alle drei Reisen stehen auf "In Planung" (req-022).
    expect(await sessionRemainsValid(pool, PARTICIPANT_ID)).toBe(true);
  });

  it("gilt fuer eine Person, die einer freigegebenen Reise zugeordnet ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      person.id,
      "teilnehmer",
    );
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    expect(await sessionRemainsValid(pool, person.id)).toBe(true);
  });

  it("endet, solange ihre Reise noch auf „In Planung“ steht", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      person.id,
      "teilnehmer",
    );

    expect(await sessionRemainsValid(pool, person.id)).toBe(false);
  });

  it("endet, sobald die Reise abgeschlossen ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      person.id,
      "teilnehmer",
    );
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "abgeschlossen");

    expect(await sessionRemainsValid(pool, person.id)).toBe(false);
  });

  it("endet fuer eine Person, die keiner Reise zugeordnet ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);

    expect(await sessionRemainsValid(pool, person.id)).toBe(false);
  });

  // Ohne diese Ausnahme sperrt sich eine Umgebung ohne Reisen selbst zu
  // (bug-046): die Sitzung entsteht beim Einloesen des Anmeldelinks und endet
  // beim naechsten Aufruf wieder -- eine Reise anlegen oder einen Passkey
  // einrichten kann in der Zeit niemand.
  it("gilt fuer den Account-Admin in einer Umgebung ohne Reisen", async () => {
    const pool = createMigratedTestDb();

    expect(await sessionRemainsValid(pool, PARTICIPANT_ID)).toBe(true);
  });

  it("gilt fuer den Account-Admin, der keiner Reise zugeordnet ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await setAccountAdmin(pool, ACCOUNT_ID, person.id, true);

    expect(await sessionRemainsValid(pool, person.id)).toBe(true);
  });

  it("gilt fuer den Gesamt-Admin, auch ohne Account-Admin-Kennzeichnung", async () => {
    const pool = createMigratedTestDb();
    // Direkt in der Datenbank: is_super_admin schreibt die Anwendung nie
    // (req-025), und der letzte Account-Admin behaelt seine Kennzeichnung
    // (req-027).
    await pool.query(
      `update participant set is_account_admin = false where id = $1`,
      [PARTICIPANT_ID],
    );

    expect(await sessionRemainsValid(pool, PARTICIPANT_ID)).toBe(true);
  });

  // Die "offene Bewertung" aus req-023 gibt es seit req-054: wer in einer
  // laufenden Bewertungsrunde noch nicht gestimmt hat, bleibt angemeldet --
  // auch ohne freigegebene Reise.
  it("gilt bei einer offenen Bewertung, auch ohne freigegebene Reise", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      person.id,
      "teilnehmer",
    );
    await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [POMPEJI],
      NOW,
    );

    expect(await sessionRemainsValid(pool, person.id)).toBe(true);
  });

  it("endet, sobald die eigene Stimme abgegeben ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      person.id,
      "teilnehmer",
    );
    const runde = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [POMPEJI],
      NOW,
    );
    await castVote(
      pool,
      ACCOUNT_ID,
      person.id,
      runde.ok ? runde.runde.id : "",
      POMPEJI,
      "unbedingt",
      NOW,
    );

    expect(await sessionRemainsValid(pool, person.id)).toBe(false);
  });

  it("endet, sobald die Runde beendet ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      person.id,
      "teilnehmer",
    );
    const runde = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [POMPEJI],
      NOW,
    );
    await endRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      runde.ok ? runde.runde.id : "",
      NOW,
    );

    expect(await sessionRemainsValid(pool, person.id)).toBe(false);
  });
});
