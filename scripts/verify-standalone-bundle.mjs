// Prueft nach dem Build, ob Pakete, die nur im Browser laufen, im
// Standalone-Bundle (.next/standalone/node_modules) vorhanden sind. Next.js'
// automatische Datei-Ablaufverfolgung erkennt solche Pakete nicht zuverlaessig
// (siehe bug-006) — ein Fehlen faellt sonst erst beim Nutzer im Browser auf,
// nicht in der Testsuite (die die Bibliothek durch einen Nachbau ersetzt).
// Laeuft automatisch nach `npm run build` (siehe package.json "postbuild")
// und damit auch beim Bauen des Containers (deploy/Dockerfile).
import { access } from "node:fs/promises";
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
