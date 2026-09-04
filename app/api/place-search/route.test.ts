// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
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
const { GET } = await import("./route");

const FLORENZ = {
  name: "Florenz",
  display_name: "Florenz, Toskana, Italien",
  lat: "43.7698712",
  lon: "11.2555757",
  address: { state: "Toskana", country: "Italien" },
};

function anfrage(query: string) {
  return new Request(
    `https://dev.wegfara.com/api/place-search?q=${encodeURIComponent(query)}`,
  );
}

async function angemeldet() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-1", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-1";
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
});

describe("GET /api/place-search (req-017)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET(anfrage("Floren"))).status).toBe(401);
  });

  it("liefert die Ortsvorschlaege zur Eingabe", async () => {
    await angemeldet();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [FLORENZ] })),
    );

    const response = await GET(anfrage("Floren"));

    expect(await response.json()).toEqual({
      places: [
        {
          name: "Florenz",
          context: "Toskana, Italien",
          lat: 43.7698712,
          lng: 11.2555757,
          address: "",
        },
      ],
    });
  });

  it("liefert ohne Eingabe eine leere Liste, ohne Nominatim zu fragen", async () => {
    await angemeldet();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(anfrage(""));

    expect(await response.json()).toEqual({ places: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
