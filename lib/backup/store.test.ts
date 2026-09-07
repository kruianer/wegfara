// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { listPois, deletePoi } from "@/lib/db/pois";
import { listTrips } from "@/lib/db/trips";
import {
  backupDir,
  backupId,
  backupOverview,
  createBackup,
  deleteBackup,
  findBackup,
  isBackupId,
  listBackups,
  restoreBackup,
} from "./store";
import { LOW_SPACE_LIMIT_BYTES } from "./types";

const GESTERN = new Date("2026-09-06T08:00:00.000Z");
const HEUTE = new Date("2026-09-07T10:15:00.000Z");

type Pool = ReturnType<typeof createTestDb>;

let root: string;
let bilder: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "wegfara-backups-"));
  bilder = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(bilder, { recursive: true, force: true });
});

async function sichere(
  pool: Pool,
  options: Partial<Parameters<typeof createBackup>[0]> = {},
) {
  return createBackup({
    root,
    db: pool,
    imageDir: bilder,
    source: "von_hand",
    environment: "prod",
    now: HEUTE,
    ...options,
  });
}

/** Wie viel frei ist, wird fuer den Test vorgegeben statt gemessen. */
function frei(bytes: number) {
  return async () => bytes;
}

describe("backupDir (req-053)", () => {
  it("kommt aus der Umgebungsvariablen", () => {
    process.env.BACKUP_DIR = "/data/backups";
    expect(backupDir()).toBe("/data/backups");
  });

  it("verweigert die Arbeit ohne die Variable", () => {
    delete process.env.BACKUP_DIR;
    expect(() => backupDir()).toThrow();
  });
});

describe("backupId (req-053)", () => {
  it("traegt Zeitpunkt und Herkunft", () => {
    expect(backupId(HEUTE, "vor_deploy")).toBe("20260907_101500_vor_deploy");
  });

  it("erkennt nur eigene Kennungen -- kein Pfad geraet hinein", () => {
    expect(isBackupId("20260907_101500_von_hand")).toBe(true);
    expect(isBackupId("../../etc")).toBe(false);
    expect(isBackupId("20260907_101500_von_hand/../..")).toBe(false);
    expect(isBackupId("irgendwas")).toBe(false);
  });
});

describe("createBackup (req-053)", () => {
  it("sichert Datenbankinhalt und Bilddateien in einem Lauf", async () => {
    const pool = createTestDb();
    await writeFile(path.join(bilder, "beleg.jpg"), "ein Bild");
    await mkdir(path.join(bilder, "dokumente"), { recursive: true });
    await writeFile(path.join(bilder, "dokumente", "ticket.pdf"), "ein Ticket");

    const entry = await sichere(pool);

    expect(entry.imageCount).toBe(2);
    expect(entry.rowCount).toBeGreaterThan(0);
    expect(entry.sizeBytes).toBeGreaterThan(0);
    expect(await readdir(path.join(root, entry.id))).toEqual(
      expect.arrayContaining(["manifest.json", "datenbank.json", "images"]),
    );
  });

  it("haelt Zeitpunkt, Herkunft und Umgebung im Manifest fest", async () => {
    const pool = createTestDb();

    const entry = await sichere(pool, {
      source: "vor_deploy",
      environment: "dev",
    });

    const manifest: unknown = JSON.parse(
      await readFile(path.join(root, entry.id, "manifest.json"), "utf8"),
    );
    expect(manifest).toMatchObject({
      createdAt: HEUTE.toISOString(),
      source: "vor_deploy",
      environment: "dev",
    });
  });

  it("legt zwei Backups derselben Sekunde nebeneinander", async () => {
    const pool = createTestDb();

    const erstes = await sichere(pool);
    const zweites = await sichere(pool);

    expect(zweites.id).not.toBe(erstes.id);
    expect(await listBackups(root)).toHaveLength(2);
  });

  it("kommt ohne Bildverzeichnis aus", async () => {
    const pool = createTestDb();

    const entry = await sichere(pool, {
      imageDir: path.join(bilder, "gibt-es-nicht"),
    });

    expect(entry.imageCount).toBe(0);
  });
});

describe("listBackups (req-053)", () => {
  it("zeigt die neuesten zuerst", async () => {
    const pool = createTestDb();
    await sichere(pool, { now: GESTERN });
    await sichere(pool, { now: HEUTE, source: "vor_deploy" });

    const eintraege = await listBackups(root);

    expect(eintraege.map((entry) => entry.createdAt)).toEqual([
      HEUTE.toISOString(),
      GESTERN.toISOString(),
    ]);
    expect(eintraege[0].source).toBe("vor_deploy");
  });

  it("uebergeht ein Verzeichnis ohne Manifest -- ein abgebrochener Lauf", async () => {
    await mkdir(path.join(root, "20260907_101500_von_hand"), {
      recursive: true,
    });

    expect(await listBackups(root)).toEqual([]);
  });

  it("ist leer, solange nichts gesichert wurde", async () => {
    expect(await listBackups(path.join(root, "noch-nichts"))).toEqual([]);
  });
});

describe("backupOverview (req-053)", () => {
  it("nennt belegten und freien Platz", async () => {
    const pool = createTestDb();
    const entry = await sichere(pool);

    const overview = await backupOverview(root, "prod", frei(200 * 1024 ** 3));

    expect(overview.usedBytes).toBe(entry.sizeBytes);
    expect(overview.freeBytes).toBe(200 * 1024 ** 3);
    expect(overview.environment).toBe("prod");
  });

  it("warnt bei weniger als 10 GB frei", async () => {
    const overview = await backupOverview(root, "prod", frei(9 * 1024 ** 3));

    expect(overview.lowSpace).toBe(true);
  });

  it("warnt bei 200 GB frei nicht", async () => {
    const overview = await backupOverview(root, "prod", frei(200 * 1024 ** 3));

    expect(overview.lowSpace).toBe(false);
  });

  it("zieht die Grenze bei genau 10 GB", async () => {
    expect(
      (await backupOverview(root, "prod", frei(LOW_SPACE_LIMIT_BYTES)))
        .lowSpace,
    ).toBe(false);
    expect(
      (await backupOverview(root, "prod", frei(LOW_SPACE_LIMIT_BYTES - 1)))
        .lowSpace,
    ).toBe(true);
  });
});

describe("deleteBackup (req-053)", () => {
  it("entfernt genau eines", async () => {
    const pool = createTestDb();
    const eines = await sichere(pool, { now: GESTERN });
    const anderes = await sichere(pool, { now: HEUTE });

    expect(await deleteBackup(root, eines.id)).toBe(true);

    const uebrig = await listBackups(root);
    expect(uebrig.map((entry) => entry.id)).toEqual([anderes.id]);
  });

  it("loescht nichts ausserhalb der Ablage", async () => {
    await writeFile(path.join(root, "fremd.txt"), "bleibt");

    expect(await deleteBackup(root, "../fremd.txt")).toBe(false);
    expect(await readdir(root)).toContain("fremd.txt");
  });

  it("meldet ein unbekanntes Backup", async () => {
    expect(await deleteBackup(root, "20260101_000000_von_hand")).toBe(false);
  });
});

describe("restoreBackup (req-053)", () => {
  it("bringt Datenbank und Bilddateien auf den Stand des Backups", async () => {
    const pool = createTestDb();
    await writeFile(path.join(bilder, "beleg.jpg"), "aus dem Backup");
    const reisenVorher = await listTrips(pool, ACCOUNT_ID);
    const entry = await sichere(pool);

    await pool.query(
      "update trip set title = 'Spaeter geaendert' where id = $1",
      [reisenVorher[0].id],
    );
    await rm(path.join(bilder, "beleg.jpg"));
    await writeFile(path.join(bilder, "spaeter.jpg"), "nach dem Backup");

    expect(
      await restoreBackup({
        root,
        id: entry.id,
        client: pool,
        imageDir: bilder,
      }),
    ).toBe(true);

    expect(await listTrips(pool, ACCOUNT_ID)).toEqual(reisenVorher);
    expect(await readFile(path.join(bilder, "beleg.jpg"), "utf8")).toBe(
      "aus dem Backup",
    );
    expect(await readdir(bilder)).not.toContain("spaeter.jpg");
  });

  it("holt auch Dateien in Unterverzeichnissen zurueck", async () => {
    const pool = createTestDb();
    await mkdir(path.join(bilder, "dokumente"), { recursive: true });
    await writeFile(path.join(bilder, "dokumente", "ticket.pdf"), "ein Ticket");
    const entry = await sichere(pool);
    await rm(path.join(bilder, "dokumente"), { recursive: true });

    await restoreBackup({ root, id: entry.id, client: pool, imageDir: bilder });

    expect(
      await readFile(path.join(bilder, "dokumente", "ticket.pdf"), "utf8"),
    ).toBe("ein Ticket");
  });

  it("laesst einen vor dem Backup geloeschten POI geloescht", async () => {
    const pool = createTestDb();
    const poiId = (await listPois(pool, ACCOUNT_ID))[0].id;
    await deletePoi(pool, ACCOUNT_ID, poiId);
    const entry = await sichere(pool);

    await restoreBackup({ root, id: entry.id, client: pool, imageDir: bilder });

    const pois = await listPois(pool, ACCOUNT_ID);
    expect(pois.map((poi) => poi.id)).not.toContain(poiId);
  });

  it("meldet ein unbekanntes Backup", async () => {
    const pool = createTestDb();

    expect(
      await restoreBackup({
        root,
        id: "20260101_000000_von_hand",
        client: pool,
        imageDir: bilder,
      }),
    ).toBe(false);
  });
});

describe("findBackup (req-053)", () => {
  it("liefert Zeitpunkt, Herkunft, Umgebung und Groesse", async () => {
    const pool = createTestDb();
    const entry = await sichere(pool, { environment: "dev" });

    expect(await findBackup(root, entry.id)).toMatchObject({
      id: entry.id,
      environment: "dev",
      source: "von_hand",
      createdAt: HEUTE.toISOString(),
    });
  });

  it("liefert nichts zu einer erfundenen Kennung", async () => {
    expect(await findBackup(root, "../../etc")).toBeNull();
  });
});
