import type { Activity } from "./types";

/**
 * Verplanen und Freigeben eines POI (req-039). Beides ist sofort gespeichert
 * -- die Oberflaeche zeigt das Ergebnis erst, wenn es geschrieben ist. Ein
 * fehlgeschlagener Aufruf liefert null und darf nicht stillschweigend als
 * verplant erscheinen (anders als beim Status, siehe lib/pois/save-status.ts).
 */

const PROGRAMMPUNKTE_API = "/api/programmpunkte";

async function activityAntwort(response: Response): Promise<Activity | null> {
  if (!response.ok) return null;
  try {
    return (
      ((await response.json()) as { activity?: Activity }).activity ?? null
    );
  } catch {
    return null;
  }
}

/** Legt den Programmpunkt zu einem POI an, beginnend zur uebergebenen Zeit. */
export async function planPoi(
  poiId: string,
  startAt: string,
): Promise<Activity | null> {
  try {
    return await activityAntwort(
      await fetch(PROGRAMMPUNKTE_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poiId, startAt }),
      }),
    );
  } catch {
    return null;
  }
}

/** Entfernt einen Programmpunkt und liefert ihn samt seiner POI-Verknuepfung. */
export async function removeActivity(
  activityId: string,
): Promise<Activity | null> {
  try {
    return await activityAntwort(
      await fetch(PROGRAMMPUNKTE_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activityId }),
      }),
    );
  } catch {
    return null;
  }
}
