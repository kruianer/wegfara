/**
 * Adressen, unter denen der Worker der Kartenbibliothek ausgeliefert wird
 * (siehe bug-013). Die Dateien landen ueber scripts/copy-map-worker.mjs in
 * public/maplibre/ — die Liste dort und die Angaben hier muessen
 * uebereinstimmen; lib/map/worker-assets.test.ts prueft das.
 *
 * Ohne feste Adresse errechnet maplibre-gl die Worker-Adresse aus
 * `import.meta.url`, was im gebuendelten Code von Next ins Leere zeigt: der
 * Worker startet nicht, GeoJSON-Quellen werden nie in Kacheln geschnitten
 * und bleiben unsichtbar.
 */

/** Verzeichnis unterhalb von public/, aus dem der Worker geladen wird. */
export const MAP_WORKER_DIR = "/maplibre";

/** Dateiname des Workers selbst. */
export const MAP_WORKER_FILE = "maplibre-gl-worker.mjs";

/**
 * Der Worker laedt diese Datei per relativem Import nach; sie muss deshalb
 * im selben Verzeichnis liegen.
 */
export const MAP_WORKER_SHARED_FILE = "maplibre-gl-shared.mjs";

/** Feste Adresse des Workers, die an die Kartenbibliothek gemeldet wird. */
export const MAP_WORKER_URL = `${MAP_WORKER_DIR}/${MAP_WORKER_FILE}`;
