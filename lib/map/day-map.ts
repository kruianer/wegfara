import type { Activity, ActivityPosition } from "@/lib/activities/types";
import { groupActivities, groupKey } from "@/lib/activities/groups";
import { activityPoiNummer } from "@/lib/pois/nummer";
import type { Transfer, TransferMode } from "@/lib/transfers/types";
import { insertTransfers, type PlanEntry } from "@/lib/transfers/timeline";

export interface DayMapMarker {
  /**
   * Die Nummer des POI, aus dem der Programmpunkt entstanden ist (req-013,
   * req-074) -- dieselbe Zahl, die in der POI-Liste, in der Auswahlliste und am
   * Programmpunkt des Zeitstrahls steht. Null, wo keine zu haben ist: ein von
   * Hand angelegter Programmpunkt (req-018), einer, dessen POI die Reise nicht
   * mehr fuehrt, oder ein Aufrufer, der keine Nummern mitgibt. Eine eigene
   * Zaehlung tritt dann nicht an ihre Stelle (bug-055).
   */
  poiNummer: number | null;
  /**
   * Die Stelle des Programmpunkts in der Tagesfolge, ab 1 gezaehlt. Der
   * Begleiter schreibt sie an seine Marker (req-008), passend zu seinem eigenen
   * Zeitstrahl; im Planer steht sie auf keinem Marker -- dort gilt die
   * POI-Nummer (bug-055).
   */
  reihenfolge: number;
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
  /**
   * Die POI-Nummer des frueheren Programmpunkts -- dieselbe, die sein Marker
   * traegt. Daran haengt der Richtungspfeil (req-075); null, wo sich kein
   * Marker zuordnen laesst oder wo er keine Nummer traegt (bug-055).
   */
  vonPoiNummer: number | null;
  /** Die POI-Nummer des spaeteren Programmpunkts. */
  nachPoiNummer: number | null;
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
  /**
   * Die Nummern der POIs der Reise nach ihrer Kennung (req-074) -- daraus
   * bekommen Marker und Linien ihre Zahl. Wer sie nicht mitgibt, bekommt Marker
   * ohne Nummer: gezaehlt wird hier nichts (bug-055).
   */
  poiNummern?: Map<string, number>;
}

/**
 * Leitet aus den Programmpunkten und Transfers eines Reisetages die
 * Kartendarstellung ab (siehe req-008): ein Marker je Zeitstrahl-Eintrag
 * (Options-Gruppen nur mit der gewaehlten Alternative), eine Linie je
 * hinterlegtem Transfer. Programmpunkte ohne Position erscheinen nicht als
 * Marker; Transfers ohne Position an Start oder Ziel erzeugen keine Linie.
 *
 * Die Zahl an einem Marker ist die POI-Nummer (bug-055) -- sie kommt aus den
 * mitgegebenen Nummern und wird hier nicht vergeben. Der Laufzaehler der
 * Tagesfolge steht daneben als `reihenfolge`; er beschriftet nur im Begleiter
 * einen Marker.
 */
export function buildDayMap(
  activities: Activity[],
  transfers: Transfer[],
  optionSelections: Record<string, string> = {},
  {
    verlaeufe = {},
    verbindeOhneTransfer = false,
    poiNummern = new Map<string, number>(),
  }: DayMapOptions = {},
): DayMapData {
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );

  // Die Stelle in der Tagesfolge je Eintrag, Transfers als Luecke.
  let counter = 0;
  const reihenfolgeJeEintrag = entries.map((entry) => {
    if (entry.kind === "transfer") return null;
    counter += 1;
    return counter;
  });

  // Die POI-Nummer je Eintrag: die Zahl, die sein Marker traegt, und die, die
  // der Richtungspfeil nennt (req-074, req-075, bug-055). Ein Transfer hat
  // keine -- er steht zwischen zwei Nummern, nicht auf einer.
  const poiNummerJeEintrag = entries.map((entry) =>
    entry.kind === "transfer"
      ? null
      : activityPoiNummer(
          gewaehlteActivity(entry, optionSelections),
          poiNummern,
        ),
  );

  const markers: DayMapMarker[] = [];
  entries.forEach((entry, index) => {
    const reihenfolge = reihenfolgeJeEintrag[index];
    if (entry.kind === "transfer" || reihenfolge === null) return;

    const activity = gewaehlteActivity(entry, optionSelections);
    if (!activity.position) return;
    markers.push({
      poiNummer: poiNummerJeEintrag[index],
      reihenfolge,
      activity,
      position: activity.position,
      isGroup: entry.kind === "group",
    });
  });

  const lines: DayMapLine[] = [];
  entries.forEach((entry, index) => {
    if (entry.kind === "transfer") {
      const from = activityById.get(entry.transfer.fromActivityId);
      const to = entry.toActivity;
      if (!from?.position || !to.position) return;

      // Ein Transfer steht zwischen den beiden Eintraegen, die er verbindet.
      lines.push(
        linie(
          from.position,
          to.position,
          entry.transfer,
          {
            von: poiNummerJeEintrag[index - 1] ?? null,
            nach: poiNummerJeEintrag[index + 1] ?? null,
          },
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
    if (von && nach) {
      lines.push(
        linie(von, nach, null, {
          von: poiNummerJeEintrag[index] ?? null,
          nach: poiNummerJeEintrag[index + 1] ?? null,
        }),
      );
    }
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
  poiNummern: { von: number | null; nach: number | null },
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
    vonPoiNummer: poiNummern.von,
    nachPoiNummer: poiNummern.nach,
  };
}
