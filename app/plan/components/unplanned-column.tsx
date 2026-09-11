import { useState } from "react";
import type { Poi } from "@/lib/pois/types";
import { POI_STATUS_COLOR, POI_STATUS_LABEL } from "@/lib/pois/status-meta";
import { poiOrtUndTyp } from "@/lib/pois/meta-line";
import { formatPoiDuration } from "@/lib/pois/estimated-duration";
import { usePointerDrag, type DropTarget } from "./pointer-drag";
import styles from "./unplanned-column.module.css";
import bildlauf from "@/components/bildlauf.module.css";

/**
 * Linke Spalte "Noch unverplant" der Planungsansicht (siehe req-011):
 * gesetzte und wahrscheinliche POIs, die noch mit keinem Programmpunkt
 * verknuepft sind.
 *
 * Seit req-039 laesst sich ein POI von hier auf den Zeitstrahl ziehen -- mit
 * der Maus nativ, seit bug-017 mit dem Finger ueber Zeiger-Ereignisse. Ohne
 * `onDragStart` ist das nicht moeglich -- dann bleibt es bei der Anzeige.
 *
 * Waehrend des Zuges zeigt der Zeitstrahl einen Umriss (req-046). Wo der
 * Finger dabei steht, weiss nur diese Spalte -- ihm gehoeren die
 * Zeiger-Ereignisse, sobald der Zug laeuft; sie meldet es deshalb weiter.
 *
 * Bleibt der Finger auf einer Karte liegen, ist der POI gegriffen (bug-023):
 * seine Rahmenfarbe sagt es an, und von da an laesst er sich in einem Zug
 * direkt auf die Uhrzeit ziehen.
 */
export function UnplannedColumn({
  pois,
  onDragStart,
  onDragEnd,
  onPointerDragMove,
  onPointerDrop,
  onPointerDragEnd,
}: {
  pois: Poi[];
  onDragStart?: (poi: Poi) => void;
  onDragEnd?: () => void;
  /** Mit dem Finger ueber einer Ablageflaeche bewegt (req-046). */
  onPointerDragMove?: (poi: Poi, target: DropTarget | null) => void;
  /** Mit dem Finger auf einer Ablageflaeche losgelassen (bug-017). */
  onPointerDrop?: (poi: Poi, target: DropTarget) => void;
  /** Der Finger-Zug ist vorbei, gleich ob abgelegt oder abgebrochen (req-046). */
  onPointerDragEnd?: () => void;
}) {
  const draggable = Boolean(onDragStart);
  // Welcher POI gerade unter dem Finger gegriffen ist (bug-023) -- er allein
  // traegt die Rueckmeldung.
  const [gegriffenerPoi, setGegriffenerPoi] = useState<Poi | null>(null);
  const fingerZug = usePointerDrag<Poi>({
    enabled: Boolean(onPointerDrop),
    onGrab: setGegriffenerPoi,
    onDragMove: (poi, ziel) => onPointerDragMove?.(poi, ziel),
    onDrop: (poi, ziel) => onPointerDrop?.(poi, ziel),
    onDragEnd: () => onPointerDragEnd?.(),
  });

  return (
    <div className={styles.column}>
      <h2 className={styles.title}>Noch unverplant</h2>
      <ul className={`${styles.list} ${bildlauf.bildlauf}`}>
        {pois.map((poi) => (
          <li
            key={poi.id}
            className={`${styles.card}${draggable ? ` ${styles.draggable}` : ""}${
              gegriffenerPoi?.id === poi.id ? ` ${styles.gegriffen}` : ""
            }`}
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
            {...fingerZug(poi)}
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
            <span className={styles.duration}>{formatPoiDuration(poi)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
