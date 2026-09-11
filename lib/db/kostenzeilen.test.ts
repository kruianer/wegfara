// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { listActivities } from "./activities";
import {
  listKostenzeilen,
  saveKostenzeileZuProgrammpunkt,
  updateKostenzeile,
} from "./kostenzeilen";
import { listDocumentFileNamesOfTrip } from "./documents";
import { deleteTrip } from "./trips";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

type Pool = ReturnType<typeof createTestDb>;

let pool: Pool;

beforeEach(() => {
  pool = createTestDb();
});

async function ersterProgrammpunkt(): Promise<string> {
  const activities = await listActivities(pool, ACCOUNT_ID);
  return activities.find((activity) => activity.tripId === SUEDITALIEN_ID)!.id;
}

/** Ein zweiter Account mit eigener Reise und eigenem Programmpunkt. */
async function fremd(): Promise<{ tripId: string; activityId: string }> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const activityId = randomUUID();
  await pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  await pool.query(
    `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
     values ($1, $2, 'sehenswuerdigkeit', 'Fremder Punkt', '', '', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
    [activityId, tripId],
  );
  return { tripId, activityId };
}

describe("saveKostenzeileZuProgrammpunkt (req-062)", () => {
  it("legt die Zeile an, wenn es sie noch nicht gibt", async () => {
    const activityId = await ersterProgrammpunkt();

    const ergebnis = await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activityId,
      { anzahl: 1 },
    );

    expect(ergebnis.ok).toBe(true);
    const zeilen = await listKostenzeilen(pool, ACCOUNT_ID);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toMatchObject({
      tripId: SUEDITALIEN_ID,
      activityId,
      anzahl: 1,
    });
  });

  it("aendert die vorhandene Zeile, statt eine zweite anzulegen", async () => {
    const activityId = await ersterProgrammpunkt();
    await saveKostenzeileZuProgrammpunkt(pool, ACCOUNT_ID, activityId, {
      anzahl: 1,
    });

    await saveKostenzeileZuProgrammpunkt(pool, ACCOUNT_ID, activityId, {
      preisCent: 3000,
    });

    const zeilen = await listKostenzeilen(pool, ACCOUNT_ID);
    expect(zeilen).toHaveLength(1);
    // Was nicht genannt wird, bleibt stehen.
    expect(zeilen[0]).toMatchObject({ anzahl: 1, preisCent: 3000 });
  });

  it("legt zu einem Programmpunkt eines anderen Accounts nichts an", async () => {
    const { activityId } = await fremd();

    const ergebnis = await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activityId,
      { anzahl: 1 },
    );

    expect(ergebnis).toEqual({ ok: false, reason: "unknown" });
    expect(await listKostenzeilen(pool, ACCOUNT_ID)).toEqual([]);
  });
});

describe("listKostenzeilen (req-062)", () => {
  it("liefert nur die Zeilen der Reisen des eigenen Accounts", async () => {
    const { tripId } = await fremd();
    await pool.query(
      `insert into kostenzeile (id, trip_id, bezeichnung, preis_cent)
       values ($1, $2, 'Fremde Maut', 3000)`,
      [randomUUID(), tripId],
    );
    const activityId = await ersterProgrammpunkt();
    await saveKostenzeileZuProgrammpunkt(pool, ACCOUNT_ID, activityId, {
      anzahl: 2,
    });

    const zeilen = await listKostenzeilen(pool, ACCOUNT_ID);

    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].activityId).toBe(activityId);
  });
});

describe("updateKostenzeile (req-062)", () => {
  it("aendert nichts an einer Zeile eines anderen Accounts", async () => {
    const { tripId } = await fremd();
    const id = randomUUID();
    await pool.query(
      `insert into kostenzeile (id, trip_id, bezeichnung, preis_cent)
       values ($1, $2, 'Fremde Maut', 3000)`,
      [id, tripId],
    );

    const ergebnis = await updateKostenzeile(pool, ACCOUNT_ID, id, {
      preisCent: 100,
    });

    expect(ergebnis).toEqual({ ok: false, reason: "unknown" });
    const { rows } = await pool.query(
      `select preis_cent from kostenzeile where id = $1`,
      [id],
    );
    expect(Number((rows[0] as { preis_cent: number }).preis_cent)).toBe(3000);
  });
});

describe("deleteTrip mit Kostenplanung (req-062)", () => {
  it("nimmt der Reise ihre Kostenzeilen mit", async () => {
    const activityId = await ersterProgrammpunkt();
    await saveKostenzeileZuProgrammpunkt(pool, ACCOUNT_ID, activityId, {
      anzahl: 1,
    });
    // Wie in der Anwendung: die Dateinamen holt der Aufrufer vorher.
    await listDocumentFileNamesOfTrip(pool, SUEDITALIEN_ID);

    expect(await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(true);

    expect(await listKostenzeilen(pool, ACCOUNT_ID)).toEqual([]);
  });
});
