// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import {
  deleteTripPosition,
  listTripPositions,
  saveTripPosition,
} from "./trip-positions";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const NOW = new Date("2026-07-20T14:09:00.000Z");
const SPAETER = new Date("2026-07-20T14:11:00.000Z");

type Pool = ReturnType<typeof createTestDb>;

let pool: Pool;

/** Eine zweite Person im selben Account -- fuer mehrere Positionen. */
async function weiterePerson(): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into participant (id, account_id, name, created_at)
     values ($1, $2, $3, $4)`,
    [id, ACCOUNT_ID, "Zweite Person", NOW],
  );
  return id;
}

beforeEach(() => {
  pool = createTestDb();
});

describe("trip_position (req-051)", () => {
  it("legt die geteilte Position eines Teilnehmers ab", async () => {
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896, ort: "Praiano" },
      NOW,
    );

    expect(await listTripPositions(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toEqual([
      {
        tripId: SUEDITALIEN_ID,
        participantId: PARTICIPANT_ID,
        lat: 40.6114,
        lng: 14.6896,
        ort: "Praiano",
        recordedAt: NOW.toISOString(),
      },
    ]);
  });

  it("haelt je Teilnehmer nur die letzte Position -- ohne Historie", async () => {
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896, ort: "Praiano" },
      NOW,
    );
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6281, lng: 14.4842, ort: "Positano" },
      SPAETER,
    );

    const positionen = await listTripPositions(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );

    expect(positionen).toHaveLength(1);
    expect(positionen[0].ort).toBe("Positano");
    expect(positionen[0].recordedAt).toBe(SPAETER.toISOString());
  });

  it("nimmt die Position auf Wunsch wieder heraus", async () => {
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896 },
      NOW,
    );

    await deleteTripPosition(pool, ACCOUNT_ID, SUEDITALIEN_ID, PARTICIPANT_ID);

    expect(await listTripPositions(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toEqual(
      [],
    );
  });

  it("speichert auch ohne bekannten Ort", async () => {
    const gespeichert = await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896 },
      NOW,
    );

    expect(gespeichert?.ort).toBeNull();
  });

  it("fuehrt die Positionen mehrerer Teilnehmer nebeneinander", async () => {
    const zweite = await weiterePerson();
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896 },
      NOW,
    );
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      zweite,
      { lat: 40.6281, lng: 14.4842 },
      SPAETER,
    );

    const positionen = await listTripPositions(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );

    expect(positionen.map((p) => p.participantId)).toEqual([
      zweite,
      PARTICIPANT_ID,
    ]);
  });

  it("speichert nichts zu einer Reise eines fremden Accounts", async () => {
    const fremderAccount = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [fremderAccount, "Andere Person", "andere@example.com"],
    );

    const gespeichert = await saveTripPosition(
      pool,
      fremderAccount,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896 },
      NOW,
    );

    expect(gespeichert).toBeNull();
  });

  it("liest keine Positionen aus einem fremden Account", async () => {
    const fremderAccount = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [fremderAccount, "Andere Person", "andere@example.com"],
    );
    await saveTripPosition(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896 },
      NOW,
    );

    expect(
      await listTripPositions(pool, fremderAccount, SUEDITALIEN_ID),
    ).toEqual([]);
  });
});
