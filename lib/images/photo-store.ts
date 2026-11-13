import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { envWert } from "@/lib/env/umgebung";
import {
  miniaturName,
  protokolliereMiniaturFehler,
  verkleinere,
} from "./miniatur";

/**
 * Die Ablage der Bilddateien (siehe stack.md): die Datei liegt im
 * Dateisystem, der Datensatz dazu in der Datenbank. Diese Schnittstelle
 * kapselt nur die Dateihaelfte — wer sie benutzt, schreibt den Datensatz
 * im selben Zug (kein Bild ohne Datensatz, kein Datensatz ohne Datei).
 */
export interface FileStore {
  save(fileName: string, data: Uint8Array): Promise<void>;
  read(fileName: string): Promise<Uint8Array | null>;
  remove(fileName: string): Promise<void>;
}

/**
 * Die Ablage der Fotos. Sie legt zu jedem Bild seine Miniatur daneben
 * (req-105) und raeumt sie mit dem Original wieder ab -- die Miniatur hat
 * keinen eigenen Datensatz und keinen eigenen Lebenslauf.
 */
export interface PhotoStore extends FileStore {
  /** Die Miniatur zu einem Original -- null, wenn (noch) keine da ist. */
  readMiniatur(fileName: string): Promise<Uint8Array | null>;
}

/**
 * Das Bildverzeichnis kommt ausschliesslich aus der Umgebungsvariable
 * IMAGE_DIR (siehe stack.md) — nie ein fest verdrahteter Pfad im Code.
 */
export function imageDir(): string {
  // Ein leer durchgereichter Wert zaehlt wie ein fehlender (bug-032) --
  // sonst waere die Bildablage das Arbeitsverzeichnis.
  const dir = envWert("IMAGE_DIR");
  if (!dir) throw new Error("IMAGE_DIR ist nicht gesetzt");
  return dir;
}

/**
 * Nur der reine Dateiname zaehlt. Der Name kommt zwar aus der eigenen
 * Datenbank, doch ein Pfad darin duerfte die Ablage nie verlassen.
 */
function fullPath(dir: string, fileName: string): string {
  return path.join(dir, path.basename(fileName));
}

/**
 * Die reine Dateiablage, ohne Miniaturen -- fuer die Dokumente (req-034),
 * die nie als Kachel erscheinen.
 */
export function fileSystemFileStore(dir: string = imageDir()): FileStore {
  return {
    async save(fileName, data) {
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath(dir, fileName), data);
    },
    async read(fileName) {
      try {
        return new Uint8Array(await readFile(fullPath(dir, fileName)));
      } catch {
        return null;
      }
    },
    async remove(fileName) {
      await rm(fullPath(dir, fileName), { force: true });
    },
  };
}

export function fileSystemPhotoStore(dir: string = imageDir()): PhotoStore {
  const files = fileSystemFileStore(dir);
  return {
    async save(fileName, data) {
      await files.save(fileName, data);
      // Das Original zaehlt; eine Miniatur, die nicht entsteht, ist kein
      // Grund, das Bild abzuweisen. Die Listen zeigen dann das Original
      // (req-105), und der Grund steht im Server-Log.
      try {
        const miniatur = await verkleinere(data);
        if (miniatur) await files.save(miniaturName(fileName), miniatur);
      } catch (error) {
        protokolliereMiniaturFehler(fileName, error);
      }
    },
    read: files.read,
    readMiniatur(fileName) {
      return files.read(miniaturName(fileName));
    },
    async remove(fileName) {
      await files.remove(fileName);
      await files.remove(miniaturName(fileName));
    },
  };
}
