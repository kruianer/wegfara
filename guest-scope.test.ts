// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { guestAccessExpiresAt } from "@/lib/guests/duration";

/**
 * Was ein Gast NICHT darf (req-038).
 *
 * Ein Gastzugang gibt genau eine Reise frei, nur lesend. Der Schutz liegt
 * nicht in einer Aufzaehlung verbotener Schnittstellen, sondern im Aufbau:
 * eine Gast-Sitzung liegt in `guest_session` und wird von `currentSession()`
 * nie gefunden. Jede bestehende Schnittstelle weist ihn deshalb ab, ohne ihn
 * kennen zu muessen.
 *
 * Dieser Test haelt genau das fest -- einmal durch Aufrufen der
 * Schnittstellen mit einem Gast-Cookie, und einmal durch Lesen der Quellen,
 * damit keine neue Schnittstelle ohne diese Pruefung dazukommt.
 */

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

const { createGuestAccess, startGuestSession } = await import(
  "@/lib/db/guest-access"
);
const { currentSession } = await import("@/lib/auth/current-session");
const { currentGuest } = await import("@/lib/auth/current-guest");

const ausgaben = await import("@/app/api/ausgaben/route");
const dokumente = await import("@/app/api/dokumente/route");
const bankverbindung = await import("@/app/api/bankverbindung/route");
const poiSearch = await import("@/app/api/poi-search/route");
const poiAusLink = await import("@/app/api/poi-aus-link/route");
const pois = await import("@/app/api/pois/route");
const poiStatus = await import("@/app/api/poi-status/route");
const trips = await import("@/app/api/trips/route");
const participants = await import("@/app/api/participants/route");
const zugangsschluessel = await import("@/app/api/zugangsschluessel/route");
const accounts = await import("@/app/api/accounts/route");
const nutzer = await import("@/app/api/nutzer/route");
const einladungen = await import("@/app/api/nutzer/einladungen/route");
const gastzugaenge = await import("@/app/api/gastzugaenge/route");

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date();

function anfrage(url: string) {
  return new Request(`https://dev.wegfara.com${url}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Meldet einen Gast an -- mit demselben Cookie wie eine Person. */
async function alsGast() {
  await createGuestAccess(
    testDb.pool,
    {
      accountId: ACCOUNT_ID,
      tripId: SUEDITALIEN_ID,
      createdBy: PARTICIPANT_ID,
      purpose: "Nachbarin Eva",
      token: "gastlink",
      expiresAt: guestAccessExpiresAt(NOW, 7 * 24),
    },
    NOW,
  );
  const result = await startGuestSession(testDb.pool, "gastlink", NOW);
  cookieJar.werte[SESSION_COOKIE] = result!.token;
}

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("Eine Gast-Sitzung ist keine Teilnehmer-Sitzung (req-038)", () => {
  it("wird von der Anmeldung der Teilnehmer nicht gefunden", async () => {
    await alsGast();

    expect(await currentSession()).toBeNull();
    expect(await currentGuest()).toMatchObject({ tripId: SUEDITALIEN_ID });
  });
});

describe("Was ein Gast nicht darf (req-038)", () => {
  /**
   * Je Akzeptanzkriterium eine Schnittstelle: Ausgaben, Salden und
   * Ausgleich (`/api/ausgaben`), Belege und Dokumente, Bankverbindungen,
   * KI-Suche, Google-Abruf, schreibende Zugriffe sowie die Bereiche
   * Account, Nutzer, Gastzugaenge und Account-Verwaltung.
   */
  const VERBOTEN: [string, () => Promise<Response>][] = [
    ["Ausgaben erfassen", () => ausgaben.POST(anfrage("/api/ausgaben"))],
    ["Ausgaben aendern", () => ausgaben.PUT(anfrage("/api/ausgaben"))],
    ["Ausgaben entfernen", () => ausgaben.DELETE(anfrage("/api/ausgaben"))],
    ["Dokumente ablegen", () => dokumente.POST(anfrage("/api/dokumente"))],
    ["Dokumente entfernen", () => dokumente.DELETE(anfrage("/api/dokumente"))],
    [
      "Bankverbindung abrufen",
      () =>
        bankverbindung.GET(
          new Request(
            `https://dev.wegfara.com/api/bankverbindung?participantId=${PARTICIPANT_ID}`,
          ),
        ),
    ],
    ["KI-Suche ausloesen", () => poiSearch.POST(anfrage("/api/poi-search"))],
    [
      "Google-Abruf ausloesen",
      () => poiAusLink.POST(anfrage("/api/poi-aus-link")),
    ],
    ["POI anlegen", () => pois.POST(anfrage("/api/pois"))],
    ["POI aendern", () => pois.PUT(anfrage("/api/pois"))],
    ["POI entfernen", () => pois.DELETE(anfrage("/api/pois"))],
    ["POI-Status setzen", () => poiStatus.POST(anfrage("/api/poi-status"))],
    ["Reise anlegen", () => trips.POST(anfrage("/api/trips"))],
    ["Reise entfernen", () => trips.DELETE(anfrage("/api/trips"))],
    ["Personen anlegen", () => participants.POST(anfrage("/api/participants"))],
    [
      "Personen entfernen",
      () => participants.DELETE(anfrage("/api/participants")),
    ],
    [
      "Zugangsschluessel setzen",
      () => zugangsschluessel.PUT(anfrage("/api/zugangsschluessel")),
    ],
    ["Accounts anlegen", () => accounts.POST(anfrage("/api/accounts"))],
    ["Bereich Nutzer lesen", () => nutzer.GET()],
    [
      "Nutzer einladen",
      () => einladungen.POST(anfrage("/api/nutzer/einladungen")),
    ],
    ["Gastzugaenge lesen", () => gastzugaenge.GET()],
    [
      "Gastzugang erstellen",
      () => gastzugaenge.POST(anfrage("/api/gastzugaenge")),
    ],
    [
      "Gastzugang widerrufen",
      () => gastzugaenge.DELETE(anfrage("/api/gastzugaenge")),
    ],
  ];

  it.each(VERBOTEN)("weist ab: %s", async (_name, aufruf) => {
    await alsGast();

    expect((await aufruf()).status).toBe(401);
  });
});

/**
 * Der Aufbau, auf dem das beruht: jede Schnittstelle holt die angemeldete
 * Person aus `currentSession()`. Ohne diese Pruefung koennte eine neue
 * Schnittstelle einem Gast offenstehen, ohne dass es jemandem auffaellt.
 */
const OHNE_SITZUNGSPRUEFUNG = [
  // Die Schnittstellen der Anmeldung selbst pruefen ihre eigenen
  // Voraussetzungen (siehe middleware.ts).
  "app/api/auth",
  // Der Health-Endpunkt, den der Container-Betrieb braucht.
  "app/api/health",
];

function routeDateien(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeDateien(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

describe("Jede Schnittstelle prueft die Sitzung (req-038)", () => {
  it("holt die angemeldete Person aus currentSession()", () => {
    const dateien = routeDateien(path.join(process.cwd(), "app", "api")).map(
      (file) => path.relative(process.cwd(), file),
    );

    expect(dateien.length).toBeGreaterThan(10);

    const ungeschuetzt = dateien.filter((datei) => {
      if (OHNE_SITZUNGSPRUEFUNG.some((praefix) => datei.startsWith(praefix))) {
        return false;
      }
      return !readFileSync(datei, "utf8").includes("currentSession()");
    });

    expect(ungeschuetzt).toEqual([]);
  });
});
