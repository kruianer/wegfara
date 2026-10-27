// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type {
  AiChatAnfrage,
  AiChatClient,
  ChatStromStueck,
  PlanWerkzeug,
} from "@/lib/ai/chat-client";
import { leseChatZeilen, type ChatEreignis } from "@/lib/chat/strom";
import type { ChatNachricht } from "@/lib/chat/types";

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";
const FREMDE_REISE_ID = "11111111-1111-4111-8111-111111111111";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
// Externe Dienste werden in Tests gemockt (siehe stack.md, Testing) -- kein
// Test darf im Netz haengen oder Kosten verursachen.
const aussen = vi.hoisted(() => ({ createAnthropicChatClient: vi.fn() }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));
vi.mock("@/lib/ai/anthropic-client", () => ({
  createAnthropicChatClient: aussen.createAnthropicChatClient,
}));

const { createSession } = await import("@/lib/db/sessions");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { listChatNachrichten } = await import("@/lib/db/chat-nachrichten");
const { chatModelleZwischengespeichert, clearChatModellCache } = await import(
  "@/lib/chat/modell-katalog-cache"
);
const { DELETE, GET, POST } = await import("./route");

const NOW = new Date("2026-10-12T10:00:00Z");

function senden(body: unknown, method: "POST" | "DELETE" = "POST") {
  return new Request("https://dev.wegfara.com/api/chat", {
    method,
    body: JSON.stringify(body),
  });
}

function holen(query: string) {
  return new Request(`https://dev.wegfara.com/api/chat${query}`);
}

async function angemeldet(token = "token-1") {
  await createSession(testDb.pool, PARTICIPANT_ID, token, NOW);
  cookieJar.werte[SESSION_COOKIE] = token;
}

async function mitSchluessel() {
  await storeAccountApiKey(
    testDb.pool,
    ACCOUNT_ID,
    "anthropic",
    "sk-ant-a3f9",
    NOW,
  );
}

/** Die KI antwortet mit diesen Stuecken, eines nach dem anderen. */
function kiAntwortet(...stuecke: ChatStromStueck[]) {
  const antworte = vi.fn(async function* () {
    for (const stueck of stuecke) yield stueck;
  });
  aussen.createAnthropicChatClient.mockImplementation(
    () => ({ antworte }) as unknown as AiChatClient,
  );
  return antworte;
}

function textStuecke(...texte: string[]): ChatStromStueck[] {
  return texte.map((text) => ({ art: "text" as const, text }));
}

/** Die Ereignisse des Stroms, der Reihe nach. */
async function ereignisseAus(response: Response): Promise<ChatEreignis[]> {
  const ereignisse: ChatEreignis[] = [];
  let rest = "";
  const leser = response.body!.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    const gelesen = leseChatZeilen(rest + decoder.decode(value));
    ereignisse.push(...gelesen.ereignisse);
    rest = gelesen.rest;
  }
  return ereignisse;
}

async function verlaufAus(response: Response): Promise<ChatNachricht[]> {
  return ((await response.json()) as { nachrichten: ChatNachricht[] })
    .nachrichten;
}

/** Eine Frage senden und die Antwort abwarten. */
async function frage(
  text: string,
  modell = "claude-sonnet-5",
  tripId = SUEDITALIEN_ID,
) {
  return ereignisseAus(await POST(senden({ tripId, text, modell })));
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  aussen.createAnthropicChatClient.mockReset();
  clearChatModellCache();
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  await testDb.pool.query(
    `insert into account (id, name, email) values ($1, 'Fremder Account', 'fremd@example.com')`,
    ["22222222-2222-4222-8222-222222222222"],
  );
  await testDb.pool.query(
    `insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng)
     values ($1, '22222222-2222-4222-8222-222222222222', 'Fremde Reise', '2027-01-01', '2027-01-05', 'Berlin', 52.52, 13.405)`,
    [FREMDE_REISE_ID],
  );
});

/**
 * Ohne Anmeldung geht hier nichts (req-016) -- weder lesend noch schreibend.
 * Die middleware faengt den Fall ohne Cookie schon vorher ab; geprueft wird
 * hier, ob die Sitzung wirklich gilt.
 */
describe("Schnittstelle des Chats ohne Anmeldung (req-081)", () => {
  it("weist das Abrufen der Unterhaltung ab", async () => {
    expect((await GET(holen(`?tripId=${SUEDITALIEN_ID}`))).status).toBe(401);
  });

  it("weist das Senden einer Frage ab", async () => {
    const response = await POST(
      senden({
        tripId: SUEDITALIEN_ID,
        text: "Hallo",
        modell: "claude-sonnet-5",
      }),
    );

    expect(response.status).toBe(401);
    expect(aussen.createAnthropicChatClient).not.toHaveBeenCalled();
  });

  it("weist das Verwerfen ab", async () => {
    expect(
      (await DELETE(senden({ tripId: SUEDITALIEN_ID }, "DELETE"))).status,
    ).toBe(401);
  });
});

/**
 * Wer eine Reise nicht sieht, sieht ihre Unterhaltung nicht (req-023,
 * security.md). Die Kennung der Reise kommt aus der Anfrage, der Mandant
 * ausschliesslich aus der Anmeldung (req-024).
 */
describe("Schnittstelle des Chats und fremde Reisen (req-081)", () => {
  it("weist das Abrufen einer fremden Unterhaltung ab", async () => {
    await angemeldet();

    expect((await GET(holen(`?tripId=${FREMDE_REISE_ID}`))).status).toBe(404);
  });

  it("weist eine Frage zu einer fremden Reise ab", async () => {
    await angemeldet();
    await mitSchluessel();
    kiAntwortet(...textStuecke("Gern."));

    const response = await POST(
      senden({
        tripId: FREMDE_REISE_ID,
        text: "Hallo",
        modell: "claude-sonnet-5",
      }),
    );

    expect(response.status).toBe(404);
    expect(aussen.createAnthropicChatClient).not.toHaveBeenCalled();
  });

  it("weist das Verwerfen einer fremden Unterhaltung ab", async () => {
    await angemeldet();

    expect(
      (await DELETE(senden({ tripId: FREMDE_REISE_ID }, "DELETE"))).status,
    ).toBe(404);
  });

  it("weist eine Reise ab, die es nicht gibt", async () => {
    await angemeldet();

    expect(
      (await GET(holen("?tripId=33333333-3333-4333-8333-333333333333"))).status,
    ).toBe(404);
  });

  it("verlangt eine Reise in der Anfrage", async () => {
    await angemeldet();

    expect((await GET(holen(""))).status).toBe(400);
  });
});

describe("Frage senden (req-081)", () => {
  beforeEach(async () => {
    await angemeldet();
    await mitSchluessel();
  });

  it("legt die Frage ab und liefert die Antwort stueckweise", async () => {
    kiAntwortet(...textStuecke("In Amalfi ", "gibt es den Dom."));

    const ereignisse = await frage("Was gibt es in Amalfi?");

    expect(ereignisse.map((ereignis) => ereignis.art)).toEqual([
      "frage",
      "text",
      "text",
      "antwort",
    ]);
    expect(ereignisse[1]).toEqual({ art: "text", text: "In Amalfi " });
    expect(ereignisse[2]).toEqual({ art: "text", text: "gibt es den Dom." });
  });

  it("legt Frage und Antwort im Verlauf der Reise ab", async () => {
    kiAntwortet(...textStuecke("In Amalfi gibt es den Dom."));

    await frage("Was gibt es in Amalfi?");

    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(
      verlauf.map((nachricht) => [nachricht.rolle, nachricht.text]),
    ).toEqual([
      ["ich", "Was gibt es in Amalfi?"],
      ["ki", "In Amalfi gibt es den Dom."],
    ]);
  });

  it("merkt sich zur Antwort das Modell, das sie gab", async () => {
    kiAntwortet(...textStuecke("Gern."));

    await frage("Hallo", "claude-opus-5");

    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(verlauf[1].modell).toBe("claude-opus-5");
    expect(verlauf[0].modell).toBeNull();
  });

  it("fragt das Modell, das die Anfrage nennt", async () => {
    const antworte = kiAntwortet(...textStuecke("Gern."));

    await frage("Hallo", "claude-haiku-4-5");

    expect(antworte).toHaveBeenCalledWith(
      expect.objectContaining({ modell: "claude-haiku-4-5" }),
    );
  });

  it("gibt den Verlauf der Reise als Zusammenhang mit, die neue Frage zuletzt", async () => {
    kiAntwortet(...textStuecke("Erste Antwort"));
    await frage("Erste Frage");
    const antworte = kiAntwortet(...textStuecke("Zweite Antwort"));

    await frage("Zweite Frage");

    expect(antworte).toHaveBeenCalledWith(
      expect.objectContaining({
        verlauf: [
          { rolle: "ich", text: "Erste Frage" },
          { rolle: "ki", text: "Erste Antwort" },
          { rolle: "ich", text: "Zweite Frage" },
        ],
      }),
    );
  });

  it("vermischt die Unterhaltungen zweier Reisen nicht", async () => {
    kiAntwortet(...textStuecke("Zur Amalfiküste"));
    await frage("Was gibt es in Amalfi?", "claude-sonnet-5", SUEDITALIEN_ID);
    const antworte = kiAntwortet(...textStuecke("Nach Wien"));

    await frage("Was gibt es in Wien?", "claude-sonnet-5", WIEN_ID);

    expect(antworte).toHaveBeenCalledWith(
      expect.objectContaining({
        verlauf: [{ rolle: "ich", text: "Was gibt es in Wien?" }],
      }),
    );
  });

  it("nimmt keine leere Nachricht an", async () => {
    kiAntwortet(...textStuecke("Gern."));

    const response = await POST(
      senden({
        tripId: SUEDITALIEN_ID,
        text: "   ",
        modell: "claude-sonnet-5",
      }),
    );

    expect(response.status).toBe(400);
    expect(aussen.createAnthropicChatClient).not.toHaveBeenCalled();
  });

  /** Der Katalog, den das Chatfenster zuletzt bekam (req-090). */
  async function katalogGemerkt(...ids: string[]) {
    await chatModelleZwischengespeichert(
      ACCOUNT_ID,
      () => ({
        liste: async () => ({
          modelle: ids.map((id) => ({
            id,
            name: id,
            lebenslauf: "active" as const,
            reihe: null,
            maxEingabeTokens: null,
          })),
          fehler: null,
        }),
      }),
      Date.now(),
    );
  }

  it("fragt genau das gewaehlte Modell aus dem Katalog (req-090)", async () => {
    await katalogGemerkt("claude-opus-5-5", "claude-sonnet-5-5");
    const antworte = kiAntwortet(...textStuecke("Gern."));

    await frage("Hallo", "claude-opus-5-5");

    expect(antworte).toHaveBeenCalledWith(
      expect.objectContaining({ modell: "claude-opus-5-5" }),
    );
    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(verlauf.at(-1)?.modell).toBe("claude-opus-5-5");
  });

  it("nimmt kein Modell an, das nicht zur Auswahl steht", async () => {
    await katalogGemerkt("claude-sonnet-5-5");
    kiAntwortet(...textStuecke("Gern."));

    const response = await POST(
      senden({
        tripId: SUEDITALIEN_ID,
        text: "Hallo",
        modell: "gpt-5.6-luna",
      }),
    );

    expect(response.status).toBe(400);
    expect(aussen.createAnthropicChatClient).not.toHaveBeenCalled();
  });

  /**
   * Faellt der Katalog aus, darf das den Chat nicht scheitern lassen
   * (req-090, Constraints): ohne gemerkten Katalog genuegt eine
   * wohlgeformte Kennung.
   */
  it("nimmt ohne gemerkten Katalog das laufende Modell an", async () => {
    const antworte = kiAntwortet(...textStuecke("Gern."));

    await frage("Hallo", "claude-sonnet-5");

    expect(antworte).toHaveBeenCalledWith(
      expect.objectContaining({ modell: "claude-sonnet-5" }),
    );
  });

  it("nimmt auch ohne Katalog nichts an, das keine Kennung ist", async () => {
    kiAntwortet(...textStuecke("Gern."));

    const response = await POST(
      senden({ tripId: SUEDITALIEN_ID, text: "Hallo", modell: "a b" }),
    );

    expect(response.status).toBe(400);
    expect(aussen.createAnthropicChatClient).not.toHaveBeenCalled();
  });
});

/**
 * Der Chat darf im Web suchen (req-092): die Quellen kommen aus dem Strom des
 * Dienstes, gehen an das Fenster und werden mit der Antwort abgelegt.
 */
describe("Frage senden mit Web-Suche (req-092)", () => {
  beforeEach(async () => {
    await angemeldet();
    await mitSchluessel();
  });

  const MUSEUM = {
    url: "https://www.museum.de/besuch",
    titel: "Besuch planen – Museum",
  };

  it("reicht Suche und Quellen an das Fenster weiter", async () => {
    kiAntwortet(
      { art: "suche" },
      { art: "quelle", quelle: MUSEUM },
      ...textStuecke("Geöffnet von 10 bis 18 Uhr."),
    );

    const ereignisse = await frage("Wann hat das Museum geöffnet?");

    expect(ereignisse.map((ereignis) => ereignis.art)).toEqual([
      "frage",
      "suche",
      "quelle",
      "text",
      "antwort",
    ]);
    const antwort = ereignisse.at(-1);
    expect(antwort?.art === "antwort" && antwort.nachricht.quellen).toEqual([
      MUSEUM,
    ]);
  });

  it("legt die Quellen mit der Antwort ab, sodass sie das Neuladen ueberdauern", async () => {
    kiAntwortet(
      { art: "suche" },
      { art: "quelle", quelle: MUSEUM },
      { art: "quelle", quelle: { url: "https://b.example/", titel: "B" } },
      ...textStuecke("Geöffnet."),
    );

    await frage("Wann hat das Museum geöffnet?");

    const nachrichten = await verlaufAus(
      await GET(holen(`?tripId=${SUEDITALIEN_ID}`)),
    );
    expect(nachrichten.map((nachricht) => nachricht.quellen)).toEqual([
      [],
      [MUSEUM, { url: "https://b.example/", titel: "B" }],
    ]);
  });

  it("legt eine Antwort, deren Suche scheiterte, samt Text und Grund ab", async () => {
    kiAntwortet(
      ...textStuecke("Das Museum liegt am Markt. "),
      { art: "suche" },
      { art: "suche_fehler", fehler: "dienst" },
      ...textStuecke("Die Zeiten konnte ich nicht nachsehen."),
    );

    const ereignisse = await frage("Wann hat das Museum geöffnet?");

    expect(ereignisse.map((ereignis) => ereignis.art)).not.toContain("fehler");
    const nachrichten = await verlaufAus(
      await GET(holen(`?tripId=${SUEDITALIEN_ID}`)),
    );
    expect(nachrichten[1]).toMatchObject({
      rolle: "ki",
      text: "Das Museum liegt am Markt. Die Zeiten konnte ich nicht nachsehen.",
      sucheFehler: "dienst",
    });
  });

  /**
   * Die Suche gibt dem Chat Augen nach aussen (req-092); in die Reise sieht
   * er nur ueber die lesenden Werkzeuge (req-093). Im Zusammenhang selbst
   * stehen keine Reisedaten -- nur Modell, Verlauf und der Leser.
   */
  it("gibt der KI keine Daten der geoeffneten Reise in den Zusammenhang", async () => {
    const antworte = kiAntwortet(...textStuecke("Ich sehe nach."));

    await frage("Welche Tage hat meine Reise?");

    expect(antworte).toHaveBeenCalledTimes(1);
    const [anfrage] = antworte.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(Object.keys(anfrage).sort()).toEqual([
      "modell",
      "planLeser",
      "verlauf",
    ]);
    expect(anfrage.verlauf).toEqual([
      { rolle: "ich", text: "Welche Tage hat meine Reise?" },
    ]);
  });

  it("legt eine Antwort ohne Suche ohne Quellen ab", async () => {
    kiAntwortet(...textStuecke("Ein Transfer ist die Fahrt dazwischen."));

    const ereignisse = await frage("Was ist ein Transfer?");

    expect(ereignisse.map((ereignis) => ereignis.art)).not.toContain("suche");
    const antwort = ereignisse.at(-1);
    expect(antwort?.art === "antwort" && antwort.nachricht.quellen).toEqual([]);
  });
});

/**
 * Die KI liest mit dem Leser, den die Schnittstelle ihr mitgibt (req-093) --
 * und gibt das Gelesene als Text zurueck, damit der Test sieht, was sie sah.
 */
function kiLiest(
  aufrufe: { werkzeug: PlanWerkzeug; eingabe: unknown }[],
  ...danach: ChatStromStueck[]
) {
  const antworte = vi.fn(async function* (anfrage: AiChatAnfrage) {
    for (const { werkzeug, eingabe } of aufrufe) {
      yield { art: "plan" as const, werkzeug };
      const auskunft = await anfrage.planLeser!.lies(werkzeug, eingabe);
      yield { art: "text" as const, text: JSON.stringify(auskunft) };
    }
    for (const stueck of danach) yield stueck;
  });
  aussen.createAnthropicChatClient.mockImplementation(
    () => ({ antworte }) as unknown as AiChatClient,
  );
  return antworte;
}

describe("Frage senden mit Blick in den Plan (req-093)", () => {
  beforeEach(async () => {
    await angemeldet();
    await mitSchluessel();
  });

  it("reicht den Blick in den Plan an das Fenster weiter und legt ihn mit der Antwort ab", async () => {
    kiAntwortet(
      { art: "plan", werkzeug: "reise_lesen" },
      { art: "plan", werkzeug: "tagesplan_lesen" },
      { art: "plan", werkzeug: "tagesplan_lesen" },
      ...textStuecke("Am Samstag: Dom, Mittagessen, Aussichtspunkt."),
    );

    const ereignisse = await frage("Was haben wir am Samstag vor?");

    expect(ereignisse.map((ereignis) => ereignis.art)).toEqual([
      "frage",
      "plan",
      "plan",
      "plan",
      "text",
      "antwort",
    ]);
    const nachrichten = await verlaufAus(
      await GET(holen(`?tripId=${SUEDITALIEN_ID}`)),
    );
    // Je Teil des Plans einmal -- als Vermerk an der Antwort, nicht als
    // eigene Nachricht.
    expect(nachrichten).toHaveLength(2);
    expect(nachrichten[1].planEinblicke).toEqual([
      "reise_lesen",
      "tagesplan_lesen",
    ]);
    expect(nachrichten[0].planEinblicke).toEqual([]);
  });

  it("legt eine Antwort ohne Blick in den Plan ohne Vermerk ab", async () => {
    kiAntwortet(...textStuecke("Ein Transfer ist die Fahrt dazwischen."));

    await frage("Was ist ein Transfer?");

    const nachrichten = await verlaufAus(
      await GET(holen(`?tripId=${SUEDITALIEN_ID}`)),
    );
    expect(nachrichten[1]).toMatchObject({
      planEinblicke: [],
      planFehler: null,
    });
  });

  it("legt eine Antwort, deren Blick in den Plan scheiterte, samt Text und Grund ab", async () => {
    kiAntwortet(
      ...textStuecke("Ich sehe nach. "),
      { art: "plan", werkzeug: "tagesplan_lesen" },
      { art: "plan_fehler", fehler: "lesen" },
      ...textStuecke("Den Plan konnte ich gerade nicht lesen."),
    );

    const ereignisse = await frage("Was haben wir am Samstag vor?");

    expect(ereignisse.map((ereignis) => ereignis.art)).not.toContain("fehler");
    const nachrichten = await verlaufAus(
      await GET(holen(`?tripId=${SUEDITALIEN_ID}`)),
    );
    expect(nachrichten[1]).toMatchObject({
      rolle: "ki",
      text: "Ich sehe nach. Den Plan konnte ich gerade nicht lesen.",
      planEinblicke: ["tagesplan_lesen"],
      planFehler: "lesen",
    });
  });

  it("liest im Chat der einen Reise nur deren Programmpunkte", async () => {
    kiLiest([
      { werkzeug: "tagesplan_lesen", eingabe: { datum: "2026-07-18" } },
    ]);

    const ereignisse = await frage("Was haben wir am ersten Tag vor?");

    const antwort = ereignisse.at(-1);
    const text = antwort?.art === "antwort" ? antwort.nachricht.text : "";
    expect(text).toContain("Dom von Amalfi");
    // Die zweite Reise desselben Accounts bleibt aussen vor.
    expect(text).not.toContain("Stephansdom");
    expect(text).not.toContain("Schloss Schoenbrunn");
  });

  /**
   * Die Reise kommt vom Server, aus der geprueften Anfrage -- nicht vom
   * Modell. Nennt es eine andere, eigene oder fremde, wird sie ignoriert.
   */
  it("ignoriert eine Reisekennung, die das Modell nennt, und liest die geoeffnete", async () => {
    kiLiest(
      [WIEN_ID, FREMDE_REISE_ID].map((fremd) => ({
        werkzeug: "tagesplan_lesen" as const,
        eingabe: { datum: "2026-07-18", tripId: fremd, trip_id: fremd },
      })),
    );

    const ereignisse = await frage("Was steht in der Reise nach Wien an?");

    const antwort = ereignisse.at(-1);
    const text = antwort?.art === "antwort" ? antwort.nachricht.text : "";
    expect(text).toContain("Dom von Amalfi");
    expect(text).not.toContain("Stephansdom");
    expect(text).not.toContain("Fremde Reise");
  });

  /**
   * Nur lesend (req-093, Constraints): wird der Chat gebeten, etwas zu
   * verschieben, und sieht er dafuer in jeden Teil des Plans, schreibt die
   * Schnittstelle trotzdem nichts ausser Frage und Antwort.
   */
  it("aendert nichts an der Reise, auch wenn der Chat um eine Aenderung gebeten wird", async () => {
    const vorher = await testDb.pool.query(
      `select id, start_at, end_at from activity order by id`,
    );
    kiLiest(
      [
        { werkzeug: "reise_lesen", eingabe: {} },
        { werkzeug: "pois_lesen", eingabe: {} },
        {
          werkzeug: "tagesplan_lesen",
          eingabe: { datum: "2026-07-18", start_at: "2026-07-18 20:00" },
        },
        { werkzeug: "kosten_lesen", eingabe: { datum: "2026-07-18" } },
      ],
      ...textStuecke(
        " Verschieben kann ich nichts — das geht nur im Planer selbst.",
      ),
    );
    const geschrieben: string[] = [];
    const query = testDb.pool.query.bind(testDb.pool);
    vi.spyOn(testDb.pool, "query").mockImplementation(((
      sql: string,
      werte?: unknown[],
    ) => {
      if (/^\s*(insert|update|delete)/i.test(sql)) geschrieben.push(sql);
      return query(sql, werte);
    }) as typeof testDb.pool.query);

    await frage("Verschieb bitte das Abendessen auf 20 Uhr.");

    vi.mocked(testDb.pool.query).mockRestore();
    expect(
      geschrieben.every((sql) =>
        // Ausser Frage und Antwort schreibt nur die Anmeldung -- sie
        // verlaengert die Sitzung bei jeder Anfrage.
        /into chat_nachricht|into chat_quelle|^update session /.test(sql),
      ),
    ).toBe(true);
    const nachher = await testDb.pool.query(
      `select id, start_at, end_at from activity order by id`,
    );
    expect(nachher.rows).toEqual(vorher.rows);
  });
});

/**
 * Ohne Anthropic-Zugangsschluessel ist die Funktion fuer diesen Account
 * gesperrt (req-028) -- geprueft serverseitig, nicht nur in der Oberflaeche.
 * Der Schluessel 'ki_suche' taugt dafuer nicht: er ist ein OpenAI-Schluessel.
 */
describe("Frage senden ohne Zugangsschluessel (req-081, req-028)", () => {
  it("fragt gar nicht erst", async () => {
    await angemeldet();
    kiAntwortet(...textStuecke("Gern."));

    const response = await POST(
      senden({
        tripId: SUEDITALIEN_ID,
        text: "Hallo",
        modell: "claude-sonnet-5",
      }),
    );

    expect(response.status).toBe(409);
    expect(aussen.createAnthropicChatClient).not.toHaveBeenCalled();
    expect(
      await listChatNachrichten(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID),
    ).toEqual([]);
  });

  it("bleibt bei derselben Abweisung, auch seit der Chat im Web sucht (req-092)", async () => {
    await angemeldet();
    kiAntwortet({ art: "suche" }, ...textStuecke("Gern."));

    const response = await POST(
      senden({
        tripId: SUEDITALIEN_ID,
        text: "Wann hat das Museum geöffnet?",
        modell: "claude-sonnet-5",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "kein Zugangsschluessel" });
    expect(aussen.createAnthropicChatClient).not.toHaveBeenCalled();
  });

  it("greift nicht auf den Schluessel der KI-Suche zurueck", async () => {
    await angemeldet();
    await storeAccountApiKey(
      testDb.pool,
      ACCOUNT_ID,
      "ki_suche",
      "sk-openai-1234",
      NOW,
    );
    kiAntwortet(...textStuecke("Gern."));

    const response = await POST(
      senden({
        tripId: SUEDITALIEN_ID,
        text: "Hallo",
        modell: "claude-sonnet-5",
      }),
    );

    expect(response.status).toBe(409);
  });
});

/**
 * Ein Fehler wird benannt und nicht verschluckt (bug-032): der Grund steht im
 * Verlauf, und die Frage bleibt erhalten, damit sie sich erneut senden laesst.
 */
describe("Wenn eine Antwort fehlschlaegt (req-081)", () => {
  beforeEach(async () => {
    await angemeldet();
    await mitSchluessel();
  });

  it("schickt den Grund statt einer Antwort", async () => {
    kiAntwortet({
      art: "fehler",
      fehler: { art: "kontingent", detail: "rate limited" },
    });

    const ereignisse = await frage("Hallo");

    expect(ereignisse.map((ereignis) => ereignis.art)).toEqual([
      "frage",
      "fehler",
    ]);
    expect(ereignisse[1]).toEqual({ art: "fehler", grund: "kontingent" });
  });

  it("laesst die Frage im Verlauf stehen", async () => {
    kiAntwortet({
      art: "fehler",
      fehler: { art: "netz", detail: "network down" },
    });

    await frage("Nicht verloren gehen");

    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(verlauf.map((nachricht) => nachricht.text)).toEqual([
      "Nicht verloren gehen",
    ]);
  });

  /**
   * Bricht es mitten im Strom ab, bleibt kein Bruchstueck im Verlauf stehen:
   * die Frage soll sich erneut senden lassen, ohne eine halbe Antwort davor.
   */
  it("legt eine halbe Antwort nicht ab", async () => {
    kiAntwortet(
      { art: "text", text: "Die Hälfte" },
      { art: "fehler", fehler: { art: "dienst", detail: "boom" } },
    );

    const ereignisse = await frage("Hallo");

    expect(ereignisse.map((ereignis) => ereignis.art)).toEqual([
      "frage",
      "text",
      "fehler",
    ]);
    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(verlauf.map((nachricht) => nachricht.rolle)).toEqual(["ich"]);
  });

  it("nimmt dieselbe Frage danach erneut an", async () => {
    kiAntwortet({
      art: "fehler",
      fehler: { art: "netz", detail: "network down" },
    });
    await frage("Erneut versuchen");
    kiAntwortet(...textStuecke("Diesmal klappt es."));

    const ereignisse = await frage("Erneut versuchen");

    expect(ereignisse.at(-1)?.art).toBe("antwort");
    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(
      verlauf.map((nachricht) => [nachricht.rolle, nachricht.text]),
    ).toEqual([
      ["ich", "Erneut versuchen"],
      ["ich", "Erneut versuchen"],
      ["ki", "Diesmal klappt es."],
    ]);
  });

  /**
   * Der erneute Versuch aus dem Chatfenster legt die Frage nicht ein zweites
   * Mal ab: sie steht nach dem Fehlschlag schon im Verlauf (req-081).
   */
  it("legt eine wiederholte Frage nicht ein zweites Mal ab", async () => {
    kiAntwortet({
      art: "fehler",
      fehler: { art: "netz", detail: "network down" },
    });
    await frage("Erneut versuchen");
    const antworte = kiAntwortet(...textStuecke("Diesmal klappt es."));

    const ereignisse = await ereignisseAus(
      await POST(
        senden({
          tripId: SUEDITALIEN_ID,
          text: "Erneut versuchen",
          modell: "claude-sonnet-5",
          wiederholen: true,
        }),
      ),
    );

    expect(ereignisse.at(-1)?.art).toBe("antwort");
    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(
      verlauf.map((nachricht) => [nachricht.rolle, nachricht.text]),
    ).toEqual([
      ["ich", "Erneut versuchen"],
      ["ki", "Diesmal klappt es."],
    ]);
    // Und auch dem Dienst geht sie genau einmal zu.
    expect(antworte).toHaveBeenCalledWith(
      expect.objectContaining({
        verlauf: [{ rolle: "ich", text: "Erneut versuchen" }],
      }),
    );
  });

  /**
   * Das Kennzeichen kann den Verlauf nicht verbiegen: passt die Frage nicht
   * zur letzten unbeantworteten, wird sie ganz normal angelegt.
   */
  it("legt eine wiederholte, aber andere Frage normal ab", async () => {
    kiAntwortet({
      art: "fehler",
      fehler: { art: "netz", detail: "network down" },
    });
    await frage("Erste Frage");
    kiAntwortet(...textStuecke("Antwort"));

    await ereignisseAus(
      await POST(
        senden({
          tripId: SUEDITALIEN_ID,
          text: "Etwas anderes",
          modell: "claude-sonnet-5",
          wiederholen: true,
        }),
      ),
    );

    const verlauf = await listChatNachrichten(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
    );
    expect(verlauf.map((nachricht) => nachricht.text)).toEqual([
      "Erste Frage",
      "Etwas anderes",
      "Antwort",
    ]);
  });
});

describe("Unterhaltung abrufen und verwerfen (req-081)", () => {
  beforeEach(async () => {
    await angemeldet();
    await mitSchluessel();
  });

  it("gibt die Unterhaltung in zeitlicher Folge heraus", async () => {
    kiAntwortet(...textStuecke("Antwort"));
    await frage("Frage");

    const verlauf = await verlaufAus(
      await GET(holen(`?tripId=${SUEDITALIEN_ID}`)),
    );

    expect(
      verlauf.map((nachricht) => [nachricht.rolle, nachricht.text]),
    ).toEqual([
      ["ich", "Frage"],
      ["ki", "Antwort"],
    ]);
  });

  it("gibt zu einer Reise ohne Unterhaltung nichts heraus", async () => {
    expect(await verlaufAus(await GET(holen(`?tripId=${WIEN_ID}`)))).toEqual(
      [],
    );
  });

  it("verwirft die Unterhaltung", async () => {
    kiAntwortet(...textStuecke("Antwort"));
    await frage("Frage");

    const response = await DELETE(senden({ tripId: SUEDITALIEN_ID }, "DELETE"));

    expect(response.status).toBe(200);
    expect(await verlaufAus(response)).toEqual([]);
    expect(
      await verlaufAus(await GET(holen(`?tripId=${SUEDITALIEN_ID}`))),
    ).toEqual([]);
  });
});
