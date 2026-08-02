"use client";

import type { Poi, PoiStatus, PoiTypeFilter } from "@/lib/pois/types";
import {
  POI_STATUSES,
  POI_STATUS_COLOR,
  POI_STATUS_LABEL,
} from "@/lib/pois/status-meta";
import {
  POI_TYPES,
  POI_TYPE_LABEL,
  POI_TYPE_COLOR,
} from "@/lib/pois/type-meta";
import { AiPoiSearch } from "./ai-poi-search";
import styles from "./poi-list.module.css";

export type { PoiTypeFilter };

function links(poi: Poi) {
  const query = encodeURIComponent(`${poi.name} ${poi.ort}`);
  return {
    google: `https://www.google.com/search?q=${query}`,
    website:
      poi.web ??
      `https://www.google.com/search?q=${encodeURIComponent(`${poi.name} ${poi.ort} offizielle website`)}`,
    maps: `https://www.google.com/maps/search/?api=1&query=${poi.position.lat},${poi.position.lng}`,
  };
}

export function PoiList({
  pois,
  typeFilter,
  onTypeFilterChange,
  highlightedPoiId,
  onStatusChange,
  tripId,
  hasSearchArea,
  onPoisAdded,
}: {
  /** Alle POIs der geoeffneten Reise, ungefiltert (fuer den Gesamtzaehler). */
  pois: Poi[];
  typeFilter: PoiTypeFilter;
  onTypeFilterChange: (filter: PoiTypeFilter) => void;
  highlightedPoiId: string | null;
  onStatusChange: (poiId: string, status: PoiStatus) => void;
  tripId: string;
  hasSearchArea: boolean;
  onPoisAdded: (pois: Poi[]) => void;
}) {
  const visible =
    typeFilter === "alle" ? pois : pois.filter((p) => p.type === typeFilter);

  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          Points of <span className={styles.titleAccent}>Interest</span>
        </h2>
        <span className={styles.count}>
          {visible.length} von {pois.length}
        </span>
      </div>

      <div
        className={styles.filterBar}
        role="group"
        aria-label="Nach Typ filtern"
      >
        <button
          type="button"
          className={`${styles.chip} ${typeFilter === "alle" ? styles.chipActive : ""}`}
          aria-pressed={typeFilter === "alle"}
          onClick={() => onTypeFilterChange("alle")}
        >
          Alle
        </button>
        {POI_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`${styles.chip} ${typeFilter === type ? styles.chipActive : ""}`}
            aria-pressed={typeFilter === type}
            onClick={() => onTypeFilterChange(type)}
          >
            {POI_TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      <AiPoiSearch
        tripId={tripId}
        typeFilter={typeFilter}
        hasSearchArea={hasSearchArea}
        onPoisAdded={onPoisAdded}
      />

      <div className={styles.banner}>
        <label className={styles.bannerLabel}>
          <input type="checkbox" />
          POIs für eine Bewertungsrunde auswählen
        </label>
        <button type="button" className={styles.bannerButton}>
          Bewertungsrunde starten
        </button>
      </div>

      <ul className={styles.rows}>
        {visible.map((poi) => {
          const { google, website, maps } = links(poi);
          return (
            <li
              key={poi.id}
              data-testid={`poi-row-${poi.id}`}
              className={`${styles.row} ${
                poi.id === highlightedPoiId ? styles.rowHighlighted : ""
              }`}
            >
              <input
                type="checkbox"
                className={styles.rowCheckbox}
                aria-label={`${poi.name} auswählen`}
              />
              <div
                className={styles.swatch}
                style={{ background: POI_TYPE_COLOR[poi.type] }}
                aria-hidden="true"
              />
              <div className={styles.rowMain}>
                <div className={styles.rowNameLine}>
                  <span
                    className={styles.statusDot}
                    data-testid={`poi-status-dot-${poi.id}`}
                    style={{ background: POI_STATUS_COLOR[poi.status] }}
                    aria-hidden="true"
                  />
                  <span
                    className={styles.rowNumber}
                    data-testid={`poi-number-${poi.id}`}
                  >
                    #{poi.number}
                  </span>
                  <span className={styles.rowName}>{poi.name}</span>
                </div>
                <div className={styles.rowMeta}>
                  {poi.ort} · {POI_TYPE_LABEL[poi.type]}
                </div>
                <div className={styles.rowLinks}>
                  <a
                    className={styles.linkPill}
                    href={google}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google
                  </a>
                  <a
                    className={styles.linkPill}
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Website
                  </a>
                  <a
                    className={styles.linkPill}
                    href={maps}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Maps
                  </a>
                </div>
              </div>
              <select
                className={styles.statusSelect}
                aria-label={`Status von ${poi.name}`}
                value={poi.status}
                onChange={(e) =>
                  onStatusChange(poi.id, e.target.value as PoiStatus)
                }
              >
                {POI_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {POI_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
