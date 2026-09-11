// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { createSession } = await import("@/lib/db/sessions");
const { listActivities } = await import("@/lib/db/activities");
const { listPois } = await import("@/lib/db/pois");
const { listKostenzeilen } = await import("@/lib/db/kostenzeilen");
const { DELETE, POST, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/kostenzeilen", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** Ein Programmpunkt der Demoreise, der aus einem POI entstanden ist. */
async function mitPoi() {
  const activities = await listActivities(testDb.pool, ACCOUNT_ID);
  return activities.find(
    (activity) => activity.tripId === SUEDITALIEN_ID && activity.poiId,
  )!;
}

/** Ein Programmpunkt ohne POI -- der Ausgangspunkt der Anreise (req-018). */
async function ohnePoi() {
  const activities = await listActivities(testDb.pool, ACCOUNT_ID);
  return activities.find(
    (activity) => activity.tripId === SUEDITALIEN_ID && !activity.poiId,
  )!;
}

async function poiVon(poiId: string) {
  const pois = await listPois(testDb.pool, ACCOUNT_ID);
  return pois.find((poi) => poi.id === poiId)!;
}

/** Ein zweiter Account mit eigener Reise und eigenem Programmpunkt. */
async function fremderProgrammpunkt(): Promise<string> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const activityId = randomUUID();
  await testDb.pool.query(
    "insert into account (id, name, email) values ($1, $2, $3)",
    [accountId, "Andere Person", "andere@example.com"],
  );
  await testDb.pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [tripId, accountId],
  );
  await testDb.pool.query(
    `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
     values ($1, $2, 'sehenswuerdigkeit', 'Fremder Punkt', '', '', '2027-01-01 10:00', '2027-01-01 11:00', 52.52, 13.405)`,
    [activityId, tripId],
  );
  return activityId;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("PUT /api/kostenzeilen (req-062)", () => {
  it("verlangt eine Anmeldung", async () => {
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, preis: "15,00" }),
    );

    expect(response.status).toBe(401);
  });

  it("schreibt den Preis einer Zeile mit POI an den POI zurück (req-061)", async () => {
    await angemeldet();
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, preis: "15,00" }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { poi: { kostenCent: number } };
    expect(payload.poi.kostenCent).toBe(1500);
    expect((await poiVon(activity.poiId!)).kostenCent).toBe(1500);
  });

  it("schreibt den Buchungsstatus an den POI zurück (req-061)", async () => {
    await angemeldet();
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, buchung: "gebucht" }),
    );

    expect(response.status).toBe(200);
    expect((await poiVon(activity.poiId!)).buchung).toBe("gebucht");
  });

  /**
   * Die Tabelle haelt keine zweite Kopie von Preis und Buchungsstatz
   * (req-062, Constraints) -- zu einer Zeile mit POI entsteht deshalb gar
   * kein Datensatz.
   */
  it("legt zu einer Zeile mit POI keine gespeicherte Zeile an", async () => {
    await angemeldet();
    const activity = await mitPoi();

    await PUT(anfrage({ activityId: activity.id, preis: "15,00" }));

    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("speichert den Preis eines Programmpunkts ohne POI an seiner Zeile", async () => {
    await angemeldet();
    const activity = await ohnePoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, preis: "30,00" }),
    );

    expect(response.status).toBe(200);
    const zeilen = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toMatchObject({
      activityId: activity.id,
      preisCent: 3000,
    });
  });

  it("legt je Programmpunkt höchstens eine Zeile an", async () => {
    await angemeldet();
    const activity = await ohnePoi();

    await PUT(anfrage({ activityId: activity.id, preis: "30,00" }));
    await PUT(anfrage({ activityId: activity.id, preis: "40,00" }));

    const zeilen = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].preisCent).toBe(4000);
  });

  it("nimmt einen leeren Preis als „nicht eingetragen“", async () => {
    await angemeldet();
    const activity = await mitPoi();
    await PUT(anfrage({ activityId: activity.id, preis: "12,50" }));

    await PUT(anfrage({ activityId: activity.id, preis: "" }));

    expect((await poiVon(activity.poiId!)).kostenCent).toBeUndefined();
  });

  it("weist einen Buchstaben als Preis ab und schreibt nichts", async () => {
    await angemeldet();
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, preis: "abc" }),
    );

    expect(response.status).toBe(400);
    expect((await poiVon(activity.poiId!)).kostenCent).toBeUndefined();
  });

  it("weist einen unbekannten Buchungsstatus ab", async () => {
    await angemeldet();
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, buchung: "vielleicht" }),
    );

    expect(response.status).toBe(400);
  });

  it("ändert nichts an einem Programmpunkt eines anderen Accounts", async () => {
    await angemeldet();
    const activityId = await fremderProgrammpunkt();

    const response = await PUT(anfrage({ activityId, preis: "15,00" }));

    expect(response.status).toBe(404);
    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("verlangt, dass die Zeile überhaupt genannt wird", async () => {
    await angemeldet();

    const response = await PUT(anfrage({ preis: "15,00" }));

    expect(response.status).toBe(400);
  });
});

/**
 * Die Anzahl gehoert immer an die Zeile: sie sagt, wie oft dieser
 * Programmpunkt zaehlt, und beschreibt nicht den Ort. Null heisst, dass sie
 * mit der Teilnehmerzahl nachzieht (req-062).
 */
describe("PUT /api/kostenzeilen -- Anzahl (req-062)", () => {
  it("speichert die von Hand gesetzte Anzahl an der Zeile", async () => {
    await angemeldet();
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, anzahl: "1" }),
    );

    expect(response.status).toBe(200);
    const zeilen = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toMatchObject({ activityId: activity.id, anzahl: 1 });
  });

  it("laesst den POI dabei unangetastet", async () => {
    await angemeldet();
    const activity = await mitPoi();

    await PUT(anfrage({ activityId: activity.id, anzahl: "1" }));

    expect((await poiVon(activity.poiId!)).kostenCent).toBeUndefined();
  });

  it("nimmt eine leere Anzahl als „zieht wieder nach“", async () => {
    await angemeldet();
    const activity = await mitPoi();
    await PUT(anfrage({ activityId: activity.id, anzahl: "1" }));

    await PUT(anfrage({ activityId: activity.id, anzahl: "" }));

    const zeilen = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(zeilen[0].anzahl).toBeNull();
  });

  it("weist eine Anzahl ab, die keine ganze Zahl ist", async () => {
    await angemeldet();
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, anzahl: "zwei" }),
    );

    expect(response.status).toBe(400);
    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });
});

/**
 * Manuelle Zeilen fuer alles ohne Programmpunkt -- Maut, Parkgebuehren,
 * Sprit (req-062). Sie lassen sich anlegen, aendern und loeschen; eine Zeile
 * aus dem Plan laesst sich nicht loeschen.
 */
describe("Manuelle Kostenzeilen (req-062)", () => {
  function neueZeile(overrides: Record<string, unknown> = {}) {
    return {
      tripId: SUEDITALIEN_ID,
      bezeichnung: "Maut",
      preis: "30,00",
      anzahl: "1",
      buchung: "nicht_noetig",
      ...overrides,
    };
  }

  function post(body: unknown) {
    return new Request("https://dev.wegfara.com/api/kostenzeilen", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function del(body: unknown) {
    return new Request("https://dev.wegfara.com/api/kostenzeilen", {
      method: "DELETE",
      body: JSON.stringify(body),
    });
  }

  it("verlangt eine Anmeldung zum Anlegen", async () => {
    const response = await POST(post(neueZeile()));

    expect(response.status).toBe(401);
    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("legt die Zeile an", async () => {
    await angemeldet();

    const response = await POST(post(neueZeile()));

    expect(response.status).toBe(200);
    const zeilen = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]).toMatchObject({
      tripId: SUEDITALIEN_ID,
      activityId: null,
      bezeichnung: "Maut",
      preisCent: 3000,
      anzahl: 1,
    });
  });

  it("verlangt eine Bezeichnung", async () => {
    await angemeldet();

    const response = await POST(post(neueZeile({ bezeichnung: "  " })));

    expect(response.status).toBe(400);
    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("legt nichts in einer Reise eines anderen Accounts an", async () => {
    await angemeldet();
    const { rows } = await testDb.pool.query(
      `select id from trip where account_id <> $1 limit 1`,
      [ACCOUNT_ID],
    );
    const fremdeReise = (rows[0] as { id: string } | undefined)?.id;
    await POST(post(neueZeile({ tripId: fremdeReise ?? randomUUID() })));

    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("entfernt eine manuelle Zeile wieder", async () => {
    await angemeldet();
    await POST(post(neueZeile()));
    const [zeile] = await listKostenzeilen(testDb.pool, ACCOUNT_ID);

    const response = await DELETE(del({ id: zeile.id }));

    expect(response.status).toBe(200);
    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("entfernt keine Zeile, die aus einem Programmpunkt stammt", async () => {
    await angemeldet();
    const activity = await ohnePoi();
    await PUT(anfrage({ activityId: activity.id, preis: "30,00" }));
    const [zeile] = await listKostenzeilen(testDb.pool, ACCOUNT_ID);

    const response = await DELETE(del({ id: zeile.id }));

    expect(response.status).toBe(404);
    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toHaveLength(1);
  });

  it("aendert die Bezeichnung einer manuellen Zeile", async () => {
    await angemeldet();
    await POST(post(neueZeile()));
    const [zeile] = await listKostenzeilen(testDb.pool, ACCOUNT_ID);

    const response = await PUT(
      anfrage({ id: zeile.id, bezeichnung: "Parkgebühren" }),
    );

    expect(response.status).toBe(200);
    const [geaendert] = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(geaendert.bezeichnung).toBe("Parkgebühren");
  });

  /** Die Bezeichnung einer Zeile aus dem Plan kommt vom POI (req-062). */
  it("setzt keine Bezeichnung an einer Zeile aus dem Plan", async () => {
    await angemeldet();
    const activity = await mitPoi();

    const response = await PUT(
      anfrage({ activityId: activity.id, bezeichnung: "Etwas anderes" }),
    );

    expect(response.status).toBe(400);
  });
});

/**
 * Verknuepfbar sind nur Dokumente derselben Reise (req-062, Constraints) --
 * wie bei req-034.
 */
describe("PUT /api/kostenzeilen -- Dokument (req-062)", () => {
  const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

  async function dokument(tripId: string): Promise<string> {
    const id = randomUUID();
    await testDb.pool.query(
      `insert into document (id, trip_id, name, file_name, content_type,
                             size_bytes, page_count, poi_id, transfer_id,
                             uploaded_by, created_at)
       values ($1, $2, 'Eintrittskarte.pdf', $3, 'application/pdf', 1234, 1,
               null, null, null, $4)`,
      [id, tripId, `${randomUUID()}.pdf`, new Date()],
    );
    return id;
  }

  it("verknuepft ein Dokument derselben Reise", async () => {
    await angemeldet();
    const activity = await mitPoi();
    const dokumentId = await dokument(SUEDITALIEN_ID);

    const response = await PUT(
      anfrage({ activityId: activity.id, dokumentId }),
    );

    expect(response.status).toBe(200);
    const [zeile] = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(zeile.dokumentId).toBe(dokumentId);
  });

  it("weist ein Dokument einer anderen Reise ab", async () => {
    await angemeldet();
    const activity = await mitPoi();
    const dokumentId = await dokument(WIEN_ID);

    const response = await PUT(
      anfrage({ activityId: activity.id, dokumentId }),
    );

    expect(response.status).toBe(409);
    expect(await listKostenzeilen(testDb.pool, ACCOUNT_ID)).toEqual([]);
  });

  it("loest die Verknuepfung wieder", async () => {
    await angemeldet();
    const activity = await mitPoi();
    const dokumentId = await dokument(SUEDITALIEN_ID);
    await PUT(anfrage({ activityId: activity.id, dokumentId }));

    await PUT(anfrage({ activityId: activity.id, dokumentId: "" }));

    const [zeile] = await listKostenzeilen(testDb.pool, ACCOUNT_ID);
    expect(zeile.dokumentId).toBeNull();
  });
});
