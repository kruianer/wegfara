// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { ActivityPosition } from "@/lib/activities/types";

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
const { GET } = await import("./route");

/** Transfers der Sueditalien-Rundreise (siehe migrations/0009). */
const MIT_AUTO = "4879b2a4-d673-4d70-97c2-f5d0cb505f04";
const MIT_BOOT = "f7c977e1-ad68-4ed0-8a1b-83f421bd3c8b";
/** Eine Kennung, zu der es in diesem Account keinen Transfer gibt. */
const FREMDER = "e5f4a2a5-3f4c-4b0e-8a2e-2f2ec3a7d0aa";

function anfrage(...ids: string[]) {
  return new Request(
    `https://dev.wegfara.com/api/transfers/verlauf?ids=${ids.join(",")}`,
  );
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/** OSRM antwortet aus dem Haus -- kein Netz im Test (siehe stack.md). */
function osrm(erreichbar = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (!erreichbar) throw new Error("network down");
      return new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              duration: 720,
              distance: 4200,
              geometry: {
                coordinates: [
                  [14.6, 40.63],
                  [14.61, 40.64],
                  [14.62, 40.65],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    }),
  );
}

async function verlaeufeAus(response: Response) {
  return (
    (await response.json()) as {
      verlaeufe: Record<string, ActivityPosition[]>;
    }
  ).verlaeufe;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.unstubAllGlobals();
});

describe("GET /api/transfers/verlauf (req-059)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET(anfrage(MIT_AUTO))).status).toBe(401);
  });

  it("liefert den Strassenverlauf eines Transfers mit dem Auto", async () => {
    await angemeldet();
    osrm();

    const verlaeufe = await verlaeufeAus(await GET(anfrage(MIT_AUTO)));

    expect(verlaeufe[MIT_AUTO]).toEqual([
      { lat: 40.63, lng: 14.6 },
      { lat: 40.64, lng: 14.61 },
      { lat: 40.65, lng: 14.62 },
    ]);
  });

  it("fragt den Verlauf mit der Geometrie der Route an", async () => {
    await angemeldet();
    osrm();

    await GET(anfrage(MIT_AUTO));

    const url = String(
      (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    expect(url).toContain("overview=full");
    expect(url).toContain("geometries=geojson");
  });

  it("liefert fuer ein Verkehrsmittel ohne Profil keinen Verlauf", async () => {
    // Boot, Flug, Bahn und Faehre faehrt kein Routing-Dienst aus (req-059).
    await angemeldet();
    osrm();

    const verlaeufe = await verlaeufeAus(await GET(anfrage(MIT_BOOT)));

    expect(verlaeufe[MIT_BOOT]).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("liefert nichts, wenn der Routing-Dienst nicht erreichbar ist", async () => {
    await angemeldet();
    osrm(false);

    const antwort = await GET(anfrage(MIT_AUTO));

    // Kein Fehler -- die Karte zeigt dann die gepunktete Gerade.
    expect(antwort.status).toBe(200);
    expect(await verlaeufeAus(antwort)).toEqual({});
  });

  it("kennt keinen Transfer ausserhalb des eigenen Accounts", async () => {
    await angemeldet();
    osrm();

    expect(await verlaeufeAus(await GET(anfrage(FREMDER)))).toEqual({});
  });

  it("kommt ohne Kennungen aus", async () => {
    await angemeldet();
    osrm();

    expect(await verlaeufeAus(await GET(anfrage()))).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });
});
