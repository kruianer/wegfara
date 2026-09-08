// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
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
const { isPositionSharingEnabled } = await import("@/lib/db/position-sharing");
const { saveTripPosition } = await import("@/lib/db/trip-positions");
const { PATCH } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

function anfrage(body: unknown) {
  return new Request("https://dev.wegfara.com/api/position-teilen", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
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

describe("PATCH /api/position-teilen (req-050)", () => {
  it("verlangt eine Anmeldung", async () => {
    const antwort = await PATCH(
      anfrage({ tripId: SUEDITALIEN_ID, geteilt: true }),
    );

    expect(antwort.status).toBe(401);
  });

  it("schaltet die Freigabe ein", async () => {
    await angemeldet();

    const antwort = await PATCH(
      anfrage({ tripId: SUEDITALIEN_ID, geteilt: true }),
    );

    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toEqual({ geteilt: true });
    expect(
      await isPositionSharingEnabled(
        testDb.pool,
        ACCOUNT_ID,
        SUEDITALIEN_ID,
        PARTICIPANT_ID,
      ),
    ).toBe(true);
  });

  it("loescht beim Ausschalten die zuletzt geteilte Position", async () => {
    await angemeldet();
    await PATCH(anfrage({ tripId: SUEDITALIEN_ID, geteilt: true }));
    await saveTripPosition(
      testDb.pool,
      ACCOUNT_ID,
      SUEDITALIEN_ID,
      PARTICIPANT_ID,
      { lat: 40.6114, lng: 14.6896 },
      new Date(),
    );

    const antwort = await PATCH(
      anfrage({ tripId: SUEDITALIEN_ID, geteilt: false }),
    );

    expect(await antwort.json()).toEqual({ geteilt: false });
    const { listTripPositions } = await import("@/lib/db/trip-positions");
    expect(
      await listTripPositions(testDb.pool, ACCOUNT_ID, SUEDITALIEN_ID),
    ).toEqual([]);
  });

  it("kennt keine Reise eines fremden Accounts", async () => {
    await angemeldet();

    const antwort = await PATCH(
      anfrage({ tripId: crypto.randomUUID(), geteilt: true }),
    );

    expect(antwort.status).toBe(404);
  });

  it("verlangt eine gueltige Anfrage", async () => {
    await angemeldet();

    expect((await PATCH(anfrage({ tripId: SUEDITALIEN_ID }))).status).toBe(400);
    expect((await PATCH(anfrage({ geteilt: true }))).status).toBe(400);
  });
});
