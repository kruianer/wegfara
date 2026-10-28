import { poiPhotoUploadProblem } from "../pois/photo-upload";
import { KI_BILD_FEHLGESCHLAGEN } from "../pois/ki-bild";
import { TITELFOTO_FEHLGESCHLAGEN, type TripTitelfoto } from "./titelfoto";

/**
 * Das Titelfoto einer Reise aus dem Browser heraus waehlen, hochladen,
 * erzeugen oder zuruecknehmen (req-103). Jede Antwort nennt bei einem
 * Fehlschlag ihren Grund (bug-021) -- die bisherige Wahl bleibt dann stehen.
 */

const TITELFOTO_API = "/api/reise-titelfoto";

export type TitelfotoErgebnis =
  | { ok: true; titelfoto: TripTitelfoto | null }
  | { ok: false; error: string };

async function antwort(
  anfrage: () => Promise<Response>,
  fehlschlag: string,
): Promise<TitelfotoErgebnis> {
  let response: Response;
  try {
    response = await anfrage();
  } catch {
    return { ok: false, error: fehlschlag };
  }

  let payload: { titelfoto?: TripTitelfoto | null; error?: string } | null;
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.titelfoto === undefined) {
    return { ok: false, error: payload?.error ?? fehlschlag };
  }
  return { ok: true, titelfoto: payload.titelfoto };
}

/** Waehlt ein Foto der Reise -- `null` nimmt die Wahl zurueck. */
export function waehleTitelfoto(
  tripId: string,
  photoId: string | null,
): Promise<TitelfotoErgebnis> {
  return antwort(
    () =>
      fetch(TITELFOTO_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, photoId }),
      }),
    TITELFOTO_FEHLGESCHLAGEN,
  );
}

/** Legt ein eigenes Bild als Titelfoto ab. */
export async function ladeTitelfotoHoch(
  tripId: string,
  datei: File,
): Promise<TitelfotoErgebnis> {
  // Dieselbe Pruefung wie am Server -- hier die Bequemlichkeit, dort der
  // Schutz.
  const problem = poiPhotoUploadProblem(datei);
  if (problem) return { ok: false, error: problem };
  const form = new FormData();
  form.append("tripId", tripId);
  form.append("datei", datei);
  return antwort(
    () => fetch(TITELFOTO_API, { method: "POST", body: form }),
    TITELFOTO_FEHLGESCHLAGEN,
  );
}

/** Laesst die KI ein Titelbild erzeugen (req-072). */
export function erzeugeTitelfoto(tripId: string): Promise<TitelfotoErgebnis> {
  return antwort(
    () =>
      fetch(`${TITELFOTO_API}/ki`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      }),
    KI_BILD_FEHLGESCHLAGEN,
  );
}
