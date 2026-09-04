// Prueft nach dem Build, ob Pakete, die nur im Browser laufen, im
// Standalone-Bundle (.next/standalone/node_modules) vorhanden sind. Next.js'
// automatische Datei-Ablaufverfolgung erkennt solche Pakete nicht zuverlaessig
// (siehe bug-006) — ein Fehlen faellt sonst erst beim Nutzer im Browser auf,
// nicht in der Testsuite (die die Bibliothek durch einen Nachbau ersetzt).
// Laeuft automatisch nach `npm run build` (siehe package.json "postbuild")
// und damit auch beim Bauen des Containers (deploy/Dockerfile).
import { access, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  MAP_WORKER_ASSETS,
  PUBLIC_MAP_WORKER_DIR,
} from "./copy-map-worker.mjs";

// Pakete, deren Bezug die Ablaufverfolgung nicht erkennt: entweder weil sie
// nur im Browser laufen (maplibre-gl, bug-006) oder erst zur Laufzeit
// geladen werden (nodemailer, bug-010). Fehlen sie, scheitert die Funktion
// still — beim Mailversand blieb der Fehler sogar ohne Logeintrag.
const BROWSER_ONLY_PACKAGES = ["maplibre-gl", "nodemailer"];

// Quelltext-Endungen, die im Bundle nichts zu suchen haben: ausgeliefert wird
// das Bauergebnis unter .next/, nicht app/, lib/ oder components/.
const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/**
 * Sammelt Quelldateien, die die Ablaufverfolgung faelschlich ins Bundle
 * gezogen hat. node_modules und das Bauergebnis .next/ bleiben aussen vor —
 * dort sind Quelldateien der Pakete bzw. echte Bauartefakte erwartbar.
 */
async function straySourceFiles(dir, root = dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await straySourceFiles(full, root)));
    } else if (SOURCE_EXTENSIONS.includes(path.extname(entry.name))) {
      found.push(path.relative(root, full));
    }
  }
  return found;
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const standaloneModules = path.join(
    process.cwd(),
    ".next",
    "standalone",
    "node_modules",
  );

  const missing = [];
  for (const pkg of BROWSER_ONLY_PACKAGES) {
    if (!(await exists(path.join(standaloneModules, pkg)))) {
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    console.error(
      `Fehlt im Standalone-Bundle (.next/standalone/node_modules): ${missing.join(", ")}\n` +
        "Diese Pakete laufen nur im Browser; Next.js' Datei-Ablaufverfolgung " +
        "hat sie nicht erkannt. Siehe outputFileTracingIncludes in next.config.ts.",
    );
    process.exit(1);
  }

  // Der Worker der Kartenbibliothek wird als statische Datei ausgeliefert
  // (bug-013). Fehlt er, verarbeitet die Karte im Browser keine
  // GeoJSON-Quellen — Linien und Flaechen bleiben lautlos unsichtbar.
  const missingWorker = [];
  for (const file of MAP_WORKER_ASSETS) {
    if (!(await exists(path.join(PUBLIC_MAP_WORKER_DIR, file)))) {
      missingWorker.push(file);
    }
  }

  if (missingWorker.length > 0) {
    console.error(
      `Fehlt unter public/maplibre: ${missingWorker.join(", ")}\n` +
        "Ohne diese Dateien startet der Worker der Kartenbibliothek nicht " +
        "und GeoJSON-Ebenen bleiben unsichtbar (bug-013). " +
        "Erzeugt werden sie von scripts/copy-map-worker.mjs (npm-Skript prebuild).",
    );
    process.exit(1);
  }

  // Quelltext raeumen, den die Ablaufverfolgung faelschlich einbezogen hat:
  // lib/images/document-store.ts liest das Dokumentverzeichnis mit
  // readdir(path.join(imageDir(), "dokumente")). Weil imageDir() aus der
  // Umgebungsvariablen IMAGE_DIR kommt, kann die statische Analyse den Pfad
  // nicht aufloesen und sucht stattdessen im Projekt nach einem Verzeichnis
  // "dokumente" — und findet app/api/dokumente. Dessen route.ts und
  // route.test.ts landeten so im Bundle; der Testlauf sammelte die Kopien
  // wieder ein und lief gegen eine zweite Next-Installation.
  //
  // Fuer die Routen erledigt das outputFileTracingExcludes in
  // next.config.ts. instrumentation.ts hat keinen Routenpfad, und Next
  // wendet die Ausnahmen nur auf Eintragspunkte mit Route an — was ueber
  // dessen Ablaufverfolgung hereinkommt, bleibt hier haengen.
  const standalone = path.join(process.cwd(), ".next", "standalone");
  const stray = await straySourceFiles(standalone);
  for (const file of stray) {
    await rm(path.join(standalone, file), { force: true });
  }
  if (stray.length > 0) {
    console.warn(
      `Quelltext aus dem Standalone-Bundle entfernt: ${stray.join(", ")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
