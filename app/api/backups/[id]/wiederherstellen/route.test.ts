// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { BackupEntry } from "@/lib/backup/types";

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
const { listTrips } = await import("@/lib/db/trips");
const { createBackup, listBackups } = await import("@/lib/backup/store");
const { restoreInProgress } = await import("@/lib/backup/maintenance");
const { POST } = await import("./route");

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

function sichere(
  now = new Date("2026-09-06T08:00:00.000Z"),
): Promise<BackupEntry> {
  return createBackup({
    root,
    db: testDb.pool,
    imageDir: bilder,
    source: "von_hand",
    environment: "prod",
    now,
  });
}

function anfrage(body: unknown) {
  return new Request("https://app.wegfara.com/api/backups/x/wiederherstellen", {
    method: "POST",
    headers: { "x-forwarded-proto": "https" },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const BESTAETIGT = { bestaetigung: "wiederherstellen" };

async function benenneReiseUm(titel: string): Promise<void> {
  const reisen = await listTrips(testDb.pool, ACCOUNT_ID);
  await testDb.pool.query("update trip set title = $1 where id = $2", [
    titel,
    reisen[0].id,
  ]);
}

describe("POST /api/backups/[id]/wiederherstellen (req-053)", () => {
  it("bringt Datenbank und Bilddateien auf den Stand des Backups", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "beleg.jpg"), "aus dem Backup");
    const vorher = await listTrips(testDb.pool, ACCOUNT_ID);
    const backup = await sichere();

    await benenneReiseUm("Spaeter geaendert");
    await rm(path.join(bilder, "beleg.jpg"));

    const response = await POST(anfrage(BESTAETIGT), params(backup.id));

    expect(response.status).toBe(200);
    expect(await listTrips(testDb.pool, ACCOUNT_ID)).toEqual(vorher);
    expect(await readFile(path.join(bilder, "beleg.jpg"), "utf8")).toBe(
      "aus dem Backup",
    );
  });

  it("stellt ohne das eingetippte Wort nichts wieder her", async () => {
    await alsGesamtAdmin();
    const backup = await sichere();
    await benenneReiseUm("Bleibt so");

    const response = await POST(anfrage({}), params(backup.id));

    expect(response.status).toBe(400);
    const reisen = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(reisen.map((trip) => trip.title)).toContain("Bleibt so");
  });

  it("weist ein falsch eingetipptes Wort ab", async () => {
    await alsGesamtAdmin();
    const backup = await sichere();
    await benenneReiseUm("Bleibt so");

    const response = await POST(
      anfrage({ bestaetigung: "wiederherstelen" }),
      params(backup.id),
    );

    expect(response.status).toBe(400);
    const reisen = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(reisen.map((trip) => trip.title)).toContain("Bleibt so");
  });

  it("sichert vorher den jetzigen Stand, wenn nichts anderes gesagt wird", async () => {
    await alsGesamtAdmin();
    const backup = await sichere();

    await POST(anfrage(BESTAETIGT), params(backup.id));

    const eintraege = await listBackups(root);
    expect(eintraege).toHaveLength(2);
    expect(eintraege.map((entry) => entry.id)).toContain(backup.id);
  });

  it("verzichtet darauf, wenn das Haekchen abgewaehlt ist", async () => {
    await alsGesamtAdmin();
    const backup = await sichere();

    await POST(
      anfrage({ ...BESTAETIGT, vorherSichern: false }),
      params(backup.id),
    );

    expect(await listBackups(root)).toHaveLength(1);
  });

  it("meldet danach alle ab", async () => {
    await alsGesamtAdmin();
    const backup = await sichere();

    const response = await POST(anfrage(BESTAETIGT), params(backup.id));

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toContain("Max-Age=0");
  });

  it("gibt die App danach wieder frei", async () => {
    await alsGesamtAdmin();
    const backup = await sichere();

    await POST(anfrage(BESTAETIGT), params(backup.id));

    expect(restoreInProgress()).toBe(false);
  });

  it("weist einen Account-Admin ab", async () => {
    await alsAccountAdmin();
    const backup = await sichere();
    await benenneReiseUm("Bleibt so");

    const response = await POST(anfrage(BESTAETIGT), params(backup.id));

    expect(response.status).toBe(403);
    const reisen = await listTrips(testDb.pool, ACCOUNT_ID);
    expect(reisen.map((trip) => trip.title)).toContain("Bleibt so");
  });

  it("weist ohne Anmeldung ab", async () => {
    const backup = await sichere();

    const response = await POST(anfrage(BESTAETIGT), params(backup.id));

    expect(response.status).toBe(401);
  });

  it("meldet ein unbekanntes Backup", async () => {
    await alsGesamtAdmin();

    const response = await POST(
      anfrage(BESTAETIGT),
      params("20260101_000000_von_hand"),
    );

    expect(response.status).toBe(404);
    expect(await readdir(root)).toEqual([]);
  });
});
