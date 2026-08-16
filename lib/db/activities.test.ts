// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import { listActivities } from "./activities";
import { ACCOUNT_ID } from "../account";

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
