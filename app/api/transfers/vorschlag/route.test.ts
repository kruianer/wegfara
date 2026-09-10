// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { TransferVorschlag } from "@/lib/transfers/vorschlag";

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

/** Zwei Programmpunkte des 21.07. der Sueditalien-Rundreise, beide mit Position. */
const POMPEJI_ID = "58ccb947-6c2e-4b18-a9cc-47461e47140d";
const SORRENT_ID = "7052adca-7b5f-4a16-85bd-ca0f4513566e";
/** "Abendlicher Stadtbummel in Positano" -- ohne Position (siehe migrations/0009). */
const OHNE_POSITION_ID = "9a372af3-1719-49e1-8a00-cda91d8e1bbd";
const CAPRI_LUNCH_ID = "c754341c-0bb1-45dc-84f4-ea26fbe88eaf";

function anfrage(von: string, nach: string) {
  return new Request(
    `https://dev.wegfara.com/api/transfers/vorschlag?von=${von}&nach=${nach}`,
  );
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

/**
 * OSRM antwortet aus dem Haus -- kein Netz im Test (siehe stack.md). Jedes
 * der drei Profile (req-059) hat seine eigene Adresse; zu Fuß dauert
 * dieselbe Strecke laenger als mit dem Auto.
 */
function osrm(strecke: { km: number; minuten: number } | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (!strecke) throw new Error("network down");
      const faktor = String(url).includes("foot")
        ? 5
        : String(url).includes("bike")
          ? 2
          : 1;
      return new Response(
        JSON.stringify({
          code: "Ok",
          routes: [
            {
              duration: strecke.minuten * 60 * faktor,
              distance: strecke.km * 1000,
            },
          ],
        }),
        { status: 200 },
      );
    }),
  );
}

async function vorschlagAus(response: Response) {
  return (await response.json()) as {
    vorschlag: TransferVorschlag | null;
    grund?: string;
  };
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.unstubAllGlobals();
});

describe("GET /api/transfers/vorschlag (req-052)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET(anfrage(POMPEJI_ID, SORRENT_ID))).status).toBe(401);
  });

  it("kennt keinen Programmpunkt eines fremden Accounts", async () => {
    await angemeldet();
    osrm({ km: 12, minuten: 20 });

    expect((await GET(anfrage(randomUUID(), SORRENT_ID))).status).toBe(404);
  });

  it("schlaegt bei 800 m „zu Fuß“ vor", async () => {
    await angemeldet();
    osrm({ km: 0.8, minuten: 3 });

    const { vorschlag } = await vorschlagAus(
      await GET(anfrage(POMPEJI_ID, SORRENT_ID)),
    );

    expect(vorschlag?.mode).toBe("fuss");
    expect(vorschlag?.proMittel.fuss?.distanceKm).toBe(0.8);
  });

  it("schlaegt bei 12 km „Auto“ vor", async () => {
    await angemeldet();
    osrm({ km: 12, minuten: 20 });

    const { vorschlag } = await vorschlagAus(
      await GET(anfrage(POMPEJI_ID, SORRENT_ID)),
    );

    expect(vorschlag?.mode).toBe("auto");
    expect(vorschlag?.proMittel.auto).toEqual({
      distanceKm: 12,
      durationMin: 20,
    });
  });

  it("nennt zu jedem Verkehrsmittel mit Streckenvorschlag Dauer und Strecke", async () => {
    // Wer im Formular wechselt, bekommt sie ohne neue Anfrage (req-052).
    await angemeldet();
    osrm({ km: 12, minuten: 20 });

    const { vorschlag } = await vorschlagAus(
      await GET(anfrage(POMPEJI_ID, SORRENT_ID)),
    );

    expect(Object.keys(vorschlag?.proMittel ?? {})).toEqual([
      "fuss",
      "rad",
      "auto",
      "bus",
    ]);
  });

  it("rechnet zu Fuß laenger als mit dem Auto (req-059)", async () => {
    await angemeldet();
    osrm({ km: 3, minuten: 6 });

    const { vorschlag } = await vorschlagAus(
      await GET(anfrage(POMPEJI_ID, SORRENT_ID)),
    );

    expect(vorschlag?.proMittel.fuss?.durationMin).toBeGreaterThan(
      vorschlag?.proMittel.auto?.durationMin ?? 0,
    );
  });

  it("fragt jedes der drei Profile bei seiner eigenen Adresse an (req-059)", async () => {
    await angemeldet();
    osrm({ km: 3, minuten: 6 });

    await GET(anfrage(POMPEJI_ID, SORRENT_ID));

    const adressen = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((aufruf) => String(aufruf[0]))
      .join(" ");
    expect(adressen).toContain("/route/v1/driving/");
    expect(adressen).toContain("/route/v1/bike/");
    expect(adressen).toContain("/route/v1/foot/");
  });

  it("nennt den Grund, wenn einem Programmpunkt die Position fehlt", async () => {
    await angemeldet();
    osrm({ km: 12, minuten: 20 });

    const antwort = await vorschlagAus(
      await GET(anfrage(CAPRI_LUNCH_ID, OHNE_POSITION_ID)),
    );

    expect(antwort.vorschlag).toBeNull();
    expect(antwort.grund).toBe("ohne_position");
  });

  it("fragt ohne Position gar nicht erst beim Routing-Dienst nach", async () => {
    await angemeldet();
    osrm({ km: 12, minuten: 20 });

    await GET(anfrage(CAPRI_LUNCH_ID, OHNE_POSITION_ID));

    expect(fetch).not.toHaveBeenCalled();
  });

  it("nennt den Grund, wenn der Routing-Dienst nicht erreichbar ist", async () => {
    await angemeldet();
    osrm(null);

    const antwort = await vorschlagAus(
      await GET(anfrage(POMPEJI_ID, SORRENT_ID)),
    );

    expect(antwort.vorschlag).toBeNull();
    expect(antwort.grund).toBe("dienst_stumm");
  });
});
