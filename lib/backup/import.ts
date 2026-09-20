import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  zipEintragLesen,
  zipEintragSchreiben,
  zipOeffnen,
  type ZipEintrag,
} from "./unzip";
import {
  DATABASE_FILE,
  IMAGES_DIR,
  MANIFEST_FILE,
  backupId,
  findBackup,
  isManifest,
} from "./store";
import type { BackupEntry, BackupManifest } from "./types";

/**
 * Eine heruntergeladene ZIP-Datei wieder einspielen (req-071). Sie landet als
 * gewoehnliches Backup in der Ablage -- dasselbe Verzeichnis, dasselbe
 * Manifest, dieselbe Liste. Wiederhergestellt wird sie dadurch nicht: das
 * bleibt der eigene, bestaetigte Schritt aus req-053.
 *
 * Passt die Datei nicht, sagt die Antwort was fehlt, statt es zu
 * verschlucken (vgl. bug-021, bug-026).
 */
export const IMPORT_FEHLER = {
  keinZip: "Die Datei ist kein ZIP-Archiv.",
  ohneDatenbank: "Im Archiv fehlt „datenbank.json“.",
  ohneManifest: "Im Archiv fehlt „manifest.json“.",
  kaputtesManifest: "Das „manifest.json“ des Archivs ist unlesbar.",
  fehlgeschlagen: "Das Archiv konnte nicht gelesen werden.",
} as const;

export type ImportErgebnis =
  | { ok: true; entry: BackupEntry }
  | { ok: false; fehler: string };

/**
 * Was aus einem Archiv uebernommen wird -- und sonst nichts. Ein Name mit
 * "..", einem fuehrenden "/" oder einem Backslash wuerde aus der Ablage
 * herausfuehren und wird gar nicht erst angefasst; was sonst noch im Archiv
 * liegt (etwa die Beigaben mancher Packprogramme), wird uebergangen.
 */
function uebernommen(name: string): boolean {
  if (name.includes("\\") || name.startsWith("/")) return false;
  if (name.split("/").includes("..")) return false;
  if (name === DATABASE_FILE || name === MANIFEST_FILE) return true;
  return name.startsWith(`${IMAGES_DIR}/`);
}

function manifestAus(rohdaten: Buffer): BackupManifest | null {
  let gelesen: unknown;
  try {
    gelesen = JSON.parse(rohdaten.toString("utf8"));
  } catch {
    return null;
  }
  if (!isManifest(gelesen)) return null;
  return Number.isNaN(new Date(gelesen.createdAt).getTime()) ? null : gelesen;
}

/** Eine freie Kennung fuer das eingespielte Backup -- seine eigene zuerst. */
async function freieKennung(
  root: string,
  manifest: BackupManifest,
): Promise<string> {
  const basis = backupId(new Date(manifest.createdAt), manifest.source);
  let kennung = basis;
  for (let nummer = 2; await vorhanden(path.join(root, kennung)); nummer += 1) {
    kennung = `${basis}-${nummer}`;
  }
  return kennung;
}

async function vorhanden(ziel: string): Promise<boolean> {
  try {
    await stat(ziel);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spielt ein Archiv in die Ablage ein. Zusammengebaut wird es zuerst in
 * einem Nebenverzeichnis, dessen Name nicht zum Muster einer Kennung passt
 * -- so taucht ein abgebrochener Lauf nicht in der Liste auf. Erst der
 * letzte Schritt gibt ihm seinen Platz.
 */
export async function importiereBackupArchiv(options: {
  root: string;
  archiv: string;
}): Promise<ImportErgebnis> {
  const { root, archiv } = options;

  const geoeffnet = await zipOeffnen(archiv).catch(() => null);
  if (!geoeffnet) return { ok: false, fehler: IMPORT_FEHLER.keinZip };
  const { handle, eintraege } = geoeffnet;

  try {
    const dateien = eintraege.filter(
      (eintrag) => !eintrag.name.endsWith("/") && uebernommen(eintrag.name),
    );
    const finde = (name: string): ZipEintrag | undefined =>
      dateien.find((eintrag) => eintrag.name === name);

    const datenbank = finde(DATABASE_FILE);
    if (!datenbank) return { ok: false, fehler: IMPORT_FEHLER.ohneDatenbank };
    const manifestEintrag = finde(MANIFEST_FILE);
    if (!manifestEintrag) {
      return { ok: false, fehler: IMPORT_FEHLER.ohneManifest };
    }

    const manifest = manifestAus(
      await zipEintragLesen(handle, manifestEintrag),
    );
    if (!manifest) {
      return { ok: false, fehler: IMPORT_FEHLER.kaputtesManifest };
    }

    await mkdir(root, { recursive: true });
    const bau = await mkdtemp(path.join(root, ".eingespielt-"));
    try {
      await mkdir(path.join(bau, IMAGES_DIR), { recursive: true });
      for (const eintrag of dateien) {
        const ziel = path.join(bau, ...eintrag.name.split("/"));
        await mkdir(path.dirname(ziel), { recursive: true });
        await zipEintragSchreiben(handle, eintrag, ziel);
      }

      const kennung = await freieKennung(root, manifest);
      await rename(bau, path.join(root, kennung));

      const entry = await findBackup(root, kennung);
      if (!entry) return { ok: false, fehler: IMPORT_FEHLER.fehlgeschlagen };
      return { ok: true, entry };
    } catch (fehler) {
      await rm(bau, { recursive: true, force: true });
      throw fehler;
    }
  } catch (fehler) {
    console.error("Backup konnte nicht eingespielt werden", fehler);
    return { ok: false, fehler: IMPORT_FEHLER.fehlgeschlagen };
  } finally {
    await handle.close();
  }
}
