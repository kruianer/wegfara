// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { GUEST_ACCESS_MAX_HOURS } from "@/lib/guests/duration";
import type { GuestAccess, GuestLink } from "@/lib/guests/types";

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
const { createParticipant, setAccountAdmin } = await import(
  "@/lib/db/participants"
);
const { assignTripParticipant } = await import("@/lib/db/trip-participants");
const { createAccount } = await import("@/lib/db/accounts");
const { createTrip } = await import("@/lib/db/trips");
const { createGuestAccess, findGuestAccess, startGuestSession } = await import(
  "@/lib/db/guest-access"
);
const { GET, POST, DELETE } = await import("./route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date();

function anfrage(method: "POST" | "DELETE", body: unknown) {
  return new Request("https://dev.wegfara.com/api/gastzugaenge", {
    method,
    body: JSON.stringify(body),
  });
}

/** Der Betreiber -- Account-Admin und Reiseleiter der Demo-Reise. */
async function angemeldet(token = "token-1") {
  await createSession(testDb.pool, PARTICIPANT_ID, token, NOW);
  cookieJar.werte[SESSION_COOKIE] = token;
}

/** Clara Berger: Teilnehmerin ohne Kennzeichnung, nicht Reiseleiterin. */
async function claraAngemeldet() {
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
  await assignTripParticipant(
    testDb.pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    person.id,
    "teilnehmer",
  );
  await createSession(testDb.pool, person.id, "clara-token", NOW);
  cookieJar.werte[SESSION_COOKIE] = "clara-token";
  return person;
}

beforeEach(() => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("POST /api/gastzugaenge (req-038)", () => {
  it("weist ohne Anmeldung ab", async () => {
    const response = await POST(
      anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Eva" }),
    );

    expect(response.status).toBe(401);
  });

  it("liefert dem Reiseleiter Link und QR-Code -- genau einmal", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Nachbarin Eva" }),
    );

    expect(response.status).toBe(201);
    const { link } = (await response.json()) as { link: GuestLink };
    expect(link.url).toContain("https://dev.wegfara.com/gast?token=");
    expect(link.qr.path.length).toBeGreaterThan(0);
    expect(link.guestAccess.purpose).toBe("Nachbarin Eva");

    // Danach nie wieder: die Liste kennt das Geheimnis nicht.
    const liste = await GET();
    const { guestAccesses } = (await liste.json()) as {
      guestAccesses: GuestAccess[];
    };
    expect(JSON.stringify(guestAccesses)).not.toContain("token=");
  });

  it("gilt ohne gewaehlte Dauer sieben Tage", async () => {
    await angemeldet();
    const vorher = Date.now();

    const response = await POST(
      anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Eva" }),
    );
    const { link } = (await response.json()) as { link: GuestLink };

    const gueltigMs = new Date(link.guestAccess.expiresAt).getTime() - vorher;
    const siebenTageMs = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(gueltigMs - siebenTageMs)).toBeLessThan(5_000);
  });

  it("lehnt mehr als 90 Tage ab", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", {
        tripId: SUEDITALIEN_ID,
        purpose: "Eva",
        stunden: GUEST_ACCESS_MAX_HOURS + 1,
      }),
    );

    expect(response.status).toBe(400);
  });

  it("lehnt einen Gastzugang ohne Zweck ab", async () => {
    await angemeldet();

    const response = await POST(
      anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "  " }),
    );

    expect(response.status).toBe(400);
  });

  it("weist einen Teilnehmer ohne Reiseleiter-Rolle ab", async () => {
    await claraAngemeldet();

    const response = await POST(
      anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Eva" }),
    );

    expect(response.status).toBe(403);
  });

  it("laesst einen Bereichs-Admin auch fremde Reisen des Bereichs freigeben", async () => {
    const clara = await claraAngemeldet();
    await setAccountAdmin(testDb.pool, ACCOUNT_ID, clara.id, true);

    const response = await POST(
      anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Eva" }),
    );

    expect(response.status).toBe(201);
  });

  it("weist eine Reise eines fremden Accounts ab", async () => {
    await angemeldet();
    const fremder = await createAccount(
      testDb.pool,
      "Familie Berger",
      "b@example.com",
    );
    const fremdeReise = await createTrip(testDb.pool, fremder.id, {
      title: "Fremde Reise",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      mainPlace: { name: "Graz", lat: 47.07, lng: 15.44 },
      description: "",
    });

    const response = await POST(
      anfrage("POST", { tripId: fremdeReise.id, purpose: "Eva" }),
    );

    expect(response.status).toBe(403);
  });
});

describe("GET /api/gastzugaenge (req-038)", () => {
  it("weist ohne Anmeldung ab", async () => {
    expect((await GET()).status).toBe(401);
  });

  it("zeigt dem Reiseleiter Zweck, Reise, Ablauf, Verwendung und Status", async () => {
    await angemeldet();
    await POST(anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Eva" }));

    const { guestAccesses } = (await (await GET()).json()) as {
      guestAccesses: GuestAccess[];
    };

    expect(guestAccesses).toHaveLength(1);
    expect(guestAccesses[0]).toMatchObject({
      purpose: "Eva",
      tripTitle: "Süditalien Rundreise",
      lastUsedAt: null,
      status: "aktiv",
    });
    expect(guestAccesses[0].expiresAt).toBeTruthy();
  });

  it("zeigt einem Teilnehmer ohne eigene Reise keinen Gastzugang", async () => {
    await angemeldet();
    await POST(anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Eva" }));
    await claraAngemeldet();

    const { guestAccesses } = (await (await GET()).json()) as {
      guestAccesses: GuestAccess[];
    };

    expect(guestAccesses).toEqual([]);
  });
});

describe("DELETE /api/gastzugaenge (req-038)", () => {
  async function erstellt(): Promise<string> {
    const response = await POST(
      anfrage("POST", { tripId: SUEDITALIEN_ID, purpose: "Eva" }),
    );
    const { link } = (await response.json()) as { link: GuestLink };
    return link.guestAccess.id;
  }

  it("widerruft den Zugang und beendet die laufende Gast-Sitzung sofort", async () => {
    await angemeldet();
    const token = "gastlink";
    const access = await createGuestAccess(
      testDb.pool,
      {
        accountId: ACCOUNT_ID,
        tripId: SUEDITALIEN_ID,
        createdBy: PARTICIPANT_ID,
        purpose: "Eva",
        token,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      NOW,
    );
    await startGuestSession(testDb.pool, token, NOW);

    const response = await DELETE(anfrage("DELETE", { id: access!.id }));

    expect(response.status).toBe(200);
    const { rows } = await testDb.pool.query(
      `select id from guest_session`,
      [],
    );
    expect(rows).toHaveLength(0);
  });

  it("weist einen Teilnehmer ohne Reiseleiter-Rolle ab", async () => {
    await angemeldet();
    const id = await erstellt();
    await claraAngemeldet();

    expect((await DELETE(anfrage("DELETE", { id }))).status).toBe(403);
    expect(
      (await findGuestAccess(testDb.pool, ACCOUNT_ID, id, NOW))?.status,
    ).toBe("aktiv");
  });

  it("kennt einen Gastzugang eines fremden Accounts nicht", async () => {
    await angemeldet();
    const fremder = await createAccount(
      testDb.pool,
      "Familie Berger",
      "b@example.com",
    );
    const fremdeReise = await createTrip(testDb.pool, fremder.id, {
      title: "Fremde Reise",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      mainPlace: { name: "Graz", lat: 47.07, lng: 15.44 },
      description: "",
    });
    const fremd = await createGuestAccess(
      testDb.pool,
      {
        accountId: fremder.id,
        tripId: fremdeReise.id,
        createdBy: PARTICIPANT_ID,
        purpose: "Fremd",
        token: "fremd-token",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      NOW,
    );

    const response = await DELETE(anfrage("DELETE", { id: fremd!.id }));

    expect(response.status).toBe(404);
    expect(
      (await findGuestAccess(testDb.pool, fremder.id, fremd!.id, NOW))?.status,
    ).toBe("aktiv");
  });

  it("weist ohne Anmeldung ab", async () => {
    expect((await DELETE(anfrage("DELETE", { id: "egal" }))).status).toBe(401);
  });
});
