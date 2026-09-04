// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Poi } from "@/lib/pois/types";

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
const { listPois } = await import("@/lib/db/pois");
const { replacePoiPhotos } = await import("@/lib/db/poi-photos");
const { DELETE, POST, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

let bildablage: string;

function anfrage(method: "POST" | "PUT" | "DELETE", body: unknown): Request {
  return new Request("https://dev.wegfara.com/api/pois", {
    method,
    body: JSON.stringify(body),
  });
}

/** Die Angaben, die das Formular beim Anlegen schickt (req-035). */
function bucht(overrides: Record<string, unknown> = {}) {
  return {
    tripId: SUEDITALIEN_ID,
    name: "Bucht bei Praiano",
    ort: "Praiano",
    type: "strand",
    position: { lat: 40.6117, lng: 14.5289 },
    status: "weiss_nicht",
    address: "",
    web: "",
    phone: "",
    openingHours: "",
    ...overrides,
  };
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

async function villaRufolo(): Promise<Poi> {
  const pois = await listPois(testDb.pool, ACCOUNT_ID);
  return pois.find((poi) => poi.name === "Villa Rufolo")!;
}

/** Ein zweiter Account mit eigener Reise und eigenem POI. */
async function fremd(): Promise<{ tripId: string; poiId: string }> {
  const accountId = randomUUID();
  const tripId = randomUUID();
  const poiId = randomUUID();
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
    `insert into poi (id, trip_id, number, name, ort, type, lat, lng, status)
     values ($1, $2, 1, 'Fremder POI', 'Berlin', 'sehenswuerdigkeit', 52.52, 13.405, 'weiss_nicht')`,
    [poiId, tripId],
  );
  return { tripId, poiId };
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  bildablage = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.IMAGE_DIR = bildablage;
});

afterEach(async () => {
  await rm(bildablage, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

describe("POST /api/pois (req-035)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(anfrage("POST", bucht()))).status).toBe(401);
  });

  it("legt den POI mit Status 'Weiß noch nicht' an", async () => {
    await angemeldet();

    const response = await POST(anfrage("POST", bucht()));

    expect(response.status).toBe(201);
    const { poi } = (await response.json()) as { poi: Poi };
    expect(poi).toMatchObject({
      name: "Bucht bei Praiano",
      ort: "Praiano",
      type: "strand",
      status: "weiss_nicht",
    });
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    expect(pois.some((p) => p.name === "Bucht bei Praiano")).toBe(true);
  });

  it("legt ohne Namen keinen POI an", async () => {
    await angemeldet();

    const response = await POST(anfrage("POST", bucht({ name: "  " })));

    expect(response.status).toBe(400);
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    expect(pois.some((p) => p.ort === "Praiano")).toBe(false);
  });

  it("legt ohne Position keinen POI an", async () => {
    await angemeldet();

    const response = await POST(anfrage("POST", bucht({ position: null })));

    expect(response.status).toBe(400);
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    expect(pois.some((p) => p.name === "Bucht bei Praiano")).toBe(false);
  });

  it("legt keinen POI in einer Reise eines anderen Accounts an (req-024)", async () => {
    await angemeldet();
    const fremder = await fremd();

    const response = await POST(
      anfrage("POST", bucht({ tripId: fremder.tripId })),
    );

    expect(response.status).toBe(404);
    const { rows } = await testDb.pool.query(
      `select id from poi where trip_id = $1`,
      [fremder.tripId],
    );
    expect(rows).toHaveLength(1);
  });
});

describe("PUT /api/pois (req-035)", () => {
  it("verlangt eine Anmeldung", async () => {
    const villa = await villaRufolo();

    expect(
      (await PUT(anfrage("PUT", { id: villa.id, ...bucht() }))).status,
    ).toBe(401);
  });

  it("aendert den Namen eines POI", async () => {
    await angemeldet();
    const villa = await villaRufolo();

    const response = await PUT(
      anfrage("PUT", {
        id: villa.id,
        name: "Villa Rufolo (Garten)",
        ort: villa.ort,
        type: villa.type,
        position: villa.position,
        status: villa.status,
      }),
    );

    expect(response.status).toBe(200);
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    expect(pois.find((p) => p.id === villa.id)?.name).toBe(
      "Villa Rufolo (Garten)",
    );
  });

  it("laesst eine mitgeschickte Nummer unbeachtet (req-013)", async () => {
    await angemeldet();
    const villa = await villaRufolo();

    const response = await PUT(
      anfrage("PUT", {
        id: villa.id,
        number: 999,
        name: villa.name,
        ort: villa.ort,
        type: villa.type,
        position: villa.position,
        status: villa.status,
      }),
    );

    const { poi } = (await response.json()) as { poi: Poi };
    expect(poi.number).toBe(villa.number);
  });

  it("aendert keinen POI eines anderen Accounts (req-024)", async () => {
    await angemeldet();
    const fremder = await fremd();

    const response = await PUT(
      anfrage("PUT", {
        id: fremder.poiId,
        name: "Gekapert",
        ort: "Berlin",
        type: "sehenswuerdigkeit",
        position: { lat: 52.52, lng: 13.405 },
        status: "gesetzt",
      }),
    );

    expect(response.status).toBe(404);
    const { rows } = await testDb.pool.query(
      `select name from poi where id = $1`,
      [fremder.poiId],
    );
    expect((rows[0] as { name: string }).name).toBe("Fremder POI");
  });
});

describe("DELETE /api/pois (req-035)", () => {
  it("verlangt eine Anmeldung", async () => {
    const villa = await villaRufolo();

    expect((await DELETE(anfrage("DELETE", { id: villa.id }))).status).toBe(
      401,
    );
  });

  it("entfernt den POI samt seinen Bildern aus dem Bildverzeichnis", async () => {
    await angemeldet();
    const villa = await villaRufolo();
    await replacePoiPhotos(testDb.pool, villa.id, ["bild.jpg"], new Date());
    await writeFile(path.join(bildablage, "bild.jpg"), "x");

    const response = await DELETE(anfrage("DELETE", { id: villa.id }));

    expect(response.status).toBe(200);
    const pois = await listPois(testDb.pool, ACCOUNT_ID);
    expect(pois.some((p) => p.id === villa.id)).toBe(false);
    expect(await readdir(bildablage)).toEqual([]);
  });

  it("laesst einen zugeordneten Programmpunkt bestehen", async () => {
    await angemeldet();
    const villa = await villaRufolo();
    const { rows: vorher } = await testDb.pool.query(
      `select id from activity where poi_id = $1`,
      [villa.id],
    );
    const activityId = (vorher[0] as { id: string }).id;

    await DELETE(anfrage("DELETE", { id: villa.id }));

    const { rows } = await testDb.pool.query(
      `select poi_id from activity where id = $1`,
      [activityId],
    );
    expect(rows).toHaveLength(1);
    expect((rows[0] as { poi_id: string | null }).poi_id).toBeNull();
  });

  it("entfernt keinen POI eines anderen Accounts (req-024)", async () => {
    await angemeldet();
    const fremder = await fremd();

    const response = await DELETE(anfrage("DELETE", { id: fremder.poiId }));

    expect(response.status).toBe(404);
    const { rows } = await testDb.pool.query(
      `select id from poi where id = $1`,
      [fremder.poiId],
    );
    expect(rows).toHaveLength(1);
  });
});
