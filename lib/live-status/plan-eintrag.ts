import type { Activity } from "@/lib/activities/types";
import type { PlanEintrag } from "./types";

/**
 * Was zur Uhrzeit `jetzt` unter "Laut Plan" steht (req-051): der laufende
 * Programmpunkt, sonst der naechste anstehende desselben Tages mit seiner
 * Uhrzeit. Ist heute nichts mehr geplant, gibt es keinen Eintrag.
 *
 * `jetzt` ist die lokale Reisezeit als "YYYY-MM-DDTHH:mm" -- dieselbe Form,
 * in der Beginn und Ende eines Programmpunkts stehen. Damit vergleicht sich
 * beides als Text, ohne Zeitzonenrechnung.
 *
 * Laufen mehrere gleichzeitig (Options-Gruppe), gilt der erste; welche
 * Alternative gewaehlt ist, spielt fuer den Zeitplan keine Rolle -- sie
 * liegen alle am selben Zeitpunkt.
 */
export function planEintragZu(
  activities: Activity[],
  jetzt: string,
): PlanEintrag {
  const sortiert = [...activities].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );

  const laufend = sortiert.find(
    (activity) => activity.startAt <= jetzt && jetzt < activity.endAt,
  );
  if (laufend) return { art: "laufend", activity: laufend };

  const heute = jetzt.slice(0, 10);
  const naechster = sortiert.find(
    (activity) =>
      activity.startAt > jetzt && activity.startAt.startsWith(heute),
  );
  return naechster ? { art: "naechster", activity: naechster } : null;
}
