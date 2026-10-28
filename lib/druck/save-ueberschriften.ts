import {
  UEBERSCHRIFTEN_FEHLGESCHLAGEN,
  type TagesUeberschrift,
} from "./ueberschriften";

/**
 * Die Ueberschriften der Reisetage aus dem Browser heraus erzeugen lassen
 * oder von Hand setzen (req-103). Bei einem Fehlschlag steht der Grund da
 * (bug-021), und die bisherigen Ueberschriften bleiben.
 */

const API = "/api/tages-ueberschriften";

export type UeberschriftenErgebnis =
  | { ok: true; ueberschriften: TagesUeberschrift[] }
  | { ok: false; error: string };

async function antwort(
  anfrage: () => Promise<Response>,
  fehlschlag: string,
): Promise<UeberschriftenErgebnis> {
  let response: Response;
  try {
    response = await anfrage();
  } catch {
    return { ok: false, error: fehlschlag };
  }
  let payload: {
    ueberschriften?: TagesUeberschrift[];
    error?: string;
  } | null;
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    payload = null;
  }
  if (!response.ok || !payload?.ueberschriften) {
    return { ok: false, error: payload?.error ?? fehlschlag };
  }
  return { ok: true, ueberschriften: payload.ueberschriften };
}

/** Laesst die KI die Ueberschriften vorschlagen -- von Hand gesetzte bleiben. */
export function erzeugeUeberschriften(
  tripId: string,
): Promise<UeberschriftenErgebnis> {
  return antwort(
    () =>
      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      }),
    UEBERSCHRIFTEN_FEHLGESCHLAGEN,
  );
}

/** Setzt eine Ueberschrift von Hand; ein leerer Text nimmt sie weg. */
export function setzeUeberschrift(
  tripId: string,
  datum: string,
  text: string,
): Promise<UeberschriftenErgebnis> {
  return antwort(
    () =>
      fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, datum, text }),
      }),
    "Die Überschrift konnte nicht gespeichert werden.",
  );
}
