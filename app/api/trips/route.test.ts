// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { TRIP_DESCRIPTION_MAX_LENGTH } from "@/lib/trips/validate";

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
const { listTrips } = await import("@/lib/db/trips");
const { listTripParticipants } = await import("@/lib/db/trip-participants");
const { DELETE, PATCH, POST, PUT } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const TOSKANA = {
  title: "Toskana 2027",
  startDate: "2027-05-12",
  endDate: "2027-05-19",
  mainPlace: { name: "Florenz", lat: 43.7696, lng: 11.2558 },
};

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/trips", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("POST /api/trips (req-017)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(anfrage(TOSKANA))).status).toBe(401);
  });

  it("legt die Reise an und liefert sie zurueck", async () => {
    await angemeldet();

    const response = await POST(anfrage(TOSKANA));

    expect(response.status).toBe(201);
    const { trip } = (await response.json()) as { trip: Trip };
    expect(trip).toMatchObject(TOSKANA);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(4);
  });

  it("ordnet den Anlegenden der neuen Reise als Reiseleiter zu (req-021)", async () => {
    await angemeldet();

    const response = await POST(anfrage(TOSKANA));

    const { trip, tripParticipant } = (await response.json()) as {
      trip: Trip;
      tripParticipant: TripParticipant;
    };
    expect(tripParticipant).toEqual({
      tripId: trip.id,
      participantId: PARTICIPANT_ID,
      role: "reiseleiter",
    });
    const assignments = await listTripParticipants(testDb.pool, ACCOUNT_ID);
    expect(assignments).toContainEqual({
      tripId: trip.id,
      participantId: PARTICIPANT_ID,
      role: "reiseleiter",
    });
  });

  it('legt die Reise mit dem Zustand "In Planung" an (req-022)', async () => {
    await angemeldet();

    const response = await POST(anfrage(TOSKANA));

    const { trip } = (await response.json()) as { trip: Trip };
    expect(trip.state).toBe("in_planung");
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === trip.id)?.state).toBe("in_planung");
  });

  it("legt ohne Titel nichts an und benennt die Stelle", async () => {
    await angemeldet();

    const response = await POST(anfrage({ ...TOSKANA, title: "  " }));

    expect(response.status).toBe(400);
    const { errors } = (await response.json()) as {
      errors: Record<string, string>;
    };
    expect(errors.title).toBeDefined();
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });

  it("legt bei einem Ende vor dem Beginn nichts an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...TOSKANA, startDate: "2027-05-12", endDate: "2027-05-05" }),
    );

    expect(response.status).toBe(400);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });

  it("legt ohne Hauptort nichts an", async () => {
    await angemeldet();

    const response = await POST(anfrage({ ...TOSKANA, mainPlace: null }));

    expect(response.status).toBe(400);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });

  it("weist von Hand mitgeschickte, unbrauchbare Koordinaten ab", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...TOSKANA, mainPlace: { name: "Florenz", lat: "43,77" } }),
    );

    expect(response.status).toBe(400);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });
});

describe("PUT /api/trips (req-017)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect(
      (await PUT(anfrage({ id: SUEDITALIEN_ID, ...TOSKANA }))).status,
    ).toBe(401);
  });

  it("korrigiert den Titel der Reise", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        id: SUEDITALIEN_ID,
        ...TOSKANA,
        title: "Toskana Frühling 2027",
      }),
    );

    expect(response.status).toBe(200);
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)?.title).toBe(
      "Toskana Frühling 2027",
    );
  });

  it("speichert unzulaessige Eingaben nicht", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({ id: SUEDITALIEN_ID, ...TOSKANA, title: "" }),
    );

    expect(response.status).toBe(400);
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)?.title).toBe(
      "Süditalien Rundreise",
    );
  });

  it("kennt keine Reise eines anderen Accounts", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({ id: "3b8f2c1e-0000-4000-8000-000000000000", ...TOSKANA }),
    );

    expect(response.status).toBe(404);
  });
});

/**
 * Die Beschreibung (req-033) ist freiwillig und hoechstens 2000 Zeichen
 * lang. Geprueft wird an der Schnittstelle mit derselben Regel wie im
 * Formular -- ein Aufruf daran vorbei kann keine zu lange speichern.
 */
describe("Beschreibung einer Reise (req-033)", () => {
  it("legt die Reise mit ihrer Beschreibung an", async () => {
    await angemeldet();

    const response = await POST(
      anfrage({ ...TOSKANA, description: "Wanderschuhe mitnehmen." }),
    );

    const { trip } = (await response.json()) as { trip: Trip };
    expect(trip.description).toBe("Wanderschuhe mitnehmen.");
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === trip.id)?.description).toBe(
      "Wanderschuhe mitnehmen.",
    );
  });

  it("legt ohne Beschreibung eine Reise mit leerem Text an", async () => {
    await angemeldet();

    const response = await POST(anfrage(TOSKANA));

    const { trip } = (await response.json()) as { trip: Trip };
    expect(trip.description).toBe("");
  });

  it("speichert eine nachgetragene Beschreibung", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        id: SUEDITALIEN_ID,
        ...TOSKANA,
        description: "Wanderschuhe mitnehmen.",
      }),
    );

    expect(response.status).toBe(200);
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)?.description).toBe(
      "Wanderschuhe mitnehmen.",
    );
  });

  it("speichert eine zu lange Beschreibung nicht", async () => {
    await angemeldet();

    const response = await PUT(
      anfrage({
        id: SUEDITALIEN_ID,
        ...TOSKANA,
        description: "x".repeat(TRIP_DESCRIPTION_MAX_LENGTH + 1),
      }),
    );

    expect(response.status).toBe(400);
    const { errors } = (await response.json()) as {
      errors: Record<string, string>;
    };
    expect(errors.description).toBeDefined();
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)?.description).toBe("");
  });
});

describe("DELETE /api/trips (req-017)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await DELETE(anfrage({ id: SUEDITALIEN_ID }))).status).toBe(401);
  });

  it("entfernt die Reise samt aller daran haengenden Daten", async () => {
    await angemeldet();

    const response = await DELETE(anfrage({ id: SUEDITALIEN_ID }));

    expect(response.status).toBe(200);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(2);
    const { rows } = await testDb.pool.query(
      "select id from poi where trip_id = $1",
      [SUEDITALIEN_ID],
    );
    expect(rows).toHaveLength(0);
  });

  it("kennt keine Reise eines anderen Accounts", async () => {
    await angemeldet();

    const response = await DELETE(
      anfrage({ id: "3b8f2c1e-0000-4000-8000-000000000000" }),
    );

    expect(response.status).toBe(404);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toHaveLength(3);
  });
});

describe("PATCH /api/trips (req-022)", () => {
  async function stateOf(tripId: string): Promise<string | undefined> {
    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    return trips.find((t) => t.id === tripId)?.state;
  }

  it("verlangt eine Anmeldung", async () => {
    expect(
      (await PATCH(anfrage({ id: SUEDITALIEN_ID, state: "freigegeben" })))
        .status,
    ).toBe(401);
    expect(await stateOf(SUEDITALIEN_ID)).toBe("in_planung");
  });

  it("gibt die Reise frei und liefert sie mit ihrem Zustand zurueck", async () => {
    await angemeldet();

    const response = await PATCH(
      anfrage({ id: SUEDITALIEN_ID, state: "freigegeben" }),
    );

    expect(response.status).toBe(200);
    const { trip } = (await response.json()) as { trip: Trip };
    expect(trip.state).toBe("freigegeben");
    expect(await stateOf(SUEDITALIEN_ID)).toBe("freigegeben");
  });

  it("nimmt die Freigabe wieder zurueck", async () => {
    await angemeldet();
    await PATCH(anfrage({ id: SUEDITALIEN_ID, state: "freigegeben" }));

    await PATCH(anfrage({ id: SUEDITALIEN_ID, state: "in_planung" }));

    expect(await stateOf(SUEDITALIEN_ID)).toBe("in_planung");
  });

  it("oeffnet eine abgeschlossene Reise wieder", async () => {
    await angemeldet();
    await PATCH(anfrage({ id: SUEDITALIEN_ID, state: "abgeschlossen" }));

    await PATCH(anfrage({ id: SUEDITALIEN_ID, state: "freigegeben" }));

    expect(await stateOf(SUEDITALIEN_ID)).toBe("freigegeben");
  });

  it("laesst Titel und Zeitraum unangetastet", async () => {
    await angemeldet();

    await PATCH(anfrage({ id: SUEDITALIEN_ID, state: "abgeschlossen" }));

    const trips = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(trips.find((t) => t.id === SUEDITALIEN_ID)).toMatchObject({
      title: "Süditalien Rundreise",
      startDate: "2026-07-18",
      endDate: "2026-07-23",
    });
  });

  it("weist einen erfundenen Zustand ab", async () => {
    await angemeldet();

    const response = await PATCH(
      anfrage({ id: SUEDITALIEN_ID, state: "archiviert" }),
    );

    expect(response.status).toBe(400);
    expect(await stateOf(SUEDITALIEN_ID)).toBe("in_planung");
  });

  it("weist den berechneten Zeitstatus als Zustand ab", async () => {
    await angemeldet();

    const response = await PATCH(
      anfrage({ id: SUEDITALIEN_ID, state: "aktiv" }),
    );

    expect(response.status).toBe(400);
    expect(await stateOf(SUEDITALIEN_ID)).toBe("in_planung");
  });

  it("weist eine Anfrage ohne Reise ab", async () => {
    await angemeldet();

    expect((await PATCH(anfrage({ state: "freigegeben" }))).status).toBe(400);
  });

  it("kennt keine Reise eines anderen Accounts", async () => {
    await angemeldet();

    const response = await PATCH(
      anfrage({
        id: "3b8f2c1e-0000-4000-8000-000000000000",
        state: "freigegeben",
      }),
    );

    expect(response.status).toBe(404);
  });
});
