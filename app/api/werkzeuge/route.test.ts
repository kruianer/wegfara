// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));

const { erzeugeMitdenkaZugang, mitdenkaZugangStand, widerrufeMitdenkaZugang } =
  await import("@/lib/werkzeuge/zugang");
const { WERKZEUG_NAMEN } = await import("@/lib/werkzeuge/beschreibungen");
const { NICHT_GEFUNDEN, KEIN_GOOGLE_SCHLUESSEL } = await import(
  "@/lib/werkzeuge/ausfuehren"
);
const { GOOGLE_ABFRAGEN_JE_TAG } = await import(
  "@/lib/werkzeuge/google-grenze"
);
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { googleStandText } = await import("@/lib/werkzeuge/zugang");
const { kalendertag } = await import("@/lib/werkzeuge/google-grenze");
const { POST, GET } = await import("./route");

/**
 * Die Lese-Schnittstelle fuer mitdenka (req-104) als Ganzes: Schluessel im
 * Kopf, JSON-RPC im Rumpf, gegen dieselbe Datenbank wie die Anwendung.
 */

const REISE_ID = "a1040000-0001-4a04-8b04-000000000001";
const FREMDE_REISE_ID = "a1040000-0002-4a04-8b04-000000000002";
const FREMDER_ACCOUNT = "a1040000-0003-4a04-8b04-000000000003";

let schluessel: string;

function anfrage(
  rumpf: unknown,
  {
    mit = schluessel as string | null,
    koepfe = {} as Record<string, string>,
  } = {},
) {
  return new Request("http://wegfara-app:3000/api/werkzeuge", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(mit ? { authorization: `Bearer ${mit}` } : {}),
      ...koepfe,
    },
    body: typeof rumpf === "string" ? rumpf : JSON.stringify(rumpf),
  });
}

let naechsteId = 0;
function rpc(method: string, params?: unknown) {
  naechsteId += 1;
  return { jsonrpc: "2.0", id: naechsteId, method, params };
}

async function rufe(name: string, args: unknown = {}, mit = schluessel) {
  const response = await POST(
    anfrage(rpc("tools/call", { name, arguments: args }), { mit }),
  );
  return (await response.json()) as {
    result?: { content: { type: string; text: string }[]; isError: boolean };
    error?: { code: number; message: string };
  };
}

function textAus(antwort: Awaited<ReturnType<typeof rufe>>): string {
  if (!antwort.result) throw new Error(JSON.stringify(antwort.error));
  return antwort.result.content[0].text;
}

async function reise(
  id: string,
  titel: string,
  von: string,
  bis: string,
  account = ACCOUNT_ID,
) {
  await testDb.pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, $2, $3, $4, $5, 'Bilbao', 43.26, -2.93)`,
    [id, account, titel, von, bis],
  );
}

let programmpunktNummer = 0;
async function programmpunkt(
  tripId: string,
  titel: string,
  von: string,
  bis: string,
) {
  programmpunktNummer += 1;
  await testDb.pool.query(
    `insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng)
     values ($1, $2, 'sehenswuerdigkeit', $3, 'kurz', 'Langtext', $4, $5, 43.26, -2.93)`,
    [
      `a1040000-1${String(programmpunktNummer).padStart(3, "0")}-4a04-8b04-000000000000`,
      tripId,
      titel,
      von,
      bis,
    ],
  );
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  programmpunktNummer = 0;
  await reise(REISE_ID, "Baskenland", "2026-05-04", "2026-05-08");
  await testDb.pool.query(
    `insert into account (id, name, email) values ($1, 'Fremder Account', 'fremd@example.com')`,
    [FREMDER_ACCOUNT],
  );
  await reise(
    FREMDE_REISE_ID,
    "Fremde Reise",
    "2026-05-04",
    "2026-05-08",
    FREMDER_ACCOUNT,
  );
  // Absichtlich nicht in zeitlicher Folge angelegt.
  await programmpunkt(
    REISE_ID,
    "Altstadt",
    "2026-05-05 15:00",
    "2026-05-05 17:00",
  );
  await programmpunkt(
    REISE_ID,
    "Guggenheim",
    "2026-05-05 10:00",
    "2026-05-05 13:00",
  );
  await programmpunkt(
    REISE_ID,
    "Pintxos",
    "2026-05-05 19:30",
    "2026-05-05 21:00",
  );
  await programmpunkt(
    REISE_ID,
    "San Sebastián",
    "2026-05-06 10:00",
    "2026-05-06 12:00",
  );
  schluessel = await erzeugeMitdenkaZugang(testDb.pool, ACCOUNT_ID, new Date());
});

describe("Anmeldung an der Lese-Schnittstelle (req-104)", () => {
  it("weist eine Anfrage ohne Schluessel ab", async () => {
    const response = await POST(anfrage(rpc("tools/list"), { mit: null }));

    expect(response.status).toBe(401);
    const antwort = (await response.json()) as { error?: unknown };
    expect(antwort.error).toBeDefined();
  });

  it("weist einen unbekannten Schluessel ab", async () => {
    const response = await POST(
      anfrage(rpc("tools/list"), { mit: "wegfara_ausgedacht" }),
    );

    expect(response.status).toBe(401);
  });

  it("weist den ersten Schluessel ab, sobald ein zweiter erzeugt ist", async () => {
    const erster = schluessel;
    const zweiter = await erzeugeMitdenkaZugang(
      testDb.pool,
      ACCOUNT_ID,
      new Date(),
    );

    expect(
      (await POST(anfrage(rpc("tools/list"), { mit: erster }))).status,
    ).toBe(401);
    expect(
      (await POST(anfrage(rpc("tools/list"), { mit: zweiter }))).status,
    ).toBe(200);
  });

  it("weist einen widerrufenen Schluessel ab", async () => {
    await widerrufeMitdenkaZugang(testDb.pool, ACCOUNT_ID);

    expect((await POST(anfrage(rpc("tools/list")))).status).toBe(401);
  });

  it("haelt fest, wann der Schluessel zuletzt benutzt wurde", async () => {
    expect(
      (await mitdenkaZugangStand(testDb.pool, ACCOUNT_ID, new Date()))
        .zuletztBenutzt,
    ).toBeNull();

    await POST(anfrage(rpc("tools/list")));

    expect(
      (await mitdenkaZugangStand(testDb.pool, ACCOUNT_ID, new Date()))
        .zuletztBenutzt,
    ).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });
});

describe("Nicht ueber den Cloudflare-Tunnel (req-104)", () => {
  it.each([
    ["cf-ray", "8f1c2d3e4a5b6c7d-FRA"],
    ["cf-connecting-ip", "203.0.113.7"],
    ["cdn-loop", "cloudflare"],
  ])(
    "ist mit dem Kopf %s nicht erreichbar -- auch mit gueltigem Schluessel",
    async (kopf, wert) => {
      const response = await POST(
        anfrage(rpc("tools/list"), { koepfe: { [kopf]: wert } }),
      );

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("tools");
    },
  );

  it("verraet sich auch ueber GET nicht", () => {
    expect(GET().status).toBe(404);
  });
});

describe("JSON-RPC-Umschlag (req-104)", () => {
  it("antwortet auf einen unbekannten Methodennamen mit einem Fehler im Umschlag", async () => {
    const response = await POST(anfrage(rpc("tools/loeschen")));

    expect(response.status).toBe(200);
    const antwort = (await response.json()) as {
      jsonrpc: string;
      id: number;
      error: { code: number; message: string };
    };
    expect(antwort.jsonrpc).toBe("2.0");
    expect(antwort.id).toBe(naechsteId);
    expect(antwort.error.code).toBe(-32601);
  });

  it("antwortet auf unlesbares JSON mit einem Fehler im Umschlag", async () => {
    const response = await POST(anfrage("{ kein json"));

    const antwort = (await response.json()) as { error: { code: number } };
    expect(antwort.error.code).toBe(-32700);
  });

  it("antwortet auf ein unbekanntes Werkzeug mit einem Fehler im Umschlag", async () => {
    const antwort = await rufe("reise_loeschen");

    expect(antwort.error?.code).toBe(-32602);
  });
});

describe("tools/list (req-104)", () => {
  async function werkzeuge() {
    const response = await POST(anfrage(rpc("tools/list")));
    const antwort = (await response.json()) as {
      result: {
        tools: {
          name: string;
          description: string;
          inputSchema: { type: string };
          annotations: { readOnlyHint: boolean };
        }[];
      };
    };
    return antwort.result.tools;
  }

  it("nennt alle acht Werkzeuge mit Beschreibung und inputSchema", async () => {
    const tools = await werkzeuge();

    expect(tools.map((tool) => tool.name).sort()).toEqual(
      [...WERKZEUG_NAMEN].sort(),
    );
    expect(tools).toHaveLength(8);
    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("kennzeichnet jedes Werkzeug mit readOnlyHint: true", async () => {
    for (const tool of await werkzeuge()) {
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });
});

describe("Die Reise-Werkzeuge (req-104)", () => {
  it("reisen_auflisten nennt alle Reisen meines Accounts mit Kennung, Titel, Zeitraum und Zustand", async () => {
    const { reisen } = JSON.parse(textAus(await rufe("reisen_auflisten"))) as {
      reisen: Record<string, unknown>[];
    };

    const { rows } = await testDb.pool.query(
      `select id from trip where account_id = $1`,
      [ACCOUNT_ID],
    );
    expect(reisen.map((r) => r.kennung).sort()).toEqual(
      rows.map((row: { id: string }) => row.id).sort(),
    );
    expect(reisen.find((r) => r.kennung === REISE_ID)).toEqual({
      kennung: REISE_ID,
      titel: "Baskenland",
      von: "2026-05-04",
      bis: "2026-05-08",
      zustand: "In Planung",
      pois: 0,
      programmpunkte: 4,
    });
    expect(reisen.map((r) => r.titel)).not.toContain("Fremde Reise");
  });

  it("tagesplan_lesen nennt die Programmpunkte des Tags in zeitlicher Folge", async () => {
    const tag = JSON.parse(
      textAus(
        await rufe("tagesplan_lesen", { reise: REISE_ID, datum: "2026-05-05" }),
      ),
    ) as { programmpunkte: { von: string; titel: string }[] };

    expect(tag.programmpunkte.map((p) => [p.von, p.titel])).toEqual([
      ["10:00", "Guggenheim"],
      ["15:00", "Altstadt"],
      ["19:30", "Pintxos"],
    ]);
  });

  it("reise_lesen nennt die Eckdaten, aber nicht, wer mitfaehrt", async () => {
    const text = textAus(await rufe("reise_lesen", { reise: REISE_ID }));

    expect(JSON.parse(text)).toMatchObject({
      titel: "Baskenland",
      hauptort: "Bilbao",
      teilnehmerzahl: 0,
    });
    expect(text).not.toContain("@");
  });

  it.each(["reise_lesen", "pois_lesen", "tagesplan_lesen", "kosten_lesen"])(
    "%s antwortet auf die Reise eines anderen Accounts mit „nicht gefunden“",
    async (werkzeug) => {
      const antwort = await rufe(werkzeug, {
        reise: FREMDE_REISE_ID,
        datum: "2026-05-05",
      });

      expect(antwort.result?.isError).toBe(true);
      expect(textAus(antwort)).toBe(NICHT_GEFUNDEN);
    },
  );

  it("antwortet auf eine Reise, die es nirgends gibt, genauso", async () => {
    for (const reise of [
      "a1040000-9999-4a04-8b04-000000000009",
      "keine-uuid",
      undefined,
    ]) {
      expect(textAus(await rufe("pois_lesen", { reise }))).toBe(NICHT_GEFUNDEN);
    }
  });

  it("nimmt keine Account-Kennung aus den Argumenten an", async () => {
    const antwort = await rufe("reise_lesen", {
      reise: FREMDE_REISE_ID,
      account: FREMDER_ACCOUNT,
      accountId: FREMDER_ACCOUNT,
    });

    expect(textAus(antwort)).toBe(NICHT_GEFUNDEN);
  });
});

describe("Die Google-Werkzeuge (req-104)", () => {
  const GUGGENHEIM = {
    id: "ChIJGuggenheimBilbao",
    displayName: { text: "Guggenheim-Museum Bilbao" },
    formattedAddress: "Abandoibarra Etorb., 2, 48009 Bilbo, Bizkaia, Spanien",
    location: { latitude: 43.2687, longitude: -2.934 },
    rating: 4.6,
    userRatingCount: 98000,
    websiteUri: "https://www.guggenheim-bilbao.eus",
    internationalPhoneNumber: "+34 944 35 90 80",
    regularOpeningHours: {
      weekdayDescriptions: ["Montag: Geschlossen", "Dienstag: 10:00–19:00"],
    },
  };

  /** Google antwortet -- extern, deshalb gemockt (stack.md, Testing). */
  function googleAntwortet() {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(url).includes("searchText")
          ? { places: [GUGGENHEIM] }
          : GUGGENHEIM,
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function googleSchluessel() {
    await storeAccountApiKey(
      testDb.pool,
      ACCOUNT_ID,
      "google",
      "goo-gle-a3f9",
      new Date(),
    );
  }

  async function stand() {
    return mitdenkaZugangStand(testDb.pool, ACCOUNT_ID, new Date());
  }

  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ort_suchen nennt zu „Guggenheim Bilbao“ den Ort mit Anschrift und Position", async () => {
    await googleSchluessel();
    googleAntwortet();

    const { orte } = JSON.parse(
      textAus(await rufe("ort_suchen", { suchbegriff: "Guggenheim Bilbao" })),
    ) as { orte: Record<string, unknown>[] };

    expect(orte).toEqual([
      {
        kennung: "ChIJGuggenheimBilbao",
        name: "Guggenheim-Museum Bilbao",
        anschrift: "Abandoibarra Etorb., 2, 48009 Bilbo, Bizkaia, Spanien",
        position: { lat: 43.2687, lng: -2.934 },
      },
    ]);
  });

  it("ort_nachschlagen nennt Öffnungszeiten, Bewertung, Webseite und Telefon", async () => {
    await googleSchluessel();
    const fetchMock = googleAntwortet();

    const ort = JSON.parse(
      textAus(
        await rufe("ort_nachschlagen", { kennung: "ChIJGuggenheimBilbao" }),
      ),
    ) as Record<string, unknown>;

    expect(ort).toMatchObject({
      name: "Guggenheim-Museum Bilbao",
      oeffnungszeiten: ["Montag: Geschlossen", "Dienstag: 10:00–19:00"],
      bewertung: 4.6,
      webseite: "https://www.guggenheim-bilbao.eus",
      telefon: "+34 944 35 90 80",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "places/ChIJGuggenheimBilbao",
    );
  });

  it("ort_suchen sagt, dass kein Google-Zugangsschlüssel am Account hinterlegt ist", async () => {
    const fetchMock = googleAntwortet();

    const antwort = await rufe("ort_suchen", {
      suchbegriff: "Guggenheim Bilbao",
    });

    expect(antwort.result?.isError).toBe(true);
    expect(textAus(antwort)).toBe(KEIN_GOOGLE_SCHLUESSEL);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await stand()).googleAbfragenHeute).toBe(0);
  });

  it("ort_suchen sagt bei erreichter Tagesgrenze das mit dem Stand -- und fragt Google NICHT", async () => {
    await googleSchluessel();
    await testDb.pool.query(
      `insert into werkzeug_google_abfrage (account_id, tag, anzahl) values ($1, $2, $3)`,
      [ACCOUNT_ID, kalendertag(new Date()), GOOGLE_ABFRAGEN_JE_TAG],
    );
    const fetchMock = googleAntwortet();

    const antwort = await rufe("ort_suchen", {
      suchbegriff: "Guggenheim Bilbao",
    });

    expect(antwort.result?.isError).toBe(true);
    expect(textAus(antwort)).toContain("Tagesgrenze");
    expect(textAus(antwort)).toContain(
      `${GOOGLE_ABFRAGEN_JE_TAG} von ${GOOGLE_ABFRAGEN_JE_TAG}`,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await stand()).googleAbfragenHeute).toBe(GOOGLE_ABFRAGEN_JE_TAG);
  });

  it("zählt fünf Suchen heute als „5 von N“ für Mein Bereich", async () => {
    await googleSchluessel();
    googleAntwortet();

    for (let i = 0; i < 5; i++) {
      await rufe("ort_suchen", { suchbegriff: "Guggenheim Bilbao" });
    }

    expect(googleStandText(await stand())).toBe(
      `5 von ${GOOGLE_ABFRAGEN_JE_TAG}`,
    );
  });

  it("zählt ort_nachschlagen gegen dieselbe Grenze", async () => {
    await googleSchluessel();
    googleAntwortet();

    await rufe("ort_nachschlagen", { kennung: "ChIJGuggenheimBilbao" });

    expect((await stand()).googleAbfragenHeute).toBe(1);
  });

  it("nennt einen abgewiesenen Google-Schlüssel", async () => {
    await googleSchluessel();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })),
    );

    const antwort = await rufe("ort_suchen", {
      suchbegriff: "Guggenheim Bilbao",
    });

    expect(antwort.result?.isError).toBe(true);
    expect(textAus(antwort)).toContain("abgewiesen");
  });
});
