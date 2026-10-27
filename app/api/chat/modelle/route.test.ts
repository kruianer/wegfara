// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { KatalogErgebnis, KatalogModell } from "@/lib/ai/modell-katalog";
import type { ChatModelleAntwort } from "@/lib/chat/senden";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));
// Externe Dienste werden in Tests gemockt (siehe stack.md, Testing) -- kein
// Test darf im Netz haengen oder Kosten verursachen.
const aussen = vi.hoisted(() => ({
  createAnthropicModellKatalog: vi.fn(),
  liste: vi.fn(),
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

const { createSession } = await import("@/lib/db/sessions");
const { storeAccountApiKey } = await import("@/lib/api-keys/account-keys");
const { clearChatModellCache } = await import(
  "@/lib/chat/modell-katalog-cache"
);
const { GET } = await import("./route");

const NOW = new Date("2026-10-27T10:00:00Z");

function modell(
  id: string,
  name: string,
  reihe: string | null,
  lebenslauf: KatalogModell["lebenslauf"] = "active",
): KatalogModell {
  return { id, name, reihe, lebenslauf, maxEingabeTokens: 200000 };
}

/** Fuenf aktive Modelle, ein abgekuendigtes, ein abgeschaltetes. */
const KATALOG: KatalogModell[] = [
  modell("claude-opus-5-5", "Claude Opus 5.5", "opus"),
  modell("claude-sonnet-5-5", "Claude Sonnet 5.5", "sonnet"),
  modell("claude-haiku-5-5", "Claude Haiku 5.5", "haiku"),
  modell("claude-opus-5", "Claude Opus 5", "opus"),
  modell("claude-sonnet-5", "Claude Sonnet 5", "sonnet"),
  modell("claude-haiku-4-5", "Claude Haiku 4.5", "haiku", "deprecated"),
  modell("claude-opus-4-1", "Claude Opus 4.1", "opus", "retired"),
];

function dienstNennt(ergebnis: KatalogErgebnis) {
  aussen.liste.mockResolvedValue(ergebnis);
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", NOW);
  cookieJar.werte[SESSION_COOKIE] = "token-1";
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

async function antwort(): Promise<ChatModelleAntwort> {
  const response = await GET();
  expect(response.status).toBe(200);
  return (await response.json()) as ChatModelleAntwort;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  clearChatModellCache();
  aussen.liste.mockReset();
  aussen.createAnthropicModellKatalog.mockReset();
  aussen.createAnthropicModellKatalog.mockImplementation(() => ({
    liste: aussen.liste,
  }));
  vi.stubEnv("AUTH_SECRET", "geheim-fuer-den-test");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Modellauswahl des Chats (req-090)", () => {
  it("weist ohne Anmeldung ab", async () => {
    expect((await GET()).status).toBe(401);
    expect(aussen.createAnthropicModellKatalog).not.toHaveBeenCalled();
  });

  it("nennt genau die aktiven Modelle des Dienstes, in seiner Reihenfolge", async () => {
    await angemeldet();
    await mitSchluessel();
    dienstNennt({ modelle: KATALOG, fehler: null });

    const { modelle } = await antwort();

    expect(modelle?.map((eintrag) => eintrag.id)).toEqual([
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
      "claude-opus-5",
      "claude-sonnet-5",
    ]);
    expect(modelle?.[1].name).toBe("Claude Sonnet 5.5");
  });

  it("fragt mit dem Schluessel des Accounts", async () => {
    await angemeldet();
    await mitSchluessel();
    dienstNennt({ modelle: KATALOG, fehler: null });

    await antwort();

    expect(aussen.createAnthropicModellKatalog).toHaveBeenCalledWith({
      apiKey: "sk-ant-a3f9",
    });
  });

  it("fragt beim erneuten Oeffnen nicht erneut beim Dienst", async () => {
    await angemeldet();
    await mitSchluessel();
    dienstNennt({ modelle: KATALOG, fehler: null });

    await antwort();
    const zweite = await antwort();

    expect(zweite.modelle).toHaveLength(5);
    expect(aussen.liste).toHaveBeenCalledTimes(1);
  });

  it("sagt, wenn die Liste gerade nicht zu holen ist", async () => {
    await angemeldet();
    await mitSchluessel();
    dienstNennt({
      modelle: null,
      fehler: { art: "dienst", detail: "Overloaded" },
    });

    expect(await antwort()).toEqual({ modelle: null, grund: "dienst" });
  });

  it("nennt ohne Zugangsschluessel den Schluessel als Grund und fragt nicht", async () => {
    await angemeldet();

    expect(await antwort()).toEqual({ modelle: null, grund: "schluessel" });
    expect(aussen.createAnthropicModellKatalog).not.toHaveBeenCalled();
  });

  it("legt die Antwort nicht im Browser ab", async () => {
    await angemeldet();
    await mitSchluessel();
    dienstNennt({ modelle: KATALOG, fehler: null });

    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
  });
});
