// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { AiClient } from "@/lib/ai/client";
import type { Planvorschlag } from "@/lib/plan/ki-planung";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { PoiType } from "@/lib/pois/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
// Externe Dienste werden in Tests gemockt (siehe stack.md, Testing) -- kein
// Test darf im Netz haengen oder Kosten verursachen. OSRM antwortet ueber
// den gestubbten fetch.
const aussen = vi.hoisted(() => ({ createOpenAiClient: vi.fn() }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));
vi.mock("@/lib/ai/openai-client", () => ({
  createOpenAiClient: aussen.createOpenAiClient,
}));

const { createSession } = await import("@/lib/db/sessions");
const { createTrip } = await import("@/lib/db/trips");
const { createPoi } = await import("@/lib/db/pois");
const { listActivities } = await import("@/lib/db/activities");
const { listTransfers } = await import("@/lib/db/transfers");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { POST, PUT } = await import("./route");

const NOW = new Date("2026-09-03T10:00:00Z");

/** Eine eigene Reise mit drei Reisetagen -- unabhaengig von den Demodaten. */
const REISE = {
  title: "Planungstest",
  startDate: "2026-07-18",
  endDate: "2026-07-20",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  tempo: "ausgewogen" as const,
  praeferenzen: LEERE_PRAEFERENZEN,
};

function anfrage(body: unknown, method: "POST" | "PUT" = "POST") {
  return new Request("https://dev.wegfara.com/api/ki-planung", {
    method,
    body: JSON.stringify(body),
  });
}

async function angemeldet(token = "token-1") {
  await createSession(testDb.pool, PARTICIPANT_ID, token, NOW);
  cookieJar.werte[SESSION_COOKIE] = token;
}

async function mitSchluessel() {
  await storeAccountApiKey(
    testDb.pool,
    ACCOUNT_ID,
    "ki_suche",
    "sk-test-a3f9",
    NOW,
  );
}

/** Die KI verteilt die POIs so, wie die Antwort es sagt. */
function kiAntwortet(antwort: string | null) {
  const complete = vi.fn(async () =>
    antwort === null
      ? { ok: false as const, fehler: { art: "netz", detail: "network down" } }
      : { ok: true as const, text: antwort },
  );
  aussen.createOpenAiClient.mockImplementation(
    () => ({ complete }) as unknown as AiClient,
  );
  return complete;
}

/** OSRM antwortet aus dem Haus (siehe app/api/transfers/vorschlag). */
function osrm(strecke: { km: number; minuten: number } | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (!strecke) throw new Error("network down");
      return new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            { duration: strecke.minuten * 60, distance: strecke.km * 1000 },
          ],
        }),
        { status: 200 },
      );
    }),
  );
}

async function reiseMitPois(
  pois: { name: string; type?: PoiType; lat: number; lng: number }[],
) {
  const trip = await createTrip(testDb.pool, ACCOUNT_ID, REISE);
  const angelegt = [];
  for (const eintrag of pois) {
    angelegt.push(
      await createPoi(testDb.pool, ACCOUNT_ID, trip.id, {
        name: eintrag.name,
        ort: "Amalfi",
        type: eintrag.type ?? "sehenswuerdigkeit",
        position: { lat: eintrag.lat, lng: eintrag.lng },
        status: "gesetzt",
        web: null,
        shortText: null,
        longText: null,
        address: null,
        phone: null,
        openingHours: null,
        durationMinutes: null,
        kostenCent: null,
      }),
    );
  }
  return { trip, pois: angelegt };
}

/** Die Programmpunkte genau dieser Reise -- die Demodaten bleiben aussen vor. */
async function activitiesDerReise(tripId: string) {
  return (await listActivities(testDb.pool, ACCOUNT_ID)).filter(
    (activity) => activity.tripId === tripId,
  );
}

async function vorschlagAus(response: Response) {
  return (await response.json()) as {
    vorschlag: Planvorschlag | null;
    grund?: string;
  };
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  aussen.createOpenAiClient.mockReset();
  vi.unstubAllGlobals();
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
});

describe("POST /api/ki-planung (req-056)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await POST(anfrage({ tripId: "egal" }))).status).toBe(401);
  });

  it("plant ohne hinterlegten Zugangsschluessel gar nicht erst", async () => {
    await angemeldet();
    const { trip } = await reiseMitPois([
      { name: "Ort 1", lat: 40.64, lng: 14.6 },
    ]);
    const complete = kiAntwortet('{"tage": [[1]]}');

    const response = await POST(anfrage({ tripId: trip.id }));

    expect(response.status).toBe(409);
    expect(complete).not.toHaveBeenCalled();
  });

  it("kennt keine Reise eines fremden Accounts", async () => {
    await angemeldet();
    await mitSchluessel();

    const response = await POST(
      anfrage({ tripId: "11111111-1111-4111-8111-111111111111" }),
    );

    expect(response.status).toBe(404);
  });

  it("nennt den Grund, wenn es nichts zu verplanen gibt", async () => {
    await angemeldet();
    await mitSchluessel();
    const trip = await createTrip(testDb.pool, ACCOUNT_ID, REISE);
    const complete = kiAntwortet('{"tage": [[1]]}');

    const antwort = await vorschlagAus(
      await POST(anfrage({ tripId: trip.id })),
    );

    expect(antwort.vorschlag).toBeNull();
    expect(antwort.grund).toBe("nichts_zu_verplanen");
    // Ohne etwas zu verplanen wird die KI nicht gefragt -- der Lauf kostet Geld.
    expect(complete).not.toHaveBeenCalled();
  });

  it("liefert einen Vorschlag, ohne etwas zu speichern", async () => {
    await angemeldet();
    await mitSchluessel();
    osrm({ km: 3, minuten: 8 });
    const { trip } = await reiseMitPois([
      { name: "Ort 1", lat: 40.64, lng: 14.6 },
      { name: "Ort 2", lat: 40.65, lng: 14.61 },
    ]);
    kiAntwortet('{"tage": [[1, 2]]}');

    const antwort = await vorschlagAus(
      await POST(anfrage({ tripId: trip.id })),
    );

    expect(antwort.vorschlag?.punkte).toHaveLength(2);
    expect(antwort.vorschlag?.punkte[0].startAt).toBe("2026-07-18T08:00");
    // Nichts davon steht in der Ablage (req-056).
    expect(await activitiesDerReise(trip.id)).toHaveLength(0);
  });

  it("meldet einen Fehlschlag, wenn die KI nicht antwortet", async () => {
    await angemeldet();
    await mitSchluessel();
    osrm({ km: 3, minuten: 8 });
    const { trip } = await reiseMitPois([
      { name: "Ort 1", lat: 40.64, lng: 14.6 },
    ]);
    kiAntwortet(null);

    expect((await POST(anfrage({ tripId: trip.id }))).status).toBe(502);
  });
});

describe("PUT /api/ki-planung (req-056)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect(
      (await PUT(anfrage({ tripId: "egal", punkte: [] }, "PUT"))).status,
    ).toBe(401);
  });

  /** Erst planen, dann uebernehmen -- so wie es die Oberflaeche tut. */
  async function planenUndUebernehmen() {
    await angemeldet();
    await mitSchluessel();
    osrm({ km: 3, minuten: 8 });
    const { trip } = await reiseMitPois([
      { name: "Ort 1", lat: 40.64, lng: 14.6 },
      { name: "Mittagsrast", type: "restaurant", lat: 40.65, lng: 14.61 },
    ]);
    kiAntwortet('{"tage": [[1, 2]]}');

    const { vorschlag } = await vorschlagAus(
      await POST(anfrage({ tripId: trip.id })),
    );
    const response = await PUT(
      anfrage({ tripId: trip.id, punkte: vorschlag!.punkte }, "PUT"),
    );
    return {
      trip,
      vorschlag: vorschlag!,
      ergebnis: (await response.json()) as {
        activities: Activity[];
        transfers: Transfer[];
      },
    };
  }

  it("legt die Programmpunkte des Vorschlags an", async () => {
    const { trip, ergebnis } = await planenUndUebernehmen();

    expect(ergebnis.activities).toHaveLength(2);
    const gespeichert = await activitiesDerReise(trip.id);
    expect(gespeichert.map((activity) => activity.title)).toEqual([
      "Ort 1",
      "Mittagsrast",
    ]);
  });

  it("legt zwischen den Programmpunkten eines Tages Transfers an", async () => {
    const { trip, ergebnis } = await planenUndUebernehmen();

    expect(ergebnis.transfers).toHaveLength(1);
    const gespeichert = (await listTransfers(testDb.pool, ACCOUNT_ID)).filter(
      (transfer) => transfer.tripId === trip.id,
    );
    expect(gespeichert[0].title).toBe("Nach Mittagsrast");
    expect(gespeichert[0].mode).toBe("auto");
  });

  it("legt fuer einen unveraenderten Programmpunkt nichts an", async () => {
    await angemeldet();
    const { trip, pois } = await reiseMitPois([
      { name: "Ort 1", lat: 40.64, lng: 14.6 },
    ]);

    const response = await PUT(
      anfrage(
        {
          tripId: trip.id,
          punkte: [
            {
              activityId: null,
              poiId: pois[0]!.id,
              startAt: "2026-07-18T08:00",
              unveraendert: true,
            },
          ],
        },
        "PUT",
      ),
    );

    expect((await response.json()).activities).toHaveLength(0);
    expect(await activitiesDerReise(trip.id)).toHaveLength(0);
  });

  it("uebergeht einen POI, der zu einer anderen Reise gehoert", async () => {
    await angemeldet();
    const { trip } = await reiseMitPois([
      { name: "Ort 1", lat: 40.64, lng: 14.6 },
    ]);
    const andere = await reiseMitPois([
      { name: "Fremder Ort", lat: 40.64, lng: 14.6 },
    ]);

    const response = await PUT(
      anfrage(
        {
          tripId: trip.id,
          punkte: [
            {
              activityId: null,
              poiId: andere.pois[0]!.id,
              startAt: "2026-07-18T08:00",
              unveraendert: false,
            },
          ],
        },
        "PUT",
      ),
    );

    expect((await response.json()).activities).toHaveLength(0);
  });
});
