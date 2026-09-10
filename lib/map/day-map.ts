import type { Activity, ActivityPosition } from "@/lib/activities/types";
import { groupActivities, groupKey } from "@/lib/activities/groups";
import type { Transfer, TransferMode } from "@/lib/transfers/types";
import { insertTransfers, type PlanEntry } from "@/lib/transfers/timeline";

export interface DayMapMarker {
  /** Reihenfolge im Zeitstrahl, identisch zu dessen Nummerierung. */
  number: number;
  activity: Activity;
  position: ActivityPosition;
  /** Gehoert der Marker zu einer Options-Gruppe (siehe req-004)? */
  isGroup: boolean;
}

export interface DayMapLine {
  /** Das Verkehrsmittel des Transfers; null zwischen zweien ohne Transfer. */
  mode: TransferMode | null;
  from: ActivityPosition;
  to: ActivityPosition;
  /** Zu welchem Transfer die Linie gehoert; null, wo keiner liegt. */
  transferId: string | null;
  /**
   * Der Verlauf der Linie (req-059): zwei Punkte fuer die Gerade, mehr fuer
   * den Strassenverlauf.
   */
  verlauf: ActivityPosition[];
  /** Gerade (gepunktet) oder dem Strassenverlauf folgend? */
  gerade: boolean;
}

export interface DayMapData {
  markers: DayMapMarker[];
  lines: DayMapLine[];
}

export interface DayMapOptions {
  /**
   * Der Strassenverlauf je Transfer (req-059), soweit ermittelt. Was fehlt --
   * stummer Dienst, Verkehrsmittel ohne Profil -- wird zur Geraden.
   */
  verlaeufe?: Record<string, ActivityPosition[]>;
  /**
   * Ob auch zwei aufeinanderfolgende Programmpunkte ohne Transfer verbunden
   * werden. Der Planer tut es (req-011, eine gepunktete Gerade), der
   * Begleiter nicht (req-008: ohne Transfer keine Linie).
   */
  verbindeOhneTransfer?: boolean;
}

/**
 * Leitet aus den Programmpunkten und Transfers eines Reisetages die
 * Kartendarstellung ab (siehe req-008): ein Marker je Zeitstrahl-Eintrag
 * (Options-Gruppen nur mit der gewaehlten Alternative), eine Linie je
 * hinterlegtem Transfer. Programmpunkte ohne Position erscheinen nicht als
 * Marker; Transfers ohne Position an Start oder Ziel erzeugen keine Linie.
 */
export function buildDayMap(
  activities: Activity[],
  transfers: Transfer[],
  optionSelections: Record<string, string> = {},
  { verlaeufe = {}, verbindeOhneTransfer = false }: DayMapOptions = {},
): DayMapData {
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );

  const markers: DayMapMarker[] = [];
  let counter = 0;
  for (const entry of entries) {
    if (entry.kind === "transfer") continue;
    counter += 1;

    const activity = gewaehlteActivity(entry, optionSelections);
    if (!activity.position) continue;
    markers.push({
      number: counter,
      activity,
      position: activity.position,
      isGroup: entry.kind === "group",
    });
  }

  const lines: DayMapLine[] = [];
  entries.forEach((entry, index) => {
    if (entry.kind === "transfer") {
      const from = activityById.get(entry.transfer.fromActivityId);
      const to = entry.toActivity;
      if (!from?.position || !to.position) return;

      lines.push(
        linie(
          from.position,
          to.position,
          entry.transfer,
          verlaeufe[entry.transfer.id],
        ),
      );
      return;
    }

    // Zwischen zwei Programmpunkten ohne Transfer bleibt die gepunktete
    // Gerade (req-011, req-059); im Begleiter wird dort nichts gezeichnet.
    const next = entries[index + 1];
    if (!verbindeOhneTransfer || !next || next.kind === "transfer") return;

    const von = gewaehlteActivity(entry, optionSelections).position;
    const nach = gewaehlteActivity(next, optionSelections).position;
    if (von && nach) lines.push(linie(von, nach, null));
  });

  return { markers, lines };
}

/** Die Alternative einer Options-Gruppe, die gewaehlt ist (siehe req-004). */
function gewaehlteActivity(
  entry: Exclude<PlanEntry, { kind: "transfer" }>,
  optionSelections: Record<string, string>,
): Activity {
  if (entry.kind === "single") return entry.activity;

  return (
    entry.group.activities.find(
      (a) =>
        a.id ===
        (optionSelections[groupKey(entry.group)] ??
          entry.group.activities[0].id),
    ) ?? entry.group.activities[0]
  );
}

/**
 * Eine Linie zwischen zwei Programmpunkten: dem Strassenverlauf folgend, wo
 * einer ermittelt wurde, sonst die Gerade (req-059).
 */
function linie(
  from: ActivityPosition,
  to: ActivityPosition,
  transfer: Transfer | null,
  verlauf?: ActivityPosition[],
): DayMapLine {
  const folgtDerStrasse = Array.isArray(verlauf) && verlauf.length >= 2;

  return {
    mode: transfer?.mode ?? null,
    from,
    to,
    transferId: transfer?.id ?? null,
    verlauf: folgtDerStrasse ? verlauf : [from, to],
    gerade: !folgtDerStrasse,
  };
}
