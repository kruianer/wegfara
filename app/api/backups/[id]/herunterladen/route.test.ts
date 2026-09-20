// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import type { BackupEntry } from "@/lib/backup/types";
import { zipEintragLesen, zipOeffnen } from "@/lib/backup/unzip";

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
const { GET } = await import("./route");

let root: string;
let bilder: string;
let ablage: string;
const VORHER = {
  BACKUP_DIR: process.env.BACKUP_DIR,
  IMAGE_DIR: process.env.IMAGE_DIR,
};

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  root = await mkdtemp(path.join(tmpdir(), "wegfara-backups-"));
  bilder = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  ablage = await mkdtemp(path.join(tmpdir(), "wegfara-download-"));
  process.env.BACKUP_DIR = root;
  process.env.IMAGE_DIR = bilder;
});

afterEach(async () => {
  for (const ordner of [root, bilder, ablage]) {
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

function sichere(now: Date, environment = "prod"): Promise<BackupEntry> {
  return createBackup({
    root,
    db: testDb.pool,
    imageDir: bilder,
    source: "von_hand",
    environment,
    now,
  });
}

function anfrage() {
  return new Request("https://app.wegfara.com/api/backups/x/herunterladen");
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Legt die Antwort als Datei ab -- so wie sie im Browser landen wuerde. */
async function alsDatei(response: Response, name = "backup.zip") {
  const ziel = path.join(ablage, name);
  await writeFile(ziel, Buffer.from(await response.arrayBuffer()));
  return ziel;
}

function dateiname(response: Response): string {
  const kopf = response.headers.get("Content-Disposition") ?? "";
  return kopf.match(/filename="([^"]+)"/)?.[1] ?? "";
}

describe("GET /api/backups/[id]/herunterladen (req-071)", () => {
  it("liefert eine ZIP-Datei", async () => {
    await alsGesamtAdmin();
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await GET(anfrage(), params(backup.id));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment;/);
    const geoeffnet = await zipOeffnen(await alsDatei(response));
    expect(geoeffnet).not.toBeNull();
    await geoeffnet!.handle.close();
  });

  it("legt datenbank.json, manifest.json und images samt Bildern hinein", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "beleg.png"), "BILD-BYTES");
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await GET(anfrage(), params(backup.id));

    const { handle, eintraege } = (await zipOeffnen(await alsDatei(response)))!;
    const namen = eintraege.map((eintrag) => eintrag.name);
    expect(namen).toContain("datenbank.json");
    expect(namen).toContain("manifest.json");
    expect(namen).toContain("images/");
    expect(namen).toContain("images/beleg.png");

    const bild = eintraege.find((e) => e.name === "images/beleg.png")!;
    expect((await zipEintragLesen(handle, bild)).toString()).toBe("BILD-BYTES");

    const manifest = eintraege.find((e) => e.name === "manifest.json")!;
    expect(
      JSON.parse((await zipEintragLesen(handle, manifest)).toString()),
    ).toMatchObject({ environment: "prod", source: "von_hand" });
    await handle.close();
  });

  it("nennt im Dateinamen Umgebung und Zeitpunkt", async () => {
    await alsGesamtAdmin();
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"), "dev");

    const response = await GET(anfrage(), params(backup.id));

    const name = dateiname(response);
    expect(name).toContain("dev");
    expect(name).toContain("20260907_101500");
    expect(name.endsWith(".zip")).toBe(true);
  });

  it("gibt zwei Backups verschiedener Zeitpunkte verschiedene Dateinamen", async () => {
    await alsGesamtAdmin();
    const frueher = await sichere(new Date("2026-09-06T08:00:00.000Z"));
    const spaeter = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const eines = dateiname(await GET(anfrage(), params(frueher.id)));
    const anderes = dateiname(await GET(anfrage(), params(spaeter.id)));

    expect(eines).not.toBe(anderes);
    expect(eines).toContain("20260906_080000");
    expect(anderes).toContain("20260907_101500");
  });

  it("laesst das Backup auf dem Server unveraendert", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "beleg.png"), "BILD-BYTES");
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"));
    const vorher = await listBackups(root);

    await alsDatei(await GET(anfrage(), params(backup.id)));

    expect(await listBackups(root)).toEqual(vorher);
  });

  it("weist einen Account-Admin ab", async () => {
    await alsAccountAdmin();
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await GET(anfrage(), params(backup.id));

    expect(response.status).toBe(403);
  });

  it("weist ohne Anmeldung ab", async () => {
    const backup = await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await GET(anfrage(), params(backup.id));

    expect(response.status).toBe(401);
  });

  it("meldet ein unbekanntes Backup", async () => {
    await alsGesamtAdmin();

    const response = await GET(anfrage(), params("20260101_000000_von_hand"));

    expect(response.status).toBe(404);
  });

  it("laesst sich nicht auf einen fremden Pfad lenken", async () => {
    await alsGesamtAdmin();
    await sichere(new Date("2026-09-07T10:15:00.000Z"));

    const response = await GET(anfrage(), params("../"));

    expect(response.status).toBe(404);
  });
});
