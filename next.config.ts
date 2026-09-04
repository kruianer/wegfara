import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Erzeugt .next/standalone — vom deploy/Dockerfile vorausgesetzt.
  output: "standalone",
  // maplibre-gl laeuft ausschliesslich im Browser (Worker-Dateien werden
  // ueber import.meta.url nachgeladen). Die automatische Datei-Ablaufverfolgung
  // von "standalone" erkennt diesen Bezug nicht und laesst das Paket aus dem
  // ausgelieferten node_modules weg (siehe bug-006) — hier fuer alle Routen
  // erzwungen einbezogen.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/maplibre-gl/**",
      // nodemailer wird erst zur Laufzeit geladen; die Ablaufverfolgung
      // erkennt den Bezug nicht und liess das Paket weg (bug-010). Der
      // Versand scheiterte dadurch still, weil der Fehler im try-Block
      // haengen blieb.
      "./node_modules/nodemailer/**",
    ],
  },
  // Quelltext gehoert nicht ins Standalone-Bundle — ausgeliefert wird das
  // Bauergebnis unter .next/, nicht app/, lib/ oder components/.
  //
  // Die Ablaufverfolgung packte sie trotzdem hinein: lib/images/document-store.ts
  // liest das Dokumentverzeichnis mit readdir(path.join(imageDir(), "dokumente")).
  // Weil imageDir() aus der Umgebungsvariablen IMAGE_DIR kommt, kann die
  // statische Analyse den Pfad nicht aufloesen und sucht stattdessen ueberall
  // im Projekt nach einem Verzeichnis "dokumente" — und findet app/api/dokumente.
  // Damit landeten dessen route.ts und route.test.ts im Bundle, und der
  // Testlauf sammelte die Kopien wieder ein.
  outputFileTracingExcludes: {
    // "**" statt "/**": es soll jeden Eintragspunkt treffen, auch
    // instrumentation.ts — das hat keinen Routenpfad und faellt sonst durch.
    "**": [
      "./app/**",
      "./components/**",
      "./lib/**",
      "./tests/**",
      "./**/*.test.*",
    ],
  },
};

export default nextConfig;
