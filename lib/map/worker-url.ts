import { setWorkerUrl } from "maplibre-gl";
import { MAP_WORKER_URL } from "./worker-assets";

let pinned = false;

/**
 * Meldet der Kartenbibliothek die feste Adresse ihres Workers (bug-013).
 *
 * Muss vor der ersten Karte laufen: die Bibliothek legt ihren Worker-Pool
 * einmalig beim Erzeugen der ersten Karte an und liest die Adresse nur
 * dabei. Ohne diesen Aufruf errechnet sie die Adresse selbst aus
 * `import.meta.url` — im gebuendelten Code von Next zeigt das Ergebnis ins
 * Leere, der Worker startet nie und GeoJSON-Quellen werden nie verarbeitet:
 * Linien und Flaechen bleiben unsichtbar, ohne Konsolenfehler.
 */
export function ensureMapWorkerUrl(): void {
  if (pinned) return;
  pinned = true;
  setWorkerUrl(MAP_WORKER_URL);
}
