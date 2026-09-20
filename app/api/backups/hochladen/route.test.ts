// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { IMPORT_FEHLER } from "@/lib/backup/import";
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
const { createBackup, deleteBackup, listBackups } = await import(
  "@/lib/backup/store"
);
const { GET: HERUNTERLADEN } = await import("../[id]/herunterladen/route");
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
  for (const ordner of [root, bilder]) {
    await rm(ordner, { recursive: true, force: true });
  }
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

/** Ein Backup herunterladen und aus der Ablage nehmen -- wie ein Umzug. */
async function heruntergeladen(now: Date): Promise<Uint8Array> {
  const backup = await sichere(now);
  const response = await HERUNTERLADEN(
    new Request("https://app.wegfara.com/api/backups/x/herunterladen"),
    { params: Promise.resolve({ id: backup.id }) },
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  await deleteBackup(root, backup.id);
  return bytes;
}

function anfrage(body: Uint8Array) {
  return new Request("https://app.wegfara.com/api/backups/hochladen", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: new Uint8Array(body).buffer as ArrayBuffer,
  });
}

describe("POST /api/backups/hochladen (req-071)", () => {
  it("nimmt eine heruntergeladene ZIP-Datei wieder in die Liste auf", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "beleg.png"), "BILD-BYTES");
    const datei = await heruntergeladen(new Date("2026-09-07T10:15:00.000Z"));
    expect(await listBackups(root)).toEqual([]);

    const response = await POST(anfrage(datei));

    expect(response.status).toBe(200);
    const overview = (await response.json()) as BackupOverview;
    expect(overview.entries.map((eintrag) => eintrag.id)).toEqual([
      "20260907_101500_von_hand",
    ]);
    expect(overview.entries[0].imageCount).toBe(1);
  });

  it("stellt das hochgeladene Backup nicht von selbst wieder her", async () => {
    await alsGesamtAdmin();
    const datei = await heruntergeladen(new Date("2026-09-07T10:15:00.000Z"));

    await POST(anfrage(datei));

    // Es liegt in der Ablage -- mehr nicht (req-071, Constraints).
    expect(await listBackups(root)).toHaveLength(1);
  });

  it("nennt den Grund, wenn die Datei kein ZIP ist, und laesst die Liste in Ruhe", async () => {
    await alsGesamtAdmin();
    const vorhanden = await sichere(new Date("2026-09-06T08:00:00.000Z"));

    const response = await POST(anfrage(new Uint8Array(400).fill(9)));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: IMPORT_FEHLER.keinZip });
    expect((await listBackups(root)).map((e) => e.id)).toEqual([vorhanden.id]);
  });

  it("nennt die fehlende datenbank.json", async () => {
    await alsGesamtAdmin();
    const { zipStream } = await import("@/lib/backup/zip");
    const stuecke: Buffer[] = [];
    for await (const stueck of zipStream([
      { name: "manifest.json", modified: new Date("2026-09-07T10:15:00.000Z") },
    ])) {
      stuecke.push(stueck);
    }

    const response = await POST(
      anfrage(new Uint8Array(Buffer.concat(stuecke))),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: IMPORT_FEHLER.ohneDatenbank,
    });
  });

  it("laesst kein Nebenverzeichnis zurueck", async () => {
    await alsGesamtAdmin();
    const datei = await heruntergeladen(new Date("2026-09-07T10:15:00.000Z"));

    await POST(anfrage(datei));

    expect(await readdir(root)).toEqual(["20260907_101500_von_hand"]);
  });

  it("weist einen Account-Admin ab", async () => {
    await alsGesamtAdmin();
    const datei = await heruntergeladen(new Date("2026-09-07T10:15:00.000Z"));
    await alsAccountAdmin();

    const response = await POST(anfrage(datei));

    expect(response.status).toBe(403);
    expect(await listBackups(root)).toEqual([]);
  });

  it("weist ohne Anmeldung ab", async () => {
    await alsGesamtAdmin();
    const datei = await heruntergeladen(new Date("2026-09-07T10:15:00.000Z"));
    cookieJar.werte = {};

    const response = await POST(anfrage(datei));

    expect(response.status).toBe(401);
    expect(await listBackups(root)).toEqual([]);
  });
});
