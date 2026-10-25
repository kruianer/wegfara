import type { Activity } from "@/lib/activities/types";
import {
  groupActivities,
  groupKey,
  type ActivityGroup,
} from "@/lib/activities/groups";
import type { Transfer } from "@/lib/transfers/types";
import type { Poi } from "@/lib/pois/types";
import { poiZumProgrammpunkt } from "@/lib/activities/poi";
import { insertTransfers } from "@/lib/transfers/timeline";
import type { PlanEintrag, Standortlage } from "@/lib/live-status/types";
import {
  zeitstrahlLinien,
  type LinienStelle,
} from "@/lib/live-status/zeitstrahl-linien";
import { ActivityCard } from "./activity-card";
import { ActivityOptionGroup } from "./activity-option-group";
import { TransferRow } from "./transfer-row";
import { Linie } from "./zeitstrahl-linie";
import styles from "./timeline.module.css";

export function Timeline({
  activities,
  transfers = [],
  pois = [],
  optionSelections = {},
  onSelectOption = () => {},
  ohneMich = {},
  isToday = false,
  live = null,
}: {
  activities: Activity[];
  transfers?: Transfer[];
  /**
   * Die POIs, aus denen die Programmpunkte entstanden sind — von ihnen kommen
   * die Fotos der Kacheln (req-079).
   */
  pois?: Poi[];
  /** Gespeicherte Wahl je Options-Gruppe, Schluessel via `groupKey`. */
  optionSelections?: Record<string, string>;
  onSelectOption?: (group: ActivityGroup, activityId: string) => void;
  /**
   * Wer bei welchem Programmpunkt nicht dabei ist (req-054), je
   * Programmpunkt-Kennung die Namen. Gerechnet wird das in
   * lib/bewertungen/stand.ts.
   */
  ohneMich?: Record<string, string[]>;
  /**
   * Ob der gezeigte Tag heute ist (bug-062) -- nur dann tritt am Transfer
   * "Ab hier" (ab dem aktuellen Standort) hervor.
   */
  isToday?: boolean;
  /**
   * Uhr und Lage des Live-Status (req-086) -- nur am heutigen Tag einer
   * laufenden, freigegebenen Reise. Dann zeichnet der Zeitstrahl die
   * "Jetzt"- und die GPS-Linie; sonst gibt es keine.
   */
  live?: { zeit: string; eintrag: PlanEintrag; lage: Standortlage } | null;
}) {
  if (activities.length === 0) {
    return <p className={styles.empty}>Noch nichts geplant</p>;
  }

  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );

  const linien = live
    ? zeitstrahlLinien(entries, live.eintrag, live.lage, live.zeit)
    : null;
  const alle = linien
    ? [
        { art: "jetzt" as const, linie: linien.jetzt },
        ...(linien.gps ? [{ art: "gps" as const, linie: linien.gps }] : []),
      ]
    : [];
  /** Die Linien an dieser Stelle, die "Jetzt"-Linie zuerst. */
  const an = (art: LinienStelle["art"], index = -1) =>
    alle
      .filter(
        ({ linie: { stelle } }) =>
          stelle.art === art &&
          (stelle.art === "ende" || stelle.index === index),
      )
      .map(({ art, linie }) => <Linie key={art} art={art} text={linie.text} />);
  const amEnde = an("ende");

  const numbers: (number | null)[] = [];
  let counter = 0;
  for (const entry of entries) {
    if (entry.kind === "transfer") {
      numbers.push(null);
    } else {
      counter += 1;
      numbers.push(counter);
    }
  }

  return (
    /* Benannt, damit der Tagesplan sich von den uebrigen Listen des
       Begleiters unterscheiden laesst -- etwa vom Live-Status, der denselben
       Programmpunkt nennt (req-051). */
    <ol className={styles.list} aria-label="Tagesplan">
      {entries.map((entry, index) => {
        if (entry.kind === "transfer") {
          return (
            <li
              key={entry.transfer.id}
              className={`${styles.row} ${styles.transferRow}`}
            >
              {an("weg", index)}
              <div className={`${styles.rail} ${styles.railTransfer}`}>
                <span className={styles.transferDot} />
              </div>
              <TransferRow
                transfer={entry.transfer}
                fromActivity={entry.fromActivity}
                toActivity={entry.toActivity}
                isToday={isToday}
              />
            </li>
          );
        }

        const number = numbers[index];
        const key =
          entry.kind === "single" ? entry.activity.id : groupKey(entry.group);
        const davor = an("vor", index);
        return [
          davor.length > 0 && (
            <li key={`${key}-linie`} className={styles.row}>
              {davor}
            </li>
          ),
          <li key={key} className={styles.row}>
            {an("bei", index)}
            <div className={styles.rail}>
              <span
                className={`${styles.circle} ${
                  entry.kind === "group" ? styles.circleGroup : ""
                }`}
              >
                {number}
              </span>
            </div>
            {entry.kind === "single" ? (
              <ActivityCard
                activity={entry.activity}
                poi={poiZumProgrammpunkt(entry.activity, pois)}
                ohneMich={ohneMich[entry.activity.id]}
              />
            ) : (
              <ActivityOptionGroup
                activities={entry.group.activities}
                pois={pois}
                ohneMich={ohneMich}
                selectedId={
                  optionSelections[groupKey(entry.group)] ??
                  entry.group.activities[0].id
                }
                onSelect={(activityId) =>
                  onSelectOption(entry.group, activityId)
                }
              />
            )}
          </li>,
        ];
      })}
      {amEnde.length > 0 && <li className={styles.row}>{amEnde}</li>}
    </ol>
  );
}
