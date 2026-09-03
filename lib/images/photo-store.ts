import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Die Ablage der Bilddateien (siehe stack.md): die Datei liegt im
 * Dateisystem, der Datensatz dazu in der Datenbank. Diese Schnittstelle
 * kapselt nur die Dateihaelfte — wer sie benutzt, schreibt den Datensatz
 * im selben Zug (kein Bild ohne Datensatz, kein Datensatz ohne Datei).
 */
export interface PhotoStore {
  save(fileName: string, data: Uint8Array): Promise<void>;
  read(fileName: string): Promise<Uint8Array | null>;
  remove(fileName: string): Promise<void>;
}

/**
 * Das Bildverzeichnis kommt ausschliesslich aus der Umgebungsvariable
 * IMAGE_DIR (siehe stack.md) — nie ein fest verdrahteter Pfad im Code.
 */
export function imageDir(): string {
  const dir = process.env.IMAGE_DIR;
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

export function fileSystemPhotoStore(dir: string = imageDir()): PhotoStore {
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
