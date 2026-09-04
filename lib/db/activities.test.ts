// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { createActivity, deleteActivity, listActivities } from "./activities";
import { ACCOUNT_ID } from "@/tests/test-db";
import type { ActivityValues } from "@/lib/activities/types";

function createTestDb() {
  const db = newDb();
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.public.none(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

describe("listActivities", () => {
  it("liefert die Programmpunkte des Accounts, sortiert nach Beginnzeit", async () => {
    const pool = createTestDb();

    const activities = await listActivities(pool, ACCOUNT_ID);

    expect(activities.length).toBeGreaterThan(0);
    const startTimes = activities.map((a) => a.startAt);
    const sorted = [...startTimes].sort();
    expect(startTimes).toEqual(sorted);

    const domVonAmalfi = activities.find((a) => a.title === "Dom von Amalfi");
    expect(domVonAmalfi).toMatchObject({
      type: "sehenswuerdigkeit",
      tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
      startAt: "2026-07-18T10:00",
      endAt: "2026-07-18T12:30",
      position: { lat: 40.6343, lng: 14.6027 },
      booked: true,
    });
  });

  it("liefert den hinterlegten Buchungszustand und die Kontaktwege (req-005)", async () => {
    const pool = createTestDb();

    const activities = await listActivities(pool, ACCOUNT_ID);

    const marinella = activities.find(
      (a) => a.title === "Mittagessen bei La Marinella",
    );
    expect(marinella).toMatchObject({
      booked: false,
      bookingUrl: "https://www.ristorantelamarinella.it",
    });
    expect(marinella?.bookingEmail).toBeUndefined();
    expect(marinella?.bookingPhone).toBeUndefined();

    const hotel = activities.find(
      (a) => a.title === "Check-in Hotel Luna Convento",
    );
    expect(hotel).toMatchObject({
      booked: false,
      bookingEmail: "info@lunaconvento.it",
    });

    const aussichtspunkt = activities.find(
      (a) => a.title === "Aussichtspunkt Amalfikueste",
    );
    expect(aussichtspunkt).toMatchObject({
      booked: false,
      bookingPhone: "+39 089 871483",
    });

    const unbebucht = activities.find(
      (a) => a.title === "Ausgrabungen von Pompeji",
    );
    expect(unbebucht).toMatchObject({ booked: false });
    expect(unbebucht?.bookingUrl).toBeUndefined();
    expect(unbebucht?.bookingEmail).toBeUndefined();
    expect(unbebucht?.bookingPhone).toBeUndefined();
  });

  it("liefert keine Position, wenn lat/lng nicht hinterlegt sind (req-006)", async () => {
    const pool = createTestDb();

    const activities = await listActivities(pool, ACCOUNT_ID);

    const stadtbummel = activities.find(
      (a) => a.title === "Abendlicher Stadtbummel in Positano",
    );
    expect(stadtbummel?.position).toBeUndefined();
  });

  it('liefert den Ausgangspunkt der Anreise als Programmpunkt vom Typ "Stadt & Dorf" (req-018)', async () => {
    const pool = createTestDb();

    const activities = await listActivities(pool, ACCOUNT_ID);

    const ausgangspunkt = activities.find(
      (a) => a.id === "ef2aebad-92fd-4990-a08f-a942d211ebf5",
    );
    expect(ausgangspunkt).toMatchObject({
      tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
      type: "stadt_dorf",
      title: "Wien",
      startAt: "2026-07-18T06:00",
      position: { lat: 48.2082, lng: 16.3738 },
    });
  });

  it("liefert die verknuepfte POI-ID eines aus einem POI verplanten Programmpunkts (req-011)", async () => {
    const pool = createTestDb();

    const activities = await listActivities(pool, ACCOUNT_ID);

    const pompeji = activities.find(
      (a) => a.title === "Ausgrabungen von Pompeji",
    );
    expect(pompeji?.poiId).toBe("462f6811-13cc-4247-99aa-8b9693955ab7");

    const domVonAmalfi = activities.find((a) => a.title === "Dom von Amalfi");
    expect(domVonAmalfi?.poiId).toBeUndefined();
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const otherAccountId = randomUUID();
    const otherTripId = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [otherAccountId, "Andere Person", "andere@example.com"],
    );
    await pool.query(
      `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
       values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
      [otherTripId, otherAccountId],
    );
    await pool.query(
      `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt', 'kurz', 'lang', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [randomUUID(), otherTripId],
    );

    const activities = await listActivities(pool, ACCOUNT_ID);

    expect(activities.some((a) => a.title === "Fremder Programmpunkt")).toBe(
      false,
    );
  });
});

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const POMPEJI_POI_ID = "462f6811-13cc-4247-99aa-8b9693955ab7";

function pompejiValues(
  overrides: Partial<ActivityValues> = {},
): ActivityValues {
  return {
    tripId: SUEDITALIEN_ID,
    poiId: POMPEJI_POI_ID,
    type: "sehenswuerdigkeit",
    title: "Ausgrabungsstätte Pompeji",
    shortText: "",
    longText: "",
    startAt: "2026-07-20T10:00",
    endAt: "2026-07-20T12:30",
    position: { lat: 40.7489, lng: 14.4989 },
    ...overrides,
  };
}

describe("createActivity (req-039)", () => {
  it("legt den Programmpunkt zu einem verplanten POI an", async () => {
    const pool = createTestDb();

    const activity = await createActivity(pool, ACCOUNT_ID, pompejiValues());

    expect(activity).toMatchObject({
      tripId: SUEDITALIEN_ID,
      poiId: POMPEJI_POI_ID,
      type: "sehenswuerdigkeit",
      title: "Ausgrabungsstätte Pompeji",
      shortText: "",
      longText: "",
      startAt: "2026-07-20T10:00",
      endAt: "2026-07-20T12:30",
      position: { lat: 40.7489, lng: 14.4989 },
      booked: false,
    });
  });

  it("bleibt nach dem Anlegen gespeichert -- auch beim naechsten Laden", async () => {
    const pool = createTestDb();

    const angelegt = await createActivity(pool, ACCOUNT_ID, pompejiValues());
    const activities = await listActivities(pool, ACCOUNT_ID);

    expect(activities.find((a) => a.id === angelegt!.id)).toMatchObject({
      startAt: "2026-07-20T10:00",
      endAt: "2026-07-20T12:30",
    });
  });

  it("legt nichts in einer Reise eines anderen Accounts an (req-024)", async () => {
    const pool = createTestDb();
    const accountId = randomUUID();
    const tripId = randomUUID();
    await pool.query(
      "insert into account (id, name, email) values ($1, $2, $3)",
      [accountId, "Andere Person", "andere@example.com"],
    );
    await pool.query(
      `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
       values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
      [tripId, accountId],
    );

    const activity = await createActivity(
      pool,
      ACCOUNT_ID,
      pompejiValues({ tripId, poiId: null }),
    );

    expect(activity).toBeNull();
    const { rows } = await pool.query(
      "select id from activity where trip_id = $1",
      [tripId],
    );
    expect(rows).toHaveLength(0);
  });
});

describe("deleteActivity (req-039)", () => {
  it("entfernt den Programmpunkt und liefert seine POI-Verknuepfung", async () => {
    const pool = createTestDb();
    const angelegt = await createActivity(pool, ACCOUNT_ID, pompejiValues());

    const entfernt = await deleteActivity(pool, ACCOUNT_ID, angelegt!.id);

    expect(entfernt).toMatchObject({ id: angelegt!.id, poiId: POMPEJI_POI_ID });
    const activities = await listActivities(pool, ACCOUNT_ID);
    expect(activities.some((a) => a.id === angelegt!.id)).toBe(false);
  });

  it("nimmt die Wege von und zu ihm mit -- ohne ihn fuehren sie ins Leere", async () => {
    const pool = createTestDb();
    // "Mittagessen bei La Marinella" haengt an zwei Transfers (req-006).
    const activityId = "384d0b94-df7f-44b3-8bcf-013b41a6d265";

    await deleteActivity(pool, ACCOUNT_ID, activityId);

    const { rows } = await pool.query(
      `select id from transfer where from_activity_id = $1 or to_activity_id = $1`,
      [activityId],
    );
    expect(rows).toHaveLength(0);
  });

  it("nimmt eine Wahl unter Alternativen mit, die auf ihn zeigt (req-004)", async () => {
    const pool = createTestDb();
    const activityId = "1a2b3c4d-0002-4a11-8b11-9f1c2d3e4f02";
    await pool.query(
      `insert into activity_option_selection (trip_id, start_at, end_at, selected_activity_id)
       values ($1, '2026-07-21 13:30', '2026-07-21 15:00', $2)`,
      [SUEDITALIEN_ID, activityId],
    );

    await deleteActivity(pool, ACCOUNT_ID, activityId);

    const { rows } = await pool.query(
      `select trip_id from activity_option_selection where selected_activity_id = $1`,
      [activityId],
    );
    expect(rows).toHaveLength(0);
  });

  it("entfernt keinen Programmpunkt eines anderen Accounts (req-024)", async () => {
    const pool = createTestDb();
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
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt', '', '', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [activityId, tripId],
    );

    const entfernt = await deleteActivity(pool, ACCOUNT_ID, activityId);

    expect(entfernt).toBeNull();
    const { rows } = await pool.query("select id from activity where id = $1", [
      activityId,
    ]);
    expect(rows).toHaveLength(1);
  });
});
