// Legt den Worker der Kartenbibliothek unter public/ ab, damit der Browser
// ihn unter einer festen, gueltigen Adresse laden kann (siehe bug-013).
//
// Hintergrund: maplibre-gl ermittelt die Adresse seines Workers zur Laufzeit
// aus `import.meta.url` seines eigenen Moduls. Der Bundler von Next legt das
// Modul unter einem Namen mit Inhalts-Hash ab
// (/_next/static/media/maplibre-gl.<hash>.mjs) und faltet den daraus
// abgeleiteten Ausdruck falsch zusammen — die errechnete Worker-Adresse
// zeigt ins Leere. Der Worker startet dann nie.
//
// Das faellt nicht auf: Kachel-Ebenen werden im Hauptthread gezeichnet und
// sehen normal aus. GeoJSON-Quellen dagegen werden ausschliesslich im Worker
// in Kacheln geschnitten — ohne ihn nimmt setData() die Daten zwar entgegen,
// die Karte verarbeitet sie aber nie. Linie und Flaeche des Suchgebiets
// blieben so unsichtbar, ohne einen einzigen Konsolenfehler.
//
// Laeuft automatisch vor `npm run build` und `npm run dev` (siehe
// package.json) und damit auch beim Bauen des Containers (deploy/Dockerfile).
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Die auszuliefernden Dateien. Reihenfolge ist bedeutsam: die erste ist der
 * Worker selbst, auf den lib/map/worker-assets.ts zeigt. Die zweite laedt der
 * Worker per relativem Import nach und muss deshalb neben ihm liegen.
 */
export const MAP_WORKER_ASSETS = [
  "maplibre-gl-worker.mjs",
  "maplibre-gl-shared.mjs",
];

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Quellverzeichnis der Dateien im installierten Paket. */
export const MAP_WORKER_SOURCE_DIR = path.join(
  repoRoot,
  "node_modules",
  "maplibre-gl",
  "dist",
);

/** Zielverzeichnis; muss zu MAP_WORKER_DIR aus lib/map/worker-assets.ts passen. */
export const PUBLIC_MAP_WORKER_DIR = path.join(repoRoot, "public", "maplibre");

/** Kopiert die Worker-Dateien in das Zielverzeichnis und legt es an. */
export async function copyMapWorkerAssets(targetDir = PUBLIC_MAP_WORKER_DIR) {
  await mkdir(targetDir, { recursive: true });
  for (const file of MAP_WORKER_ASSETS) {
    await copyFile(
      path.join(MAP_WORKER_SOURCE_DIR, file),
      path.join(targetDir, file),
    );
  }
  return targetDir;
}

// Nur ausfuehren, wenn direkt aufgerufen — nicht beim Import aus Tests.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  copyMapWorkerAssets().catch((err) => {
    console.error(
      "Der Worker der Kartenbibliothek konnte nicht nach public/maplibre " +
        "kopiert werden. Ohne ihn bleiben GeoJSON-Ebenen unsichtbar (bug-013).",
    );
    console.error(err);
    process.exit(1);
  });
}
