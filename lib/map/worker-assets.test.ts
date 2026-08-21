// Prueft Dateien auf der Platte, nicht die Anzeige im Browser.
// @vitest-environment node
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  MAP_WORKER_DIR,
  MAP_WORKER_FILE,
  MAP_WORKER_SHARED_FILE,
  MAP_WORKER_URL,
} from "./worker-assets";
import {
  MAP_WORKER_ASSETS,
  MAP_WORKER_SOURCE_DIR,
  PUBLIC_MAP_WORKER_DIR,
  copyMapWorkerAssets,
} from "@/scripts/copy-map-worker.mjs";

const tempDirs: string[] = [];

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true })));
});

async function copyToTempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "wegfara-map-worker-"));
  tempDirs.push(dir);
  await copyMapWorkerAssets(dir);
  return dir;
}

describe("Worker der Kartenbibliothek (bug-013)", () => {
  it("liefert genau die Dateien aus, auf die die Anwendung zeigt", () => {
    expect(MAP_WORKER_ASSETS).toEqual([
      MAP_WORKER_FILE,
      MAP_WORKER_SHARED_FILE,
    ]);
  });

  it("legt die Dateien in dem Verzeichnis ab, aus dem der Browser sie laedt", () => {
    // public/maplibre wird unter /maplibre ausgeliefert.
    expect(PUBLIC_MAP_WORKER_DIR.split(path.sep).slice(-2)).toEqual([
      "public",
      MAP_WORKER_DIR.replace("/", ""),
    ]);
    expect(MAP_WORKER_URL).toBe(`${MAP_WORKER_DIR}/${MAP_WORKER_FILE}`);
  });

  it("kopiert die Dateien unveraendert aus dem installierten Paket", async () => {
    const dir = await copyToTempDir();

    for (const file of MAP_WORKER_ASSETS) {
      const original = await readFile(path.join(MAP_WORKER_SOURCE_DIR, file));
      const copy = await readFile(path.join(dir, file));
      expect(copy.equals(original)).toBe(true);
    }
  });

  it("legt die Datei mit ab, die der Worker selbst nachlaedt", async () => {
    // Der Worker importiert sie relativ zu seiner eigenen Adresse; liegt sie
    // nicht daneben, startet er nicht.
    const dir = await copyToTempDir();
    const worker = await readFile(path.join(dir, MAP_WORKER_FILE), "utf8");

    expect(worker).toContain(`./${MAP_WORKER_SHARED_FILE}`);
    expect(MAP_WORKER_ASSETS).toContain(MAP_WORKER_SHARED_FILE);
  });
});
