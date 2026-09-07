// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { BackupEntry, BackupOverview } from "@/lib/backup/types";

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
const { createBackup, listBackups } = await import("@/lib/backup/store");
const { DELETE } = await import("./route");

let root: string;
let bilder: string;
const VORHER = {
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
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(bilder, { recursive: true, force: true });
  for (const [name, wert] of Object.entries(VORHER)) {
    if (wert === undefined) delete process.env[name];
    else process.env[name] = wert;
  }
});

async function alsGesamtAdmin() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-admin", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-admin";
}

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
}

function sichere(now: Date): Promise<BackupEntry> {
  return createBackup({
    root,
    db: testDb.pool,
    imageDir: bilder,
    source: "von_hand",
    environment: "prod",
    now,
  });
}

function anfrage() {
  return new Request("https://app.wegfara.com/api/backups/x", {
    method: "DELETE",
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/backups/[id] (req-053)", () => {
  it("loescht genau dieses Backup", async () => {
    await alsGesamtAdmin();
    const eines = await sichere(new Date("2026-09-06T08:00:00.000Z"));
    const anderes = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await DELETE(anfrage(), params(eines.id));

    expect(response.status).toBe(200);
    const overview = (await response.json()) as BackupOverview;
    expect(overview.entries.map((entry) => entry.id)).toEqual([anderes.id]);
  });

  it("weist einen Account-Admin ab", async () => {
    await alsAccountAdmin();
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await DELETE(anfrage(), params(backup.id));

    expect(response.status).toBe(403);
    expect(await listBackups(root)).toHaveLength(1);
  });

  it("weist ohne Anmeldung ab", async () => {
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await DELETE(anfrage(), params(backup.id));

    expect(response.status).toBe(401);
    expect(await listBackups(root)).toHaveLength(1);
  });

  it("meldet ein unbekanntes Backup", async () => {
    await alsGesamtAdmin();

    const response = await DELETE(
      anfrage(),
      params("20260101_000000_von_hand"),
    );

    expect(response.status).toBe(404);
  });

  it("laesst sich nicht auf einen fremden Pfad lenken", async () => {
    await alsGesamtAdmin();
    await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await DELETE(anfrage(), params("../"));

    expect(response.status).toBe(404);
    expect(await listBackups(root)).toHaveLength(1);
  });
});
