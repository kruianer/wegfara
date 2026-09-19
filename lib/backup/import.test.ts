// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWriteStream } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { IMPORT_FEHLER, importiereBackupArchiv } from "./import";
import { listBackups } from "./store";
import { verzeichnisQuellen, zipStream } from "./zip";
import type { BackupManifest } from "./types";

/**
 * Das Gegenstueck zum Herunterladen (req-071): eine heruntergeladene Datei
 * muss sich wieder einspielen lassen -- und eine, die nicht passt, darf die
 * Ablage nicht anfassen.
 */

let root: string;
let werkstatt: string;

const MANIFEST: BackupManifest = {
  version: 1,
  createdAt: "2026-09-07T10:15:00.000Z",
  source: "von_hand",
  environment: "prod",
  rowCount: 12,
  imageCount: 1,
};

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "wegfara-ablage-"));
  werkstatt = await mkdtemp(path.join(tmpdir(), "wegfara-werkstatt-"));
});

afterEach(async () => {
  for (const ordner of [root, werkstatt]) {
    await rm(ordner, { recursive: true, force: true });
  }
});

/** Ein Backup-Verzeichnis, wie createBackup es hinterlaesst. */
async function backupVerzeichnis(
  overrides: Partial<BackupManifest> = {},
  options: { ohneDatenbank?: boolean; ohneManifest?: boolean } = {},
): Promise<string> {
  const quelle = await mkdtemp(path.join(werkstatt, "backup-"));
  await mkdir(path.join(quelle, "images"), { recursive: true });
  if (!options.ohneDatenbank) {
    await writeFile(
      path.join(quelle, "datenbank.json"),
      JSON.stringify({ tables: [{ name: "trip", rows: [] }] }),
    );
  }
  if (!options.ohneManifest) {
    await writeFile(
      path.join(quelle, "manifest.json"),
      JSON.stringify({ ...MANIFEST, ...overrides }),
    );
  }
  await writeFile(path.join(quelle, "images", "beleg.png"), "BILD-BYTES");
  return quelle;
}

async function alsArchiv(quelle: string): Promise<string> {
  const ziel = path.join(werkstatt, `${path.basename(quelle)}.zip`);
  await pipeline(
    zipStream(await verzeichnisQuellen(quelle)),
    createWriteStream(ziel),
  );
  return ziel;
}

async function spieleEin(archiv: string) {
  return importiereBackupArchiv({ root, archiv });
}

describe("importiereBackupArchiv (req-071)", () => {
  it("nimmt ein heruntergeladenes Archiv in die Ablage auf", async () => {
    const ergebnis = await spieleEin(
      await alsArchiv(await backupVerzeichnis()),
    );

    expect(ergebnis.ok).toBe(true);
    const liste = await listBackups(root);
    expect(liste).toHaveLength(1);
    expect(liste[0].createdAt).toBe(MANIFEST.createdAt);
    expect(liste[0].source).toBe("von_hand");
    expect(liste[0].environment).toBe("prod");
  });

  it("legt Datenbankinhalt und Bilder wieder auf die Platte", async () => {
    await spieleEin(await alsArchiv(await backupVerzeichnis()));

    const [eintrag] = await listBackups(root);
    const dir = path.join(root, eintrag.id);
    expect(
      JSON.parse(await readFile(path.join(dir, "datenbank.json"), "utf8")),
    ).toEqual({ tables: [{ name: "trip", rows: [] }] });
    expect(await readFile(path.join(dir, "images", "beleg.png"), "utf8")).toBe(
      "BILD-BYTES",
    );
  });

  it("behaelt Zeitpunkt und Herkunft in der Kennung", async () => {
    const ergebnis = await spieleEin(
      await alsArchiv(await backupVerzeichnis()),
    );

    expect(ergebnis.ok && ergebnis.entry.id).toBe("20260907_101500_von_hand");
  });

  it("stellt nichts von selbst wieder her -- es landet nur in der Liste", async () => {
    // Das Wiederherstellen bleibt der eigene, bestaetigte Schritt aus
    // req-053 (req-071, Constraints).
    const ergebnis = await spieleEin(
      await alsArchiv(await backupVerzeichnis()),
    );

    expect(ergebnis.ok).toBe(true);
    // Eingespielt wird ausschliesslich in die Ablage: kein anderer Ort
    // wurde angefasst.
    expect(await readdir(root)).toEqual(["20260907_101500_von_hand"]);
  });

  it("nimmt dasselbe Archiv ein zweites Mal ohne Verlust auf", async () => {
    const archiv = await alsArchiv(await backupVerzeichnis());

    await spieleEin(archiv);
    const zweites = await spieleEin(archiv);

    expect(zweites.ok).toBe(true);
    expect((await listBackups(root)).map((eintrag) => eintrag.id)).toEqual([
      "20260907_101500_von_hand",
      "20260907_101500_von_hand-2",
    ]);
  });

  it("nimmt ein Backup einer anderen Umgebung mitsamt ihrer Angabe auf", async () => {
    // Die Warnung der Sicherheitsabfrage haengt daran (req-053).
    await spieleEin(
      await alsArchiv(await backupVerzeichnis({ environment: "dev" })),
    );

    expect((await listBackups(root))[0].environment).toBe("dev");
  });

  it("weist zurueck, was kein ZIP ist", async () => {
    const datei = path.join(werkstatt, "foto.png");
    await writeFile(datei, Buffer.alloc(400, 9));

    const ergebnis = await spieleEin(datei);

    expect(ergebnis).toEqual({ ok: false, fehler: IMPORT_FEHLER.keinZip });
    expect(await listBackups(root)).toEqual([]);
  });

  it("nennt die fehlende datenbank.json", async () => {
    const quelle = await backupVerzeichnis({}, { ohneDatenbank: true });

    const ergebnis = await spieleEin(await alsArchiv(quelle));

    expect(ergebnis).toEqual({
      ok: false,
      fehler: IMPORT_FEHLER.ohneDatenbank,
    });
    expect(await listBackups(root)).toEqual([]);
  });

  it("nennt das fehlende manifest.json", async () => {
    const quelle = await backupVerzeichnis({}, { ohneManifest: true });

    const ergebnis = await spieleEin(await alsArchiv(quelle));

    expect(ergebnis).toEqual({ ok: false, fehler: IMPORT_FEHLER.ohneManifest });
  });

  it("nennt ein unlesbares manifest.json", async () => {
    const quelle = await backupVerzeichnis({}, { ohneManifest: true });
    await writeFile(path.join(quelle, "manifest.json"), "{kein json");

    const ergebnis = await spieleEin(await alsArchiv(quelle));

    expect(ergebnis).toEqual({
      ok: false,
      fehler: IMPORT_FEHLER.kaputtesManifest,
    });
    expect(await listBackups(root)).toEqual([]);
  });

  it("nennt ein manifest.json ohne Zeitpunkt", async () => {
    const quelle = await backupVerzeichnis({}, { ohneManifest: true });
    await writeFile(
      path.join(quelle, "manifest.json"),
      JSON.stringify({ ...MANIFEST, createdAt: "irgendwann" }),
    );

    const ergebnis = await spieleEin(await alsArchiv(quelle));

    expect(ergebnis).toEqual({
      ok: false,
      fehler: IMPORT_FEHLER.kaputtesManifest,
    });
  });

  it("laesst einen Eintrag ausserhalb der Ablage links liegen", async () => {
    const quelle = await backupVerzeichnis();
    const archiv = path.join(werkstatt, "boese.zip");
    const quellen = await verzeichnisQuellen(quelle);
    quellen.push({
      name: "../entwischt.txt",
      path: path.join(quelle, "datenbank.json"),
      modified: new Date("2026-09-07T10:15:00.000Z"),
    });
    await pipeline(zipStream(quellen), createWriteStream(archiv));

    const ergebnis = await spieleEin(archiv);

    expect(ergebnis.ok).toBe(true);
    expect(await readdir(root)).toEqual(["20260907_101500_von_hand"]);
    expect(await readdir(werkstatt)).not.toContain("entwischt.txt");
  });

  it("legt bei einem leeren Archiv nichts halb Fertiges ab", async () => {
    const leer = await mkdtemp(path.join(werkstatt, "leer-"));

    await spieleEin(await alsArchiv(leer));

    expect(await readdir(root)).toEqual([]);
  });
});
