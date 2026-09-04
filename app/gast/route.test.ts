// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { guestAccessExpiresAt } from "@/lib/guests/duration";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));

const { createGuestAccess, findGuestSessionByToken, revokeGuestAccess } =
  await import("@/lib/db/guest-access");
const { findSessionByToken } = await import("@/lib/db/sessions");
const { GET } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date();

function aufruf(token: string) {
  const url = new URL("https://dev.wegfara.com/gast");
  url.searchParams.set("token", token);
  return new Request(url, { headers: { "x-forwarded-proto": "https" } });
}

function gastzugang(token: string, stunden = 7 * 24) {
  return createGuestAccess(
    testDb.pool,
    {
      accountId: ACCOUNT_ID,
      tripId: SUEDITALIEN_ID,
      createdBy: PARTICIPANT_ID,
      purpose: "Nachbarin Eva",
      token,
      expiresAt: guestAccessExpiresAt(NOW, stunden),
    },
    NOW,
  );
}

/** Das Sitzungs-Token aus dem Set-Cookie der Antwort. */
function tokenAusCookie(response: Response): string {
  const gesetzt = response.headers.get("set-cookie") ?? "";
  return decodeURIComponent(
    gesetzt.split(";")[0].slice(`${SESSION_COOKIE}=`.length),
  );
}

beforeEach(() => {
  testDb.pool = createTestDb();
  // Die Zieladresse stammt aus APP_URL, nicht aus der Adresse der Anfrage
  // (bug-008).
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("GET /gast (req-038)", () => {
  it("laesst den Gast ohne Passkey herein und fuehrt in den Begleiter", async () => {
    await gastzugang("gastlink");

    const response = await GET(aufruf("gastlink"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://dev.wegfara.com/go");
    expect(response.headers.get("set-cookie")).toContain(SESSION_COOKIE);
  });

  it("legt eine Gast-Sitzung an, die nie als Teilnehmer-Sitzung durchgeht", async () => {
    await gastzugang("gastlink");

    const token = tokenAusCookie(await GET(aufruf("gastlink")));

    expect(
      await findGuestSessionByToken(testDb.pool, token, NOW),
    ).toMatchObject({ tripId: SUEDITALIEN_ID });
    // Der entscheidende Punkt: die Anmeldung der Teilnehmer kennt dieses
    // Token nicht -- damit weist jede bestehende Schnittstelle den Gast ab.
    expect(await findSessionByToken(testDb.pool, token, NOW)).toBeNull();
  });

  it("weist einen widerrufenen Link ab", async () => {
    const access = await gastzugang("gastlink");
    await revokeGuestAccess(testDb.pool, ACCOUNT_ID, access!.id, NOW);

    const response = await GET(aufruf("gastlink"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung?fehler=gastzugang",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("weist einen abgelaufenen Link ab", async () => {
    await createGuestAccess(
      testDb.pool,
      {
        accountId: ACCOUNT_ID,
        tripId: SUEDITALIEN_ID,
        createdBy: PARTICIPANT_ID,
        purpose: "Nachbarin Eva",
        token: "abgelaufen",
        expiresAt: new Date(NOW.getTime() - 1000),
      },
      NOW,
    );

    const response = await GET(aufruf("abgelaufen"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung?fehler=gastzugang",
    );
  });

  it("weist ein unbekanntes und ein fehlendes Token ab", async () => {
    await gastzugang("gastlink");

    expect((await GET(aufruf("anderes"))).headers.get("location")).toContain(
      "fehler=gastzugang",
    );
    expect(
      (await GET(new Request("https://dev.wegfara.com/gast"))).headers.get(
        "location",
      ),
    ).toContain("fehler=gastzugang");
  });
});
