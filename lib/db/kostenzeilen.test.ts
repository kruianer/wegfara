// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { deleteActivity, listActivities } from "./activities";
import {
  listKostenzeilen,
  saveKostenzeileZuProgrammpunkt,
  updateKostenzeile,
} from "./kostenzeilen";
import { listDocumentFileNamesOfTrip } from "./documents";
import { listPois, setPoiKostenCent } from "./pois";
import { deleteTrip } from "./trips";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const NOW = new Date("2026-09-11T10:00:00.000Z");

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
      NOW,
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
    await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activityId,
      { anzahl: 1 },
      NOW,
    );

    await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activityId,
      { preisCent: 3000 },
      NOW,
    );

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
      NOW,
    );

    expect(ergebnis).toEqual({ ok: false, reason: "unknown" });
    expect(await listKostenzeilen(pool, ACCOUNT_ID)).toEqual([]);
  });
});

describe("listKostenzeilen (req-062)", () => {
  it("liefert nur die Zeilen der Reisen des eigenen Accounts", async () => {
    const { tripId } = await fremd();
    await pool.query(
      `insert into kostenzeile (id, trip_id, bezeichnung, preis_cent, created_at)
       values ($1, $2, 'Fremde Maut', 3000, $3)`,
      [randomUUID(), tripId, NOW],
    );
    const activityId = await ersterProgrammpunkt();
    await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activityId,
      { anzahl: 2 },
      NOW,
    );

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
      `insert into kostenzeile (id, trip_id, bezeichnung, preis_cent, created_at)
       values ($1, $2, 'Fremde Maut', 3000, $3)`,
      [id, tripId, NOW],
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
    await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activityId,
      { anzahl: 1 },
      NOW,
    );
    // Wie in der Anwendung: die Dateinamen holt der Aufrufer vorher.
    await listDocumentFileNamesOfTrip(pool, SUEDITALIEN_ID);

    expect(await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(true);

    expect(await listKostenzeilen(pool, ACCOUNT_ID)).toEqual([]);
  });
});

/**
 * Eine Zeile aus dem Plan verschwindet mit ihrem Programmpunkt (req-062) --
 * sie kommt aus dem Plan. Der Preis bleibt dabei am POI gespeichert: wird
 * der Ort erneut verplant, steht er wieder da.
 */
describe("deleteActivity mit Kostenzeile (req-062)", () => {
  async function verplanterPunkt() {
    const activities = await listActivities(pool, ACCOUNT_ID);
    return activities.find(
      (activity) => activity.tripId === SUEDITALIEN_ID && activity.poiId,
    )!;
  }

  it("nimmt dem Programmpunkt seine Kostenzeile mit", async () => {
    const activity = await verplanterPunkt();
    await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activity.id,
      { anzahl: 1 },
      NOW,
    );

    await deleteActivity(pool, ACCOUNT_ID, activity.id);

    expect(await listKostenzeilen(pool, ACCOUNT_ID)).toEqual([]);
  });

  it("laesst den Preis am POI stehen", async () => {
    const activity = await verplanterPunkt();
    await setPoiKostenCent(pool, ACCOUNT_ID, activity.poiId!, 1250);
    await saveKostenzeileZuProgrammpunkt(
      pool,
      ACCOUNT_ID,
      activity.id,
      { anzahl: 1 },
      NOW,
    );

    await deleteActivity(pool, ACCOUNT_ID, activity.id);

    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.find((poi) => poi.id === activity.poiId)?.kostenCent).toBe(
      1250,
    );
  });
});
