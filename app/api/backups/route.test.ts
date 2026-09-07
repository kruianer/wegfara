// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { BackupOverview } from "@/lib/backup/types";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("@/lib/db/pool", () => ({
  getPool: () => testDb.pool,
  withDatabaseClient: (run: (client: unknown) => unknown) => run(testDb.pool),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { createSession } = await import("@/lib/db/sessions");
const { createParticipant } = await import("@/lib/db/participants");
const { GET, POST } = await import("./route");

let root: string;
let bilder: string;

const UMGEBUNG = {
  APP_URL: process.env.APP_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  BACKUP_DIR: process.env.BACKUP_DIR,
  IMAGE_DIR: process.env.IMAGE_DIR,
};

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  root = await mkdtemp(path.join(tmpdir(), "wegfara-backups-"));
  bilder = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.BACKUP_DIR = root;
  process.env.IMAGE_DIR = bilder;
  process.env.APP_URL = "https://app.wegfara.com";
  process.env.AUTH_SECRET = "geheimnis-der-umgebung";
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(bilder, { recursive: true, force: true });
  for (const [name, wert] of Object.entries(UMGEBUNG)) {
    if (wert === undefined) delete process.env[name];
    else process.env[name] = wert;
  }
});

async function alsGesamtAdmin() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-admin", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-admin";
}

/** Ein Account-Admin, der nicht Gesamt-Admin ist (req-027). */
async function alsAccountAdmin() {
  const clara = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    new Date(),
    true,
  );
  await createSession(testDb.pool, clara.id, "token-clara", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-clara";
  return clara;
}

function anfrage(headers: Record<string, string> = {}) {
  return new Request("https://app.wegfara.com/api/backups", {
    method: "POST",
    headers,
  });
}

async function uebersicht(response: Response): Promise<BackupOverview> {
  return (await response.json()) as BackupOverview;
}

describe("GET /api/backups (req-053)", () => {
  it("zeigt dem Gesamt-Admin die Liste", async () => {
    await alsGesamtAdmin();

    const response = await GET();

    expect(response.status).toBe(200);
    const overview = await uebersicht(response);
    expect(overview.entries).toEqual([]);
    expect(overview.environment).toBe("prod");
  });

  it("weist einen Account-Admin ab, der die Adresse direkt aufruft", async () => {
    await alsAccountAdmin();

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("weist ohne Anmeldung ab", async () => {
    const response = await GET();

    expect(response.status).toBe(401);
  });
});

describe("POST /api/backups (req-053)", () => {
  it("legt ein Backup von Hand an", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "beleg.jpg"), "ein Bild");

    const response = await POST(anfrage());

    expect(response.status).toBe(200);
    const overview = await uebersicht(response);
    expect(overview.entries).toHaveLength(1);
    expect(overview.entries[0].source).toBe("von_hand");
    expect(overview.entries[0].imageCount).toBe(1);
  });

  it("nennt zu jedem Eintrag seine Groesse und den heutigen Tag", async () => {
    await alsGesamtAdmin();
    const heute = new Date().toISOString().slice(0, 10);

    const overview = await uebersicht(await POST(anfrage()));

    expect(overview.entries[0].sizeBytes).toBeGreaterThan(0);
    expect(overview.entries[0].createdAt.slice(0, 10)).toBe(heute);
  });

  it("traegt als Herkunft „vor Deploy“, wenn der Deploy sichert", async () => {
    const response = await POST(
      anfrage({ "x-wegfara-deploy": "geheimnis-der-umgebung" }),
    );

    expect(response.status).toBe(200);
    const overview = await uebersicht(response);
    expect(overview.entries[0].source).toBe("vor_deploy");
  });

  it("laesst niemanden mit falschem Geheimnis sichern", async () => {
    const response = await POST(anfrage({ "x-wegfara-deploy": "geraten" }));

    expect(response.status).toBe(401);
  });

  it("laesst einen Account-Admin nicht sichern", async () => {
    await alsAccountAdmin();

    const response = await POST(anfrage());

    expect(response.status).toBe(403);
  });

  it("traegt die Umgebung des Backups ein", async () => {
    process.env.APP_URL = "https://dev.wegfara.com";
    await alsGesamtAdmin();

    const overview = await uebersicht(await POST(anfrage()));

    expect(overview.entries[0].environment).toBe("dev");
  });
});
