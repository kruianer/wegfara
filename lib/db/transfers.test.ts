// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { newDb } from "pg-mem";
import { randomUUID } from "node:crypto";
import {
  createTransfer,
  deleteTransfer,
  findTransfer,
  findTransferBetween,
  listTransfers,
  updateTransfer,
} from "./transfers";
import { deleteActivity } from "./activities";
import { ACCOUNT_ID } from "@/tests/test-db";

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

describe("listTransfers", () => {
  it("liefert die Transfers des Accounts (req-006)", async () => {
    const pool = createTestDb();

    const transfers = await listTransfers(pool, ACCOUNT_ID);

    expect(transfers.length).toBeGreaterThan(0);
    const zumAussichtspunkt = transfers.find(
      (t) => t.title === "Fahrt zum Aussichtspunkt",
    );
    expect(zumAussichtspunkt).toMatchObject({
      tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
      fromActivityId: "384d0b94-df7f-44b3-8bcf-013b41a6d265",
      toActivityId: "deaacefe-9cc1-4835-9be5-5b23a231720c",
      mode: "auto",
      durationMin: 12,
      distanceKm: 4.2,
    });
  });

  it("liefert An- und Abreise als Transfer mit den neuen Verkehrsmitteln (req-018)", async () => {
    const pool = createTestDb();

    const transfers = await listTransfers(pool, ACCOUNT_ID);

    expect(transfers.find((t) => t.title === "Flug Wien–Neapel")).toMatchObject(
      {
        tripId: "d5fda5ea-65e7-4b47-8096-62618599a288",
        fromActivityId: "ef2aebad-92fd-4990-a08f-a942d211ebf5",
        toActivityId: "6460c010-7440-4c0a-a598-197b306cacf1",
        mode: "flug",
      },
    );
    expect(
      transfers.find((t) => t.title === "Railjet Salzburg–Wien")?.mode,
    ).toBe("bahn");
    expect(
      transfers.find((t) => t.title === "Fähre nach Marina Grande")?.mode,
    ).toBe("faehre");
  });

  it("filtert nach Account (Mandantentrennung)", async () => {
    const pool = createTestDb();
    const otherAccountId = randomUUID();
    const otherTripId = randomUUID();
    const activityAId = randomUUID();
    const activityBId = randomUUID();
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
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt A', 'kurz', 'lang', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
      [activityAId, otherTripId],
    );
    await pool.query(
      `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
       values ($1, $2, 'restaurant', 'Fremder Programmpunkt B', 'kurz', 'lang', '2027-01-01 12:00', '2027-01-01 13:00', 52.52, 13.405)`,
      [activityBId, otherTripId],
    );
    await pool.query(
      `insert into transfer (id, trip_id, from_activity_id, to_activity_id, mode, title, duration_min, distance_km)
       values ($1, $2, $3, $4, 'auto', 'Fremder Transfer', 10, 2)`,
      [randomUUID(), otherTripId, activityAId, activityBId],
    );

    const transfers = await listTransfers(pool, ACCOUNT_ID);

    expect(transfers.some((t) => t.title === "Fremder Transfer")).toBe(false);
  });
});

/** Zwei Programmpunkte des 21.07. der Sueditalien-Rundreise, noch ohne Transfer. */
const POMPEJI_ID = "58ccb947-6c2e-4b18-a9cc-47461e47140d";
const SORRENT_ID = "7052adca-7b5f-4a16-85bd-ca0f4513566e";
const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
/** Ein Programmpunkt einer anderen Reise desselben Accounts. */
const STEPHANSDOM_ID = "e563305e-2df4-4deb-b87d-33402c5c68f2";

const ANGABEN = {
  mode: "auto" as const,
  title: "Fahrt nach Sorrent",
  durationMin: 45,
  distanceKm: 30.5,
};

describe("createTransfer (req-052)", () => {
  it("legt den Transfer zwischen zwei Programmpunkten an", async () => {
    const pool = createTestDb();

    const transfer = await createTransfer(pool, ACCOUNT_ID, {
      ...ANGABEN,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
    });

    expect(transfer).toMatchObject({
      // Die Reise kommt aus den Programmpunkten, nicht aus der Anfrage.
      tripId: SUEDITALIEN_ID,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
      ...ANGABEN,
    });
    expect(
      await findTransferBetween(pool, ACCOUNT_ID, POMPEJI_ID, SORRENT_ID),
    ).toMatchObject({ id: transfer!.id });
  });

  it("legt keinen Transfer zwischen zwei Reisen an", async () => {
    const pool = createTestDb();

    expect(
      await createTransfer(pool, ACCOUNT_ID, {
        ...ANGABEN,
        fromActivityId: POMPEJI_ID,
        toActivityId: STEPHANSDOM_ID,
      }),
    ).toBeNull();
  });

  it("legt keinen Transfer zu einem fremden Programmpunkt an", async () => {
    const pool = createTestDb();
    const fremderAccount = randomUUID();

    expect(
      await createTransfer(pool, fremderAccount, {
        ...ANGABEN,
        fromActivityId: POMPEJI_ID,
        toActivityId: SORRENT_ID,
      }),
    ).toBeNull();
  });

  it("laesst zwischen denselben zwei Programmpunkten keinen zweiten zu", async () => {
    const pool = createTestDb();
    const werte = {
      ...ANGABEN,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
    };
    await createTransfer(pool, ACCOUNT_ID, werte);

    await expect(createTransfer(pool, ACCOUNT_ID, werte)).rejects.toThrow();
  });
});

describe("updateTransfer (req-052)", () => {
  it("aendert Verkehrsmittel, Titel, Dauer und Strecke", async () => {
    const pool = createTestDb();
    const angelegt = await createTransfer(pool, ACCOUNT_ID, {
      ...ANGABEN,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
    });

    const geaendert = await updateTransfer(pool, ACCOUNT_ID, angelegt!.id, {
      mode: "faehre",
      title: "Fähre nach Sorrent",
      durationMin: 45,
      distanceKm: 18.5,
    });

    expect(geaendert).toMatchObject({
      // Zwischen welchen Programmpunkten er liegt, bleibt.
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
      mode: "faehre",
      title: "Fähre nach Sorrent",
      durationMin: 45,
      distanceKm: 18.5,
    });
  });

  it("aendert keinen Transfer eines fremden Accounts", async () => {
    const pool = createTestDb();

    expect(
      await updateTransfer(
        pool,
        randomUUID(),
        "4879b2a4-d673-4d70-97c2-f5d0cb505f04",
        ANGABEN,
      ),
    ).toBeNull();
  });
});

describe("deleteTransfer (req-052)", () => {
  it("entfernt den Transfer und liefert ihn zurueck", async () => {
    const pool = createTestDb();
    const angelegt = await createTransfer(pool, ACCOUNT_ID, {
      ...ANGABEN,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
    });

    expect(await deleteTransfer(pool, ACCOUNT_ID, angelegt!.id)).toMatchObject({
      id: angelegt!.id,
    });
    expect(await findTransfer(pool, ACCOUNT_ID, angelegt!.id)).toBeNull();
  });

  it("entfernt keinen Transfer eines fremden Accounts", async () => {
    const pool = createTestDb();

    expect(
      await deleteTransfer(
        pool,
        randomUUID(),
        "4879b2a4-d673-4d70-97c2-f5d0cb505f04",
      ),
    ).toBeNull();
  });
});

describe("Transfer und Programmpunkt (req-052)", () => {
  it("verschwindet mit dem entfernten Programmpunkt", async () => {
    const pool = createTestDb();
    const angelegt = await createTransfer(pool, ACCOUNT_ID, {
      ...ANGABEN,
      fromActivityId: POMPEJI_ID,
      toActivityId: SORRENT_ID,
    });

    await deleteActivity(pool, ACCOUNT_ID, SORRENT_ID);

    expect(await findTransfer(pool, ACCOUNT_ID, angelegt!.id)).toBeNull();
  });
});
