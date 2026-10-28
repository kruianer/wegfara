import type { Poi } from "../pois/types";
import { istKiBild } from "../pois/ki-bild";
import { poiFotoUrl } from "../pois/foto-url";
import { eigenesTitelfotoUrl, type TripTitelfoto } from "../trips/titelfoto";
import type { DruckTag, DruckTitelFoto } from "./types";

/**
 * Das Titelfoto des gedruckten Reiseplans (req-103): woher es kommt und was
 * im Feld "Titelfoto" der Reisedetails zur Wahl steht.
 */

/** Ein Foto der Reise, wie es im Gitter des Feldes "Titelfoto" steht. */
export interface TitelfotoKandidat {
  photoId: string;
  /** Die Herkunft, z.B. "1 · Guggenheim" -- damit man weiss, was man waehlt. */
  herkunft: string;
  istKiBild: boolean;
}

/**
 * Alle Fotos der POIs einer Reise, nach der Nummer des POI und darin in ihrer
 * Reihenfolge.
 */
export function titelfotoKandidaten(pois: Poi[]): TitelfotoKandidat[] {
  return [...pois]
    .sort((a, b) => a.number - b.number)
    .flatMap((poi) =>
      [...(poi.photos ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((photo) => ({
          photoId: photo.id,
          herkunft: `${poi.number} · ${poi.name}`,
          istKiBild: istKiBild(photo),
        })),
    );
}

/** Die Vorgabe: das erste Foto der ersten Station, die eines hat (req-080). */
function vorgabe(tage: DruckTag[]): DruckTitelFoto | null {
  for (const tag of tage) {
    for (const station of tag.stationen) {
      if (station.grossesFoto) {
        return {
          url: poiFotoUrl(station.grossesFoto.id),
          istKiBild: station.grossesFoto.istKiBild,
        };
      }
    }
  }
  return null;
}

/**
 * Das Foto des Deckblatts. Gewaehlt geht vor; ohne Wahl -- oder wenn das
 * gewaehlte Foto samt seinem POI nicht mehr da ist -- gilt die Vorgabe. Ins
 * Leere zeigt es nie (req-103, Constraints).
 */
export function druckTitelFoto({
  titelfoto,
  pois,
  tage,
}: {
  titelfoto: TripTitelfoto | null;
  pois: Poi[];
  tage: DruckTag[];
}): DruckTitelFoto | null {
  if (titelfoto?.art === "eigen") {
    return {
      url: eigenesTitelfotoUrl(titelfoto.tripId, titelfoto.stand),
      istKiBild: titelfoto.istKiBild,
    };
  }
  if (titelfoto?.art === "poi") {
    for (const poi of pois) {
      const photo = poi.photos?.find((p) => p.id === titelfoto.photoId);
      if (photo) {
        return { url: poiFotoUrl(photo.id), istKiBild: istKiBild(photo) };
      }
    }
  }
  return vorgabe(tage);
}
