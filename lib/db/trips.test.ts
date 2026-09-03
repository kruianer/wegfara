// @vitest-environment node
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import {
  createTrip,
  deleteTrip,
  listTrips,
  listTripsForParticipant,
  setTripState,
  updateTrip,
} from "./trips";
import { createParticipant } from "./participants";
import { assignTripParticipant } from "./trip-participants";
import type { TripInput } from "../trips/validate";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

const TOSKANA: TripInput = {
  title: "Toskana 2027",
  startDate: "2027-05-12",
  endDate: "2027-05-19",
  mainPlace: { name: "Florenz", lat: 43.7696, lng: 11.2558 },
};

/** Ein zweiter Mandant mit eigener Reise, fuer die Trennungs-Tests. */
async function fremderAccountMitReise(
  pool: ReturnType<typeof createTestDb>,
): Promise<{ accountId: string; tripId: string }> {
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
  return { accountId, tripId };
}

async function countRows(
  pool: ReturnType<typeof createTestDb>,
  table: string,
  tripId: string,
): Promise<number> {
  const { rows } = await pool.query(
    `select count(*)::int as anzahl from ${table} where trip_id = $1`,
    [tripId],
  );
  return Number((rows[0] as { anzahl: number }).anzahl);
}

describe("listTrips", () => {
  it("liefert die Reisen des Accounts, sortiert nach Startdatum", async () => {
    const pool = createTestDb();

    const trips = await listTrips(pool, ACCOUNT_ID);

    expect(trips.map((t) => t.title)).toEqual([
      "Alpen-Adria-Radtour",
      "Süditalien Rundreise",
      "Wien Städtereise",
    ]);
    const suedItalien = trips.find((t) => t.title === "Süditalien Rundreise");
    expect(suedItalien).toMatchObject({
      startDate: "2026-07-18",
      endDate: "2026-07-23",
      mainPlace: { name: "Amalfi" },
    });
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    await fremderAccountMitReise(pool);

    const trips = await listTrips(pool, ACCOUNT_ID);

    expect(trips.some((t) => t.title === "Fremde Reise")).toBe(false);
  });
});

describe("createTrip (req-017)", () => {
  it("legt die Reise im Account an und liefert sie zurueck", async () => {
    const pool = createTestDb();

    const created = await createTrip(pool, ACCOUNT_ID, TOSKANA);

    expect(created).toMatchObject(TOSKANA);
    const trips = await listTrips(pool, ACCOUNT_ID);
    expect(trips).toHaveLength(4);
    expect(trips.find((t) => t.id === created.id)).toEqual(created);
  });

  it("legt eine Reise mit zurueckliegendem Zeitraum an", async () => {
    const pool = createTestDb();

    const created = await createTrip(pool, ACCOUNT_ID, {
      ...TOSKANA,
      title: "Rom 2019",
      startDate: "2019-04-01",
      endDate: "2019-04-10",
    });

    const trips = await listTrips(pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === created.id)?.startDate).toBe(
      "2019-04-01",
    );
  });
});

describe("updateTrip (req-017)", () => {
  it("korrigiert Titel, Zeitraum und Hauptort", async () => {
    const pool = createTestDb();

    const updated = await updateTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID, {
      ...TOSKANA,
      title: "Toskana Frühling 2027",
    });

    expect(updated?.title).toBe("Toskana Frühling 2027");
    const trips = await listTrips(pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)).toMatchObject({
      title: "Toskana Frühling 2027",
      startDate: "2027-05-12",
      mainPlace: { name: "Florenz" },
    });
  });

  it("aendert keine Reise eines anderen Accounts (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    const updated = await updateTrip(pool, ACCOUNT_ID, fremd.tripId, TOSKANA);

    expect(updated).toBeNull();
    const { rows } = await pool.query("select title from trip where id = $1", [
      fremd.tripId,
    ]);
    expect((rows[0] as { title: string }).title).toBe("Fremde Reise");
  });
});

describe("listTripsForParticipant (req-023)", () => {
  /** Clara Berger, der Süditalien-Rundreise als Teilnehmerin zugeordnet. */
  async function clara(pool: ReturnType<typeof createTestDb>) {
    const person = await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      new Date("2026-09-03T12:00:00Z"),
    );
    await assignTripParticipant(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      person.id,
      "teilnehmer",
    );
    return person;
  }

  it("zeigt dem Reiseleiter seine Reisen in jedem Zustand", async () => {
    const pool = createTestDb();

    const trips = await listTripsForParticipant(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
    );

    expect(trips).toHaveLength(3);
    expect(trips.every((trip) => trip.state === "in_planung")).toBe(true);
  });

  it("zeigt einer Teilnehmerin eine Reise „In Planung“ nicht", async () => {
    const pool = createTestDb();
    const person = await clara(pool);

    const trips = await listTripsForParticipant(pool, ACCOUNT_ID, person.id);

    expect(trips).toEqual([]);
  });

  it("zeigt ihr die Reise, sobald sie freigegeben ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    const trips = await listTripsForParticipant(pool, ACCOUNT_ID, person.id);

    expect(trips.map((trip) => trip.title)).toEqual(["Süditalien Rundreise"]);
  });

  it("zeigt ihr keine Reise, der sie nicht zugeordnet ist", async () => {
    const pool = createTestDb();
    const person = await clara(pool);
    await setTripState(pool, ACCOUNT_ID, WIEN_ID, "freigegeben");

    const trips = await listTripsForParticipant(pool, ACCOUNT_ID, person.id);

    expect(trips).toEqual([]);
  });

  it("zeigt keine Reise eines anderen Accounts (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    const trips = await listTripsForParticipant(
      pool,
      fremd.accountId,
      PARTICIPANT_ID,
    );

    expect(trips).toEqual([]);
  });

  it("zeigt der Person des ersten Accounts die Reise des zweiten nicht (req-024)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);
    // Der zweite Account hat eine eigene, freigegebene Reise mit eigener
    // Person -- gesehen wird sie nur dort.
    await pool.query(`update trip set state = 'freigegeben' where id = $1`, [
      fremd.tripId,
    ]);
    const fremdePerson = await createParticipant(
      pool,
      fremd.accountId,
      {
        name: "Fremde Person",
        nickname: null,
        email: null,
        phone: null,
        iban: null,
      },
      new Date("2026-09-03T12:00:00Z"),
    );
    await assignTripParticipant(
      pool,
      fremd.accountId,
      fremd.tripId,
      fremdePerson.id,
      "reiseleiter",
    );

    const eigene = await listTripsForParticipant(
      pool,
      ACCOUNT_ID,
      PARTICIPANT_ID,
    );

    expect(eigene.map((trip) => trip.title)).not.toContain("Fremde Reise");
    expect(
      (
        await listTripsForParticipant(pool, fremd.accountId, fremdePerson.id)
      ).map((trip) => trip.title),
    ).toEqual(["Fremde Reise"]);
  });
});

describe("deleteTrip (req-017)", () => {
  it("entfernt die Reise aus der Liste", async () => {
    const pool = createTestDb();

    expect(await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID)).toBe(true);

    const trips = await listTrips(pool, ACCOUNT_ID);
    expect(trips.map((t) => t.title)).toEqual([
      "Alpen-Adria-Radtour",
      "Wien Städtereise",
    ]);
  });

  it("laesst keine verwaisten Daten zurueck", async () => {
    const pool = createTestDb();
    // Die Suditalien Rundreise ist die einzige Demo-Reise mit Daten in
    // allen betroffenen Tabellen.
    expect(await countRows(pool, "poi", SUEDITALIEN_ID)).toBeGreaterThan(0);
    expect(await countRows(pool, "activity", SUEDITALIEN_ID)).toBeGreaterThan(
      0,
    );
    expect(await countRows(pool, "transfer", SUEDITALIEN_ID)).toBeGreaterThan(
      0,
    );
    await pool.query(`insert into search_area (id, trip_id) values ($1, $2)`, [
      randomUUID(),
      SUEDITALIEN_ID,
    ]);
    const { rows: areas } = await pool.query(
      "select id from search_area where trip_id = $1",
      [SUEDITALIEN_ID],
    );
    await pool.query(
      `insert into search_area_point (id, search_area_id, position, lat, lng)
       values ($1, $2, 0, 40.8, 14.2)`,
      [randomUUID(), (areas[0] as { id: string }).id],
    );

    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    expect(await countRows(pool, "poi", SUEDITALIEN_ID)).toBe(0);
    expect(await countRows(pool, "activity", SUEDITALIEN_ID)).toBe(0);
    expect(await countRows(pool, "transfer", SUEDITALIEN_ID)).toBe(0);
    expect(
      await countRows(pool, "activity_option_selection", SUEDITALIEN_ID),
    ).toBe(0);
    expect(await countRows(pool, "search_area", SUEDITALIEN_ID)).toBe(0);
    const { rows: points } = await pool.query(
      "select id from search_area_point",
    );
    expect(points).toHaveLength(0);
  });

  it("laesst die Daten der anderen Reisen unangetastet", async () => {
    const pool = createTestDb();
    const wienId = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";
    const poisVorher = await countRows(pool, "poi", wienId);

    await deleteTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID);

    expect(await countRows(pool, "poi", wienId)).toBe(poisVorher);
  });

  it("loescht keine Reise eines anderen Accounts (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    expect(await deleteTrip(pool, ACCOUNT_ID, fremd.tripId)).toBe(false);

    const { rows } = await pool.query("select id from trip where id = $1", [
      fremd.tripId,
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("setTripState (req-022)", () => {
  async function stateOf(
    pool: ReturnType<typeof createTestDb>,
    tripId: string,
  ): Promise<string> {
    const trips = await listTrips(pool, ACCOUNT_ID);
    return trips.find((t) => t.id === tripId)!.state;
  }

  it('legt eine neue Reise mit dem Zustand "in_planung" an', async () => {
    const pool = createTestDb();

    const created = await createTrip(pool, ACCOUNT_ID, TOSKANA);

    expect(created.state).toBe("in_planung");
    expect(await stateOf(pool, created.id)).toBe("in_planung");
  });

  it("gibt die Reise frei und haelt das fest", async () => {
    const pool = createTestDb();

    const updated = await setTripState(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "freigegeben",
    );

    expect(updated).toMatchObject({
      id: SUEDITALIEN_ID,
      title: "Süditalien Rundreise",
      state: "freigegeben",
    });
    expect(await stateOf(pool, SUEDITALIEN_ID)).toBe("freigegeben");
  });

  it("nimmt eine Freigabe wieder zurueck", async () => {
    const pool = createTestDb();
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "in_planung");

    expect(await stateOf(pool, SUEDITALIEN_ID)).toBe("in_planung");
  });

  it("oeffnet eine abgeschlossene Reise wieder", async () => {
    const pool = createTestDb();
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "abgeschlossen");

    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    expect(await stateOf(pool, SUEDITALIEN_ID)).toBe("freigegeben");
  });

  it("laesst den Zeitraum unangetastet -- Zustand und Zeitstatus sind getrennt", async () => {
    const pool = createTestDb();

    const updated = await setTripState(
      pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      "abgeschlossen",
    );

    expect(updated).toMatchObject({
      startDate: "2026-07-18",
      endDate: "2026-07-23",
    });
  });

  it("behaelt den Zustand, wenn Titel und Zeitraum geaendert werden", async () => {
    const pool = createTestDb();
    await setTripState(pool, ACCOUNT_ID, SUEDITALIEN_ID, "freigegeben");

    const updated = await updateTrip(pool, ACCOUNT_ID, SUEDITALIEN_ID, {
      ...TOSKANA,
      title: "Süditalien 2027",
    });

    expect(updated?.state).toBe("freigegeben");
    expect(await stateOf(pool, SUEDITALIEN_ID)).toBe("freigegeben");
  });

  it("aendert keine Reise eines anderen Accounts (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const fremd = await fremderAccountMitReise(pool);

    const updated = await setTripState(
      pool,
      ACCOUNT_ID,
      fremd.tripId,
      "freigegeben",
    );

    expect(updated).toBeNull();
    const { rows } = await pool.query("select state from trip where id = $1", [
      fremd.tripId,
    ]);
    expect((rows[0] as { state: string }).state).toBe("in_planung");
  });

  it("laesst keinen erfundenen Zustand in die Datenbank", async () => {
    const pool = createTestDb();

    await expect(
      pool.query("update trip set state = 'archiviert' where id = $1", [
        SUEDITALIEN_ID,
      ]),
    ).rejects.toThrow();
  });
});
