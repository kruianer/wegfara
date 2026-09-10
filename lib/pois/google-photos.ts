import { randomUUID } from "node:crypto";
import type { Queryable } from "@/lib/db/queryable";
import { listPhotosOfPoi, replacePoiPhotos } from "@/lib/db/poi-photos";
import { fileSystemPhotoStore } from "@/lib/images/photo-store";
import {
  schwereresProblem,
  type GoogleFotoProblem,
} from "./google-foto-problem";
import type { PoiPhoto } from "./types";

/** Woher die Bilder kommen — mehr braucht das Uebernehmen nicht (req-026). */
export interface GooglePhotoSource {
  fetchPhoto(photoName: string): Promise<Uint8Array | null>;
}

/**
 * Was beim Uebernehmen herauskam: die Bilder des POI in ihrer Reihenfolge --
 * und, falls etwas fehlt, warum (bug-027). `problem: null` heisst, dass
 * jedes angekuendigte Foto abgelegt wurde.
 */
export interface GoogleFotoErgebnis {
  photos: PoiPhoto[];
  problem: GoogleFotoProblem | null;
}

/**
 * Laedt die Fotos eines Ortes bei Google herunter, legt sie in der
 * Bildablage ab und schreibt zu jeder Datei ihren Datensatz (siehe
 * stack.md: kein Bild ohne Datensatz, kein Datensatz ohne Datei).
 *
 * Ein Foto, das sich nicht holen oder nicht ablegen laesst, entfaellt fuer
 * sich — der POI bleibt bestehen und zeigt dann die farbige Flaeche seines
 * Typs. Ohne nutzbare Bildablage entfallen alle.
 *
 * Beides wird gemeldet und nicht verschluckt (bug-027): der Aufrufer traegt
 * den Grund bis in die Oberflaeche, damit fehlende Bilder nicht wie ein Ort
 * ohne Bilder aussehen. Stillschweigend ein leeres Ergebnis zurueckzugeben
 * war genau der Fehler.
 *
 * Gebraucht wird das an zwei Stellen: beim POI aus einem Google-Maps-Link
 * (req-026) und bei jedem Vorschlag der KI-Suche (req-057).
 */
export async function uebernehmeGoogleFotos(
  db: Queryable,
  poiId: string,
  photoNames: string[],
  google: GooglePhotoSource,
  now: Date = new Date(),
): Promise<GoogleFotoErgebnis> {
  let store;
  try {
    store = fileSystemPhotoStore();
  } catch {
    // Ohne Bildverzeichnis gibt es keine Ablage. Die vorhandenen Bilder des
    // POI bleiben unangetastet -- sie hier zu ersetzen hiesse, sie gegen
    // nichts zu tauschen. Gemeldet wird deshalb der Stand aus der Datenbank
    // und der Grund dazu, nie ein leeres Ergebnis ohne Erklaerung.
    return {
      photos: await listPhotosOfPoi(db, poiId),
      problem: "ablage_fehlt",
    };
  }

  const fileNames: string[] = [];
  // Nicht der erste Grund gewinnt, sondern der schwerste: ein Bild, das sich
  // nicht ablegen laesst, wiegt mehr als eines, das Google nicht herausgibt.
  let problem: GoogleFotoProblem | null = null;

  for (const photoName of photoNames) {
    const data = await google.fetchPhoto(photoName);
    if (!data) {
      problem = schwereresProblem(problem, "nicht_geholt");
      continue;
    }
    const fileName = `${randomUUID()}.jpg`;
    try {
      await store.save(fileName, data);
    } catch {
      problem = schwereresProblem(problem, "nicht_gespeichert");
      continue;
    }
    fileNames.push(fileName);
  }

  const { photos, removedFileNames } = await replacePoiPhotos(
    db,
    poiId,
    fileNames,
    now,
  );
  // Beim Auffrischen abgeloeste Dateien duerfen nicht zurueckbleiben.
  for (const alt of removedFileNames) {
    await store.remove(alt).catch(() => {});
  }

  return { photos, problem };
}
