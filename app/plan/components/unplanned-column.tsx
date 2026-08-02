import type { Poi } from "@/lib/pois/types";
import { POI_STATUS_COLOR, POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import { POI_TYPE_LABEL } from "@/lib/pois/type-meta";
import { formatEstimatedDuration } from "@/lib/pois/estimated-duration";
import styles from "./unplanned-column.module.css";

/**
 * Linke Spalte "Noch unverplant" der Planungsansicht (siehe req-011):
 * gesetzte und wahrscheinliche POIs, die noch mit keinem Programmpunkt
 * verknuepft sind.
 */
export function UnplannedColumn({ pois }: { pois: Poi[] }) {
  return (
    <div className={styles.column}>
      <h2 className={styles.title}>Noch unverplant</h2>
      <ul className={styles.list}>
        {pois.map((poi) => (
          <li
            key={poi.id}
            className={styles.card}
            data-testid={`unplanned-poi-${poi.id}`}
          >
            <span
              className={styles.statusDot}
              style={{ background: POI_STATUS_COLOR[poi.status] }}
              aria-hidden="true"
              title={POI_STATUS_LABEL[poi.status]}
            />
            <div className={styles.body}>
              <p className={styles.name}>{poi.name}</p>
              <p className={styles.meta}>
                {poi.ort} · {POI_TYPE_LABEL[poi.type]}
              </p>
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
