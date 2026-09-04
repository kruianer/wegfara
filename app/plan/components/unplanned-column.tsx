import type { Poi } from "@/lib/pois/types";
import { POI_STATUS_COLOR, POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import { poiOrtUndTyp } from "@/lib/pois/meta-line";
import { formatEstimatedDuration } from "@/lib/pois/estimated-duration";
import styles from "./unplanned-column.module.css";

/**
 * Linke Spalte "Noch unverplant" der Planungsansicht (siehe req-011):
 * gesetzte und wahrscheinliche POIs, die noch mit keinem Programmpunkt
 * verknuepft sind.
 *
 * Seit req-039 laesst sich ein POI von hier auf den Zeitstrahl ziehen. Ohne
 * `onDragStart` ist das nicht moeglich -- dann bleibt es bei der Anzeige.
 */
export function UnplannedColumn({
  pois,
  onDragStart,
  onDragEnd,
}: {
  pois: Poi[];
  onDragStart?: (poi: Poi) => void;
  onDragEnd?: () => void;
}) {
  const draggable = Boolean(onDragStart);

  return (
    <div className={styles.column}>
      <h2 className={styles.title}>Noch unverplant</h2>
      <ul className={styles.list}>
        {pois.map((poi) => (
          <li
            key={poi.id}
            className={`${styles.card}${draggable ? ` ${styles.draggable}` : ""}`}
            data-testid={`unplanned-poi-${poi.id}`}
            draggable={draggable}
            onDragStart={(event) => {
              if (!onDragStart) return;
              // Manche Browser starten einen Zug nur mit gesetzten Daten; die
              // Oberflaeche selbst merkt sich den POI in ihrem Zustand.
              event.dataTransfer?.setData("text/plain", poi.id);
              onDragStart(poi);
            }}
            onDragEnd={onDragEnd}
          >
            <span
              className={styles.statusDot}
              style={{ background: POI_STATUS_COLOR[poi.status] }}
              aria-hidden="true"
              title={POI_STATUS_LABEL[poi.status]}
            />
            <div className={styles.body}>
              <p className={styles.name}>{poi.name}</p>
              <p className={styles.meta}>{poiOrtUndTyp(poi)}</p>
            </div>
            <span className={styles.duration}>
              {formatEstimatedDuration(poi.type)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
