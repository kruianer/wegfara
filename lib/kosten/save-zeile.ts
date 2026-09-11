import type { Poi, PoiBuchung } from "../pois/types";
import type { GespeicherteKostenzeile } from "./types";

const KOSTENZEILEN_API = "/api/kostenzeilen";

/**
 * Speichern aus der Tabelle der Kostenplanung heraus (req-062).
 *
 * Wohin eine Aenderung geht, entscheidet die Schnittstelle und nicht die
 * Oberflaeche: Preis und Buchungsstatus einer Zeile mit POI fliessen in den
 * POI zurueck (req-061) -- es gibt eine Wahrheit, an zwei Stellen bedienbar.
 * Deshalb bringt die Antwort den geaenderten POI mit; die Oberflaeche
 * uebernimmt ihn, damit er auch im Bereich POIs sofort richtig steht.
 */

/** Welche Zeile gemeint ist: die eines Programmpunkts oder eine manuelle. */
export type Zeilenziel = { activityId: string } | { id: string };

/**
 * Was die Tabelle aendert. Preis und Anzahl gehen als Text, wie sie
 * eingetippt wurden -- gelesen und geprueft werden sie serverseitig noch
 * einmal.
 */
export interface ZeilenAenderung {
  /** Nur an einer manuellen Zeile: die eines Programmpunkts kommt vom POI. */
  bezeichnung?: string;
  preis?: string;
  anzahl?: string;
  buchung?: PoiBuchung;
}

/** Die Angaben einer neuen manuellen Zeile (req-062). */
export interface NeueZeile {
  bezeichnung: string;
  preis: string;
  anzahl: string;
  buchung: PoiBuchung;
}

export interface ZeilenAntwort {
  /** Der geaenderte POI -- null, wenn keiner betroffen war. */
  poi: Poi | null;
  /** Die gespeicherte Zeile -- null, wenn nichts an ihr zu speichern war. */
  zeile: GespeicherteKostenzeile | null;
}

/**
 * Liefert null, wenn es fehlschlaegt. Die Oberflaeche nimmt ihre Anzeige
 * dann zurueck und sagt es -- ein verschluckter Fehlschlag saehe aus wie
 * gespeichert (bug-021).
 */
export async function saveKostenzeile(
  ziel: Zeilenziel,
  aenderung: ZeilenAenderung,
): Promise<ZeilenAntwort | null> {
  try {
    const response = await fetch(KOSTENZEILEN_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ziel, ...aenderung }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<ZeilenAntwort>;
    return { poi: payload.poi ?? null, zeile: payload.zeile ?? null };
  } catch {
    return null;
  }
}

/**
 * Legt eine manuelle Zeile an (req-062) -- fuer alles ohne Programmpunkt:
 * Maut, Parkgebuehren, Sprit. Liefert null, wenn es fehlschlaegt; die
 * Eingaben bleiben dann stehen.
 */
export async function createKostenzeile(
  tripId: string,
  zeile: NeueZeile,
): Promise<GespeicherteKostenzeile | null> {
  try {
    const response = await fetch(KOSTENZEILEN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, ...zeile }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      zeile?: GespeicherteKostenzeile;
    };
    return payload.zeile ?? null;
  } catch {
    return null;
  }
}

/**
 * Entfernt eine manuelle Zeile (req-062). Eine Zeile aus dem Zeitstrahl
 * laesst sich nicht entfernen -- sie verschwindet mit ihrem Programmpunkt.
 */
export async function removeKostenzeile(id: string): Promise<boolean> {
  try {
    const response = await fetch(KOSTENZEILEN_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
