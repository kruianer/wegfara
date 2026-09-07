import {
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  statfs,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { Queryable } from "@/lib/db/queryable";
import {
  dumpDatabase,
  dumpRowCount,
  restoreDatabase,
  type DatabaseDump,
} from "./database";
import {
  BACKUP_FORMAT_VERSION,
  LOW_SPACE_LIMIT_BYTES,
  isBackupSource,
  type BackupEntry,
  type BackupManifest,
  type BackupOverview,
  type BackupSource,
} from "./types";

/**
 * Die Ablage der Backups (req-053). Ein Backup ist ein Verzeichnis mit
 * seinem Manifest, dem Datenbankinhalt und einer Kopie der Bilddateien --
 * beide Haelften aus einem gemeinsamen Lauf, damit sie zueinander passen
 * (siehe delivery/stack.md).
 *
 * Der Ort kommt ausschliesslich aus der Umgebungsvariablen BACKUP_DIR; im
 * Betrieb zeigt sie auf ~/wegfara-backups/ auf dem Beelink (siehe
 * delivery/devops.md) -- nie ein fest verdrahteter Pfad im Code.
 */
export const MANIFEST_FILE = "manifest.json";
export const DATABASE_FILE = "datenbank.json";
export const IMAGES_DIR = "images";

export function backupDir(): string {
  const dir = process.env.BACKUP_DIR;
  if (!dir) throw new Error("BACKUP_DIR ist nicht gesetzt");
  return dir;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/**
 * Die Kennung eines Backups ist zugleich sein Verzeichnisname: Zeitpunkt in
 * UTC und Herkunft. Sie ist der einzige Teil einer Anfrage, der in einen
 * Pfad geraet -- deshalb wird sie gegen dieses Muster geprueft, bevor
 * irgendetwas geoeffnet oder geloescht wird.
 */
export const BACKUP_ID_PATTERN = /^\d{8}_\d{6}_(von_hand|vor_deploy)(-\d+)?$/;

export function isBackupId(value: unknown): value is string {
  return typeof value === "string" && BACKUP_ID_PATTERN.test(value);
}

export function backupId(createdAt: Date, source: BackupSource): string {
  const tag = `${createdAt.getUTCFullYear()}${pad(createdAt.getUTCMonth() + 1)}${pad(
    createdAt.getUTCDate(),
  )}`;
  const zeit = `${pad(createdAt.getUTCHours())}${pad(createdAt.getUTCMinutes())}${pad(
    createdAt.getUTCSeconds(),
  )}`;
  return `${tag}_${zeit}_${source}`;
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/** Die Groesse eines Verzeichnisses samt allem, was darin liegt. */
async function directorySize(dir: string): Promise<number> {
  let sum = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sum += await directorySize(target);
    } else if (entry.isFile()) {
      sum += (await stat(target)).size;
    }
  }
  return sum;
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countFiles(path.join(dir, entry.name));
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

/**
 * Leert ein Verzeichnis, ohne es selbst zu entfernen. Das Bildverzeichnis
 * ist im Betrieb ein eingehaengter Datentraeger -- er laesst sich nicht
 * loeschen und danach neu anlegen.
 */
async function emptyDirectory(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const entry of await readdir(dir)) {
    await rm(path.join(dir, entry), { recursive: true, force: true });
  }
}

function isManifest(value: unknown): value is BackupManifest {
  if (typeof value !== "object" || value === null) return false;
  const manifest = value as Record<string, unknown>;
  return (
    typeof manifest.createdAt === "string" &&
    isBackupSource(manifest.source) &&
    typeof manifest.environment === "string"
  );
}

async function readManifest(dir: string): Promise<BackupManifest | null> {
  try {
    const raw = await readFile(path.join(dir, MANIFEST_FILE), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isManifest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Alle Backups, neueste zuerst. Ein Verzeichnis ohne lesbares Manifest zaehlt
 * nicht dazu: das Manifest wird zuletzt geschrieben, ein abgebrochener Lauf
 * taucht deshalb gar nicht erst in der Liste auf.
 */
export async function listBackups(root: string): Promise<BackupEntry[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const backups: BackupEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isBackupId(entry.name)) continue;
    const dir = path.join(root, entry.name);
    const manifest = await readManifest(dir);
    if (!manifest) continue;
    backups.push({
      ...manifest,
      id: entry.name,
      sizeBytes: await directorySize(dir),
    });
  }

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Wie viel auf dem Datentraeger der Backups frei ist. */
export async function diskFreeBytes(root: string): Promise<number> {
  try {
    await mkdir(root, { recursive: true });
    const info = await statfs(root);
    return Number(info.bavail) * Number(info.bsize);
  } catch {
    return 0;
  }
}

/**
 * Die Liste samt Platzangaben (req-053). Sind weniger als 10 GB frei, traegt
 * die Uebersicht die Warnung -- geloescht wird nichts von selbst.
 */
export async function backupOverview(
  root: string,
  environment: string,
  freeSpace: (dir: string) => Promise<number> = diskFreeBytes,
): Promise<BackupOverview> {
  const entries = await listBackups(root);
  const freeBytes = await freeSpace(root);
  return {
    environment,
    entries,
    usedBytes: entries.reduce((sum, entry) => sum + entry.sizeBytes, 0),
    freeBytes,
    lowSpace: freeBytes < LOW_SPACE_LIMIT_BYTES,
  };
}

/**
 * Sichert Datenbankinhalt und Bilddateien in einem Lauf. Das Manifest
 * entsteht zuletzt: erst mit ihm gilt das Backup als vollstaendig.
 */
export async function createBackup(options: {
  root: string;
  db: Queryable;
  imageDir: string;
  source: BackupSource;
  environment: string;
  now: Date;
}): Promise<BackupEntry> {
  const { root, db, imageDir, source, environment, now } = options;

  await mkdir(root, { recursive: true });
  let id = backupId(now, source);
  // Zwei Backups derselben Sekunde: das zweite bekommt eine laufende Nummer.
  for (let nummer = 2; await exists(path.join(root, id)); nummer += 1) {
    id = `${backupId(now, source)}-${nummer}`;
  }
  const dir = path.join(root, id);
  await mkdir(dir, { recursive: true });

  const dump = await dumpDatabase(db);
  await writeFile(path.join(dir, DATABASE_FILE), JSON.stringify(dump), "utf8");

  const images = path.join(dir, IMAGES_DIR);
  await mkdir(images, { recursive: true });
  if (await exists(imageDir)) {
    await cp(imageDir, images, { recursive: true });
  }

  const manifest: BackupManifest = {
    version: BACKUP_FORMAT_VERSION,
    createdAt: now.toISOString(),
    source,
    environment,
    rowCount: dumpRowCount(dump),
    imageCount: await countFiles(images),
  };
  await writeFile(
    path.join(dir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return { ...manifest, id, sizeBytes: await directorySize(dir) };
}

/** Loescht ein Backup. Von selbst verschwindet keines (req-053). */
export async function deleteBackup(root: string, id: string): Promise<boolean> {
  if (!isBackupId(id)) return false;
  const dir = path.join(root, id);
  if (!(await exists(dir))) return false;
  await rm(dir, { recursive: true, force: true });
  return true;
}

export async function findBackup(
  root: string,
  id: string,
): Promise<BackupEntry | null> {
  if (!isBackupId(id)) return null;
  const dir = path.join(root, id);
  const manifest = await readManifest(dir);
  if (!manifest) return null;
  return { ...manifest, id, sizeBytes: await directorySize(dir) };
}

async function readDump(dir: string): Promise<DatabaseDump | null> {
  try {
    const raw = await readFile(path.join(dir, DATABASE_FILE), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const tables = (parsed as { tables?: unknown }).tables;
    return Array.isArray(tables) ? ({ tables } as DatabaseDump) : null;
  } catch {
    return null;
  }
}

/**
 * Spielt ein Backup vollstaendig ein: erst die Datenbank in einer
 * Transaktion, danach die Bilddateien. Beides ohne Handarbeit an Datenbank
 * oder Dateisystem (siehe delivery/stack.md).
 *
 * Die Bilddateien kommen zuletzt, weil die Datenbank die Wahrheitsquelle
 * ist: schlaegt sie fehl, bleibt der bisherige Stand unangetastet.
 */
export async function restoreBackup(options: {
  root: string;
  id: string;
  client: Queryable;
  imageDir: string;
}): Promise<boolean> {
  const { root, id, client, imageDir } = options;
  if (!isBackupId(id)) return false;

  const dir = path.join(root, id);
  const dump = await readDump(dir);
  if (!dump) return false;

  await restoreDatabase(client, dump);

  await emptyDirectory(imageDir);
  const images = path.join(dir, IMAGES_DIR);
  if (await exists(images)) {
    await cp(images, imageDir, { recursive: true });
  }
  return true;
}
