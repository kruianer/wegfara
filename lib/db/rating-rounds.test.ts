// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import {
  castVote,
  endRatingRound,
  hasOpenRating,
  listRatingRounds,
  listRatingVotes,
  startRatingRound,
} from "./rating-rounds";
import { assignTripParticipant } from "./trip-participants";

/**
 * Die Bewertungsrunde in der Ablage (req-054): starten, abstimmen, beenden --
 * und wer das jeweils darf.
 */

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

/** Drei POIs der Suditalien Rundreise (migrations/0011_seed_pois.sql). */
const POMPEJI = "462f6811-13cc-4247-99aa-8b9693955ab7";
const VILLA_RUFOLO = "b6652937-9196-4a63-ab17-5edfdda66642";
const MATERA = "4137c2d0-0bc9-41bb-998a-2cf9eaac4edf";
/** Ein POI einer anderen Reise desselben Accounts. */
const STEPHANSDOM = "25667132-5130-4e9a-b96b-cef44ff8da53";

const NOW = new Date("2026-09-07T10:00:00.000Z");
const SPAETER = new Date("2026-09-08T10:00:00.000Z");

type Pool = ReturnType<typeof createTestDb>;

let pool: Pool;

beforeEach(() => {
  pool = createTestDb();
});

/** Clara faehrt bei der Suditalien Rundreise als Teilnehmerin mit. */
async function clara(): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into participant (id, account_id, name, created_at)
     values ($1, $2, $3, $4)`,
    [id, ACCOUNT_ID, "Clara Berger", NOW],
  );
  await assignTripParticipant(
    pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    id,
    "teilnehmer",
  );
  return id;
}

/** Eine Person eines fremden Accounts -- sie gehoert zu keiner dieser Reisen. */
async function fremde(): Promise<string> {
  const accountId = randomUUID();
  const id = randomUUID();
  await pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Anderer Account", "andere@example.com"],
  );
  await pool.query(
    `insert into participant (id, account_id, name, created_at)
     values ($1, $2, $3, $4)`,
    [id, accountId, "Fremde Person", NOW],
  );
  return id;
}

/** Eine laufende Runde ueber drei POIs, gestartet vom Reiseleiter. */
async function laufendeRunde() {
  const result = await startRatingRound(
    pool,
    ACCOUNT_ID,
    PARTICIPANT_ID,
    SUEDITALIEN_ID,
    [POMPEJI, VILLA_RUFOLO, MATERA],
    NOW,
  );
  if (!result.ok) throw new Error(`Runde nicht gestartet: ${result.reason}`);
  return result.runde;
}

describe("Bewertungsrunde starten (req-054)", () => {
  it("laesst den Reiseleiter eine Runde ueber genau die gewaehlten POIs starten", async () => {
    const runde = await laufendeRunde();

    expect(runde.status).toBe("laeuft");
    expect(runde.poiIds).toEqual([POMPEJI, VILLA_RUFOLO, MATERA]);
    expect(await listRatingRounds(pool, ACCOUNT_ID)).toEqual([runde]);
  });

  it("weist einen Teilnehmer ab, der nicht Reiseleiter ist", async () => {
    const person = await clara();

    const result = await startRatingRound(
      pool,
      ACCOUNT_ID,
      person,
      SUEDITALIEN_ID,
      [POMPEJI],
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "notLeader" });
    expect(await listRatingRounds(pool, ACCOUNT_ID)).toEqual([]);
  });

  it("weist eine Reise eines anderen Accounts ab", async () => {
    const anderer = randomUUID();
    const fremdeReise = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [anderer, "Anderer Account", "andere@example.com"],
    );
    await pool.query(
      `insert into trip (id, account_id, title, start_date, end_date,
                         main_place_name, main_place_lat, main_place_lng)
       values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
      [fremdeReise, anderer],
    );

    const result = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      fremdeReise,
      [POMPEJI],
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });

  it("uebergeht POIs, die zu einer anderen Reise gehoeren", async () => {
    const result = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [POMPEJI, STEPHANSDOM],
      NOW,
    );

    expect(result.ok && result.runde.poiIds).toEqual([POMPEJI]);
  });

  it("startet keine Runde ohne einen POI dieser Reise", async () => {
    const result = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [STEPHANSDOM],
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "keinePois" });
  });

  it("laesst zu einer Reise nur eine Runde gleichzeitig laufen", async () => {
    await laufendeRunde();

    const zweite = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [POMPEJI],
      SPAETER,
    );

    expect(zweite).toEqual({ ok: false, reason: "laeuft" });
  });

  it("laesst zu einer anderen Reise gleichzeitig eine Runde laufen", async () => {
    await laufendeRunde();

    const wien = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      WIEN_ID,
      [STEPHANSDOM],
      SPAETER,
    );

    expect(wien.ok).toBe(true);
  });
});

describe("Stimme abgeben (req-054)", () => {
  it("speichert die Stimme eines Teilnehmers", async () => {
    const runde = await laufendeRunde();
    const person = await clara();

    const result = await castVote(
      pool,
      ACCOUNT_ID,
      person,
      runde.id,
      POMPEJI,
      "unbedingt",
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(await listRatingVotes(pool, ACCOUNT_ID)).toEqual([
      {
        roundId: runde.id,
        poiId: POMPEJI,
        participantId: person,
        wahl: "unbedingt",
      },
    ]);
  });

  it("ersetzt eine vorhandene Stimme, statt eine zweite anzulegen", async () => {
    const runde = await laufendeRunde();
    const person = await clara();
    await castVote(
      pool,
      ACCOUNT_ID,
      person,
      runde.id,
      POMPEJI,
      "waere_schoen",
      NOW,
    );

    await castVote(
      pool,
      ACCOUNT_ID,
      person,
      runde.id,
      POMPEJI,
      "ohne_mich",
      SPAETER,
    );

    expect(await listRatingVotes(pool, ACCOUNT_ID)).toEqual([
      {
        roundId: runde.id,
        poiId: POMPEJI,
        participantId: person,
        wahl: "ohne_mich",
      },
    ]);
  });

  it("weist ab, wer nicht zu dieser Reise gehoert", async () => {
    const runde = await laufendeRunde();
    const person = await fremde();

    const result = await castVote(
      pool,
      ACCOUNT_ID,
      person,
      runde.id,
      POMPEJI,
      "unbedingt",
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "notInTrip" });
    expect(await listRatingVotes(pool, ACCOUNT_ID)).toEqual([]);
  });

  it("weist einen POI ab, der nicht in dieser Runde steht", async () => {
    const runde = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [POMPEJI],
      NOW,
    );
    const person = await clara();

    const result = await castVote(
      pool,
      ACCOUNT_ID,
      person,
      runde.ok ? runde.runde.id : "",
      VILLA_RUFOLO,
      "unbedingt",
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });

  it("weist eine Runde eines anderen Accounts ab", async () => {
    const runde = await laufendeRunde();
    const anderer = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [anderer, "Anderer Account", "andere@example.com"],
    );

    const result = await castVote(
      pool,
      anderer,
      PARTICIPANT_ID,
      runde.id,
      POMPEJI,
      "unbedingt",
      NOW,
    );

    expect(result).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("Bewertungsrunde beenden (req-054)", () => {
  it("beendet die Runde und haelt die Stimmen fest", async () => {
    const runde = await laufendeRunde();
    const person = await clara();
    await castVote(
      pool,
      ACCOUNT_ID,
      person,
      runde.id,
      POMPEJI,
      "unbedingt",
      NOW,
    );

    const beendet = await endRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      runde.id,
      SPAETER,
    );

    expect(beendet.ok && beendet.runde.status).toBe("beendet");
    expect(beendet.ok && beendet.runde.endedAt).toBe(SPAETER.toISOString());
    expect(await listRatingVotes(pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("nimmt nach dem Beenden keine Stimme mehr an", async () => {
    const runde = await laufendeRunde();
    const person = await clara();
    await endRatingRound(pool, ACCOUNT_ID, PARTICIPANT_ID, runde.id, SPAETER);

    const result = await castVote(
      pool,
      ACCOUNT_ID,
      person,
      runde.id,
      POMPEJI,
      "unbedingt",
      SPAETER,
    );

    expect(result).toEqual({ ok: false, reason: "beendet" });
    expect(await listRatingVotes(pool, ACCOUNT_ID)).toEqual([]);
  });

  it("weist einen Teilnehmer ab, der nicht Reiseleiter ist", async () => {
    const runde = await laufendeRunde();
    const person = await clara();

    const result = await endRatingRound(
      pool,
      ACCOUNT_ID,
      person,
      runde.id,
      SPAETER,
    );

    expect(result).toEqual({ ok: false, reason: "notLeader" });
    expect((await listRatingRounds(pool, ACCOUNT_ID))[0].status).toBe("laeuft");
  });

  it("laesst nach dem Beenden eine neue Runde zu", async () => {
    const runde = await laufendeRunde();
    await endRatingRound(pool, ACCOUNT_ID, PARTICIPANT_ID, runde.id, SPAETER);

    const zweite = await startRatingRound(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
      SUEDITALIEN_ID,
      [POMPEJI],
      SPAETER,
    );

    expect(zweite.ok).toBe(true);
  });
});

describe("offene Bewertung (req-023, req-054)", () => {
  it("erkennt eine laufende Runde, in der noch nicht gestimmt wurde", async () => {
    await laufendeRunde();
    const person = await clara();

    expect(await hasOpenRating(pool, person)).toBe(true);
  });

  it("erkennt keine offene Bewertung, sobald ueberall gestimmt ist", async () => {
    const runde = await laufendeRunde();
    const person = await clara();
    for (const poiId of runde.poiIds) {
      await castVote(
        pool,
        ACCOUNT_ID,
        person,
        runde.id,
        poiId,
        "wenn_zeit",
        NOW,
      );
    }

    expect(await hasOpenRating(pool, person)).toBe(false);
  });

  it("erkennt keine offene Bewertung nach dem Beenden der Runde", async () => {
    const runde = await laufendeRunde();
    const person = await clara();
    await endRatingRound(pool, ACCOUNT_ID, PARTICIPANT_ID, runde.id, SPAETER);

    expect(await hasOpenRating(pool, person)).toBe(false);
  });

  it("erkennt keine offene Bewertung bei einer Reise, zu der man nicht gehoert", async () => {
    await laufendeRunde();
    const person = await fremde();

    expect(await hasOpenRating(pool, person)).toBe(false);
  });
});
