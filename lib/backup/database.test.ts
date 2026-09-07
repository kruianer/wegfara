// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { listPois, deletePoi } from "@/lib/db/pois";
import { listTrips, deleteTrip } from "@/lib/db/trips";
import { listActivities } from "@/lib/db/activities";
import {
  dumpDatabase,
  dumpRowCount,
  restoreDatabase,
  serializeDate,
  serializeValue,
} from "./database";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

type Pool = ReturnType<typeof createTestDb>;

async function ersterPoiId(pool: Pool): Promise<string> {
  const pois = await listPois(pool, ACCOUNT_ID);
  return pois[0].id;
}

describe("dumpDatabase / restoreDatabase (req-053)", () => {
  it("schreibt den gesamten Inhalt zurueck", async () => {
    const pool = createTestDb();
    const vorher = await listTrips(pool, ACCOUNT_ID);
    const dump = await dumpDatabase(pool);

    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);
    expect(await listTrips(pool, ACCOUNT_ID)).toHaveLength(vorher.length - 1);

    await restoreDatabase(pool, dump);

    expect(await listTrips(pool, ACCOUNT_ID)).toEqual(vorher);
  });

  it("bringt die Reisen auf den Stand des Backups zurueck", async () => {
    const pool = createTestDb();
    const gestern = await dumpDatabase(pool);

    await pool.query("update trip set title = $1 where id = $2", [
      "Heute umbenannt",
      SUEDITALIEN_ID,
    ]);

    await restoreDatabase(pool, gestern);

    const reisen = await listTrips(pool, ACCOUNT_ID);
    expect(reisen.map((trip) => trip.title)).not.toContain("Heute umbenannt");
    expect(reisen.find((trip) => trip.id === SUEDITALIEN_ID)?.title).toBe(
      "Süditalien Rundreise",
    );
  });

  it("laesst einen vor dem Backup geloeschten POI geloescht", async () => {
    const pool = createTestDb();
    const poiId = await ersterPoiId(pool);

    await deletePoi(pool, ACCOUNT_ID, poiId);
    const dump = await dumpDatabase(pool);

    await restoreDatabase(pool, dump);

    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.map((poi) => poi.id)).not.toContain(poiId);
  });

  it("haelt Datum und Uhrzeit unveraendert", async () => {
    const pool = createTestDb();
    const reisenVorher = await listTrips(pool, ACCOUNT_ID);
    const punkteVorher = await listActivities(pool, ACCOUNT_ID);
    const dump = await dumpDatabase(pool);

    await restoreDatabase(pool, dump);

    expect(await listTrips(pool, ACCOUNT_ID)).toEqual(reisenVorher);
    expect(await listActivities(pool, ACCOUNT_ID)).toEqual(punkteVorher);
  });

  it("leert eine Tabelle, die das Backup nicht kennt", async () => {
    const pool = createTestDb();
    await pool.query(
      `insert into trip_position (trip_id, participant_id, account_id, lat, lng, ort, recorded_at)
       values ($1, $2, $3, 40.63, 14.6, 'Amalfi', $4)`,
      [SUEDITALIEN_ID, PARTICIPANT_ID, ACCOUNT_ID, new Date().toISOString()],
    );
    const dump = await dumpDatabase(pool);
    // Ein aelteres Backup, das diese Tabelle noch nicht kennt: danach steht
    // die Datenbank auf seinem Stand und nicht auf einer Mischung.
    dump.tables = dump.tables.filter((table) => table.name !== "trip_position");

    await restoreDatabase(pool, dump);

    const { rows } = await pool.query("select * from trip_position");
    expect(rows).toEqual([]);
  });

  it("uebergeht eine Spalte, die es im Schema nicht mehr gibt", async () => {
    const pool = createTestDb();
    const dump = await dumpDatabase(pool);
    const reisen = dump.tables.find((table) => table.name === "trip");
    if (!reisen) throw new Error("Tabelle trip fehlt im Backup");
    reisen.columns.push("laengst_entfallen");
    for (const row of reisen.rows) row.push("egal");

    await restoreDatabase(pool, dump);

    expect(await listTrips(pool, ACCOUNT_ID)).toHaveLength(reisen.rows.length);
  });

  it("zaehlt die gesicherten Datensaetze", async () => {
    const pool = createTestDb();

    const dump = await dumpDatabase(pool);

    expect(dumpRowCount(dump)).toBe(
      dump.tables.reduce((sum, table) => sum + table.rows.length, 0),
    );
    expect(dumpRowCount(dump)).toBeGreaterThan(0);
  });

  it("laesst den Bestand unangetastet, wenn das Einfuegen scheitert", async () => {
    const pool = createTestDb();
    const dump = await dumpDatabase(pool);
    const reisen = dump.tables.find((table) => table.name === "trip");
    if (!reisen) throw new Error("Tabelle trip fehlt im Backup");
    // Eine Reise ohne Titel verletzt das Schema -- die Wiederherstellung
    // muss daran scheitern und nichts halb Fertiges hinterlassen.
    reisen.rows[0][reisen.columns.indexOf("title")] = null;

    await expect(restoreDatabase(pool, dump)).rejects.toThrow();
  });
});

describe("serializeValue (req-053)", () => {
  it("haelt ein Datum ohne Zeitzone fest", () => {
    expect(serializeDate(new Date(2026, 6, 18), "date")).toBe("2026-07-18");
  });

  it("haelt einen Zeitstempel ohne Zeitzone als Ortszeit fest", () => {
    expect(
      serializeDate(
        new Date(2026, 6, 18, 10, 30, 0),
        "timestamp without time zone",
      ),
    ).toBe("2026-07-18T10:30:00.000");
  });

  it("haelt einen Zeitstempel mit Zeitzone absolut fest", () => {
    expect(
      serializeDate(
        new Date("2026-07-18T08:30:00.000Z"),
        "timestamp with time zone",
      ),
    ).toBe("2026-07-18T08:30:00.000Z");
  });

  it("reicht einfache Werte unveraendert durch", () => {
    expect(serializeValue(null, "text")).toBeNull();
    expect(serializeValue(undefined, "text")).toBeNull();
    expect(serializeValue("Amalfi", "text")).toBe("Amalfi");
    expect(serializeValue(40.634, "double precision")).toBe(40.634);
    expect(serializeValue(true, "boolean")).toBe(true);
    expect(serializeValue(12n, "bigint")).toBe("12");
  });
});
