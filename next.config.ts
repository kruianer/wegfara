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
};

export default nextConfig;
