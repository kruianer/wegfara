import type { Activity } from "./types";

/**
 * Verplanen und Freigeben eines POI (req-039) sowie das Umplanen seines
 * Programmpunkts (req-040). Alles ist sofort gespeichert -- die Oberflaeche
 * zeigt das Ergebnis erst, wenn es geschrieben ist. Ein fehlgeschlagener
 * Aufruf liefert null und darf nicht stillschweigend als verplant erscheinen
 * (anders als beim Status, siehe lib/pois/save-status.ts).
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

async function umplanen(
  body: Record<string, string>,
): Promise<Activity | null> {
  try {
    return await activityAntwort(
      await fetch(PROGRAMMPUNKTE_API, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  } catch {
    return null;
  }
}

/**
 * Verschiebt einen Programmpunkt auf eine neue Startzeit -- auch auf einen
 * anderen Reisetag; seine Dauer bleibt gleich (req-040).
 */
export async function moveActivity(
  activityId: string,
  startAt: string,
): Promise<Activity | null> {
  return umplanen({ id: activityId, startAt });
}

/** Zieht den unteren Rand eines Programmpunkts auf ein neues Ende (req-040). */
export async function resizeActivity(
  activityId: string,
  endAt: string,
): Promise<Activity | null> {
  return umplanen({ id: activityId, endAt });
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
