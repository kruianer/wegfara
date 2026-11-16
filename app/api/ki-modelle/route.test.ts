// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type {
  KatalogErgebnis,
  KatalogModell,
  OpenAiKatalogModell,
} from "@/lib/ai/modell-katalog";
import type { KiModellFeld, KiZweck } from "@/lib/ki-modelle/zwecke";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
// Externe Dienste werden in Tests gemockt (siehe stack.md, Testing) -- kein
// Test darf im Netz haengen oder Kosten verursachen.
const aussen = vi.hoisted(() => ({
  createOpenAiModellKatalog: vi.fn(),
  openAiListe: vi.fn(),
  createAnthropicModellKatalog: vi.fn(),
  anthropicListe: vi.fn(),
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));
vi.mock("@/lib/ai/anthropic-client", () => ({
  createAnthropicModellKatalog: aussen.createAnthropicModellKatalog,
}));
vi.mock("@/lib/ai/openai-client", async (original) => ({
  ...(await original<typeof import("@/lib/ai/openai-client")>()),
  createOpenAiModellKatalog: aussen.createOpenAiModellKatalog,
}));

const { createSession } = await import("@/lib/db/sessions");
const { createParticipant } = await import("@/lib/db/participants");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { createAccountWithFirstPerson } = await import(
  "@/lib/accounts/create-account"
);
const { findAccountKiModelle } = await import("@/lib/db/account-ki-modelle");
const { clearChatModellCache, KATALOG_HOECHSTALTER_MS } = await import(
  "@/lib/chat/modell-katalog-cache"
);
const { clearVerschwundeneModelle } = await import(
  "@/lib/ki-modelle/verschwunden"
);
const { GET, PUT } = await import("./route");

const NOW = new Date("2026-11-16T10:00:00Z");

/**
 * Was OpenAI nennt (req-108): ein Textmodell und ein Bildmodell ohne Datum,
 * eines mit kuenftigem und eines mit vergangenem Abschaltdatum -- das bei
 * bug-076 abgeschaltete Bildmodell.
 */
const OPENAI: OpenAiKatalogModell[] = [
  { id: "gpt-5.6-luna", abschaltungAm: null },
  { id: "gpt-image-2.5-flare", abschaltungAm: null },
  { id: "gpt-4.1-mini", abschaltungAm: "2027-03-12" },
  { id: "gpt-image-1", abschaltungAm: "2026-10-23" },
];

function anthropicModell(
  id: string,
  name: string,
  reihe: string,
  lebenslauf: KatalogModell["lebenslauf"] = "active",
): KatalogModell {
  return { id, name, reihe, lebenslauf, maxEingabeTokens: 200000 };
}

const ANTHROPIC: KatalogModell[] = [
  anthropicModell("claude-opus-5-5", "Claude Opus 5.5", "opus"),
  anthropicModell("claude-sonnet-5-5", "Claude Sonnet 5.5", "sonnet"),
  anthropicModell(
    "claude-haiku-4-5",
    "Claude Haiku 4.5",
    "haiku",
    "deprecated",
  ),
  anthropicModell("claude-opus-4-1", "Claude Opus 4.1", "opus", "retired"),
];

function openAiNennt(ergebnis: KatalogErgebnis<OpenAiKatalogModell>) {
  aussen.openAiListe.mockResolvedValue(ergebnis);
}

const SCHWEIGT = {
  modelle: null,
  fehler: { art: "netz" as const, detail: "Connection error." },
};

async function angemeldet(teilnehmer = PARTICIPANT_ID, token = "token-1") {
  await createSession(testDb.pool, teilnehmer, token, NOW);
  cookieJar.werte[SESSION_COOKIE] = token;
}

async function mitSchluessel(
  kind: "ki_suche" | "anthropic",
  accountId = ACCOUNT_ID,
) {
  await storeAccountApiKey(
    testDb.pool,
    accountId,
    kind,
    kind === "ki_suche" ? "sk-test-a3f9" : "sk-ant-b7c1",
    NOW,
  );
}

async function felder(): Promise<KiModellFeld[]> {
  const response = await GET();
  expect(response.status).toBe(200);
  return ((await response.json()) as { felder: KiModellFeld[] }).felder;
}

function feld(liste: KiModellFeld[], zweck: KiZweck): KiModellFeld {
  return liste.find((eintrag) => eintrag.zweck === zweck)!;
}

function waehle(zweck: KiZweck, modell: string | null) {
  return PUT(
    new Request("https://dev.wegfara.com/api/ki-modelle", {
      method: "PUT",
      body: JSON.stringify({ zweck, modell }),
    }),
  );
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  clearChatModellCache();
  clearVerschwundeneModelle();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  for (const mock of Object.values(aussen)) mock.mockReset();
  aussen.createOpenAiModellKatalog.mockImplementation(() => ({
    liste: aussen.openAiListe,
  }));
  aussen.createAnthropicModellKatalog.mockImplementation(() => ({
    liste: aussen.anthropicListe,
  }));
  openAiNennt({ modelle: OPENAI, fehler: null });
  aussen.anthropicListe.mockResolvedValue({ modelle: ANTHROPIC, fehler: null });
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  vi.stubEnv("OPENAI_MODEL", "");
  vi.stubEnv("OPENAI_IMAGE_MODEL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  return () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  };
});

describe("GET /api/ki-modelle (req-108)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET()).status).toBe(401);
  });

  it("weist eine Person ohne die Kennzeichnung Account-Admin ab", async () => {
    const person = await createParticipant(
      testDb.pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: "clara@example.com",
        phone: null,
        iban: null,
      },
      NOW,
    );
    await angemeldet(person.id, "token-2");

    expect((await GET()).status).toBe(403);
  });

  it("liefert mit ki_suche-Schluessel drei Felder", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    await mitSchluessel("anthropic");

    expect((await felder()).map((eintrag) => eintrag.zweck)).toEqual([
      "fragen",
      "bilder",
      "chat",
    ]);
  });

  it("nennt die Modelle, die der Dienst nennt -- gefragt mit dem Schluessel des Accounts", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    openAiNennt({
      modelle: [{ id: "ein-modell-nur-vom-dienst", abschaltungAm: null }],
      fehler: null,
    });

    const liste = await felder();

    expect(aussen.createOpenAiModellKatalog).toHaveBeenCalledWith({
      apiKey: "sk-test-a3f9",
    });
    for (const zweck of ["fragen", "bilder"] as const) {
      expect(feld(liste, zweck).modelle?.map((m) => m.id)).toEqual([
        "ein-modell-nur-vom-dienst",
      ]);
    }
  });

  it("sagt ohne ki_suche-Schluessel, welcher fehlt, und listet keine Modelle", async () => {
    await angemeldet();

    const liste = await felder();

    for (const zweck of ["fragen", "bilder"] as const) {
      expect(feld(liste, zweck)).toMatchObject({
        grund: "schluessel",
        modelle: null,
      });
    }
    expect(feld(liste, "chat")).toMatchObject({
      grund: "schluessel",
      modelle: null,
    });
    expect(aussen.createOpenAiModellKatalog).not.toHaveBeenCalled();
    expect(aussen.createAnthropicModellKatalog).not.toHaveBeenCalled();
  });

  it("laesst ein Modell mit vergangenem shutdown_date weg", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");

    const ids = feld(await felder(), "bilder").modelle?.map((m) => m.id);

    expect(ids).not.toContain("gpt-image-1");
    expect(ids).toContain("gpt-image-2.5-flare");
  });

  it("nimmt ein Modell mit kuenftigem shutdown_date auf, mit seinem Datum", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");

    expect(
      feld(await felder(), "fragen").modelle?.find(
        (m) => m.id === "gpt-4.1-mini",
      ),
    ).toEqual({
      id: "gpt-4.1-mini",
      name: "gpt-4.1-mini",
      abschaltungAm: "2027-03-12",
    });
  });

  it("laesst bei Anthropic abgekuendigte und abgeschaltete Modelle weg", async () => {
    await angemeldet();
    await mitSchluessel("anthropic");

    expect(feld(await felder(), "chat").modelle?.map((m) => m.id)).toEqual([
      "claude-opus-5-5",
      "claude-sonnet-5-5",
    ]);
  });

  it("fragt beim zweiten Oeffnen innerhalb von sechs Stunden nicht erneut", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    await mitSchluessel("anthropic");

    await felder();
    vi.setSystemTime(NOW.getTime() + KATALOG_HOECHSTALTER_MS - 60_000);
    await felder();

    expect(aussen.openAiListe).toHaveBeenCalledTimes(1);
    expect(aussen.anthropicListe).toHaveBeenCalledTimes(1);
  });

  it("zeigt beim Ausfall des Dienstes den gemerkten Katalog und sagt, dass er gemerkt ist", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    await felder();

    openAiNennt(SCHWEIGT);
    vi.setSystemTime(NOW.getTime() + KATALOG_HOECHSTALTER_MS + 60_000);
    const fragen = feld(await felder(), "fragen");

    expect(aussen.openAiListe).toHaveBeenCalledTimes(2);
    expect(fragen.modelle?.map((m) => m.id)).toContain("gpt-5.6-luna");
    expect(fragen.gemerktAm).toBe(NOW.toISOString());
  });

  it("sagt beim Ausfall ohne gemerkten Katalog, dass die Liste fehlt", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    openAiNennt(SCHWEIGT);

    expect(feld(await felder(), "fragen")).toMatchObject({
      grund: "dienst",
      modelle: null,
      gemerktAm: null,
    });
  });

  it("nennt ein gewaehltes Modell, das der Dienst nicht mehr nennt, mit Namen", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    await waehle("bilder", "gpt-image-2.5-flare");
    clearChatModellCache();
    openAiNennt({
      modelle: OPENAI.filter((m) => m.id !== "gpt-image-2.5-flare"),
      fehler: null,
    });

    const bilder = feld(await felder(), "bilder");

    expect(bilder.gewaehlt).toBe("gpt-image-2.5-flare");
    expect(bilder.verschwunden).toBe("gpt-image-2.5-flare");
  });

  it("meldet nichts, solange das eingestellte Modell dasteht", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");

    const liste = await felder();

    expect(feld(liste, "fragen").verschwunden).toBeNull();
    expect(feld(liste, "bilder").verschwunden).toBeNull();
  });

  it("nennt, was ohne Wahl gilt: die Umgebung", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2.5-flare");

    expect(feld(await felder(), "bilder").ohneWahl).toBe("gpt-image-2.5-flare");
  });
});

describe("PUT /api/ki-modelle (req-108)", () => {
  it("speichert die Wahl und liefert den neuen Stand", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");

    const response = await waehle("fragen", "gpt-4.1-mini");

    expect(response.status).toBe(200);
    const { felder: neu } = (await response.json()) as {
      felder: KiModellFeld[];
    };
    expect(feld(neu, "fragen").gewaehlt).toBe("gpt-4.1-mini");
    expect((await findAccountKiModelle(testDb.pool, ACCOUNT_ID)).fragen).toBe(
      "gpt-4.1-mini",
    );
  });

  it("hebt die Wahl mit null wieder auf", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");
    await waehle("fragen", "gpt-4.1-mini");

    expect((await waehle("fragen", null)).status).toBe(200);
    expect(
      (await findAccountKiModelle(testDb.pool, ACCOUNT_ID)).fragen,
    ).toBeNull();
  });

  it("speichert kein Modell, das der Dienst nicht zur Wahl nennt", async () => {
    await angemeldet();
    await mitSchluessel("ki_suche");

    const response = await waehle("bilder", "gpt-image-1");

    expect(response.status).toBe(409);
    expect(
      (await findAccountKiModelle(testDb.pool, ACCOUNT_ID)).bilder,
    ).toBeNull();
  });

  it("weist einen unbekannten Zweck ab", async () => {
    await angemeldet();

    expect((await waehle("musik" as KiZweck, "gpt-5.6-luna")).status).toBe(400);
  });

  it("gibt jedem Account seine eigene Wahl", async () => {
    const zweiter = await createAccountWithFirstPerson(
      testDb.pool,
      {
        name: "Familie Huber",
        personName: "Anna Huber",
        personEmail: "anna@huber.de",
      },
      NOW,
    );
    const { rows } = await testDb.pool.query(
      `select id from participant where email = 'anna@huber.de'`,
    );
    await mitSchluessel("ki_suche");
    await mitSchluessel("ki_suche", zweiter!.id);

    await angemeldet();
    await waehle("fragen", "gpt-4.1-mini");
    await angemeldet((rows[0] as { id: string }).id, "token-anna");
    await waehle("fragen", "gpt-5.6-luna");

    expect((await findAccountKiModelle(testDb.pool, ACCOUNT_ID)).fragen).toBe(
      "gpt-4.1-mini",
    );
    expect((await findAccountKiModelle(testDb.pool, zweiter!.id)).fragen).toBe(
      "gpt-5.6-luna",
    );
    expect(feld(await felder(), "fragen").gewaehlt).toBe("gpt-5.6-luna");
  });
});
