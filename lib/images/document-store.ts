import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileSystemPhotoStore, imageDir, type PhotoStore } from "./photo-store";

/**
 * Die Ablage der Dokumente (req-034). Sie liegt im Bildverzeichnis, dessen
 * Pfad ausschliesslich aus der Umgebungsvariablen IMAGE_DIR kommt (siehe
 * delivery/stack.md) -- nie ein fest verdrahteter Pfad im Code.
 *
 * Dokumente bekommen darin ein eigenes Unterverzeichnis. Das ist kein
 * Ordnungssinn, sondern eine Bedingung fuer die taegliche Pruefung: sie
 * entfernt Dateien ohne Datensatz, und sie darf dabei nur Dateien
 * betrachten, fuer die sie zustaendig ist -- die POI-Fotos daneben gehen
 * sie nichts an.
 */
export const DOCUMENT_SUBDIR = "dokumente";

export interface DocumentStore extends PhotoStore {
  /** Die Namen aller abgelegten Dateien -- fuer die taegliche Pruefung (req-034). */
  list(): Promise<string[]>;
}

export function documentDir(): string {
  return path.join(imageDir(), DOCUMENT_SUBDIR);
}

export function fileSystemDocumentStore(
  dir: string = documentDir(),
): DocumentStore {
  const files = fileSystemPhotoStore(dir);
  return {
    ...files,
    async list() {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name);
      } catch {
        // Noch nichts abgelegt: das Verzeichnis entsteht mit der ersten
        // Datei. Nichts zu pruefen ist kein Fehler.
        return [];
      }
    },
  };
}
