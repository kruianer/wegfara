"use client";

import { useState } from "react";
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
import { PoiLinkImport } from "./poi-link-import";
import styles from "./poi-list.module.css";

export type { PoiTypeFilter };

/** Die Adresse eines Fotos in der Bildablage (siehe req-026). */
function photoUrl(photoId: string): string {
  return `/api/poi-fotos/${photoId}`;
}

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
  hasAiKey = false,
  hasGoogleKey = false,
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
  /** Ob der Account einen Zugangsschluessel fuer die KI-Suche hat (req-028). */
  hasAiKey?: boolean;
  /** Ob der Account einen Zugangsschluessel fuer Google hat (req-028). */
  hasGoogleKey?: boolean;
}) {
  // Welche Zeilen aufgeklappt sind (req-026). Mehrere duerfen es sein --
  // beim Vergleichen zweier Orte will man beide Details nebeneinander.
  const [expanded, setExpanded] = useState<string[]>([]);

  function toggleExpanded(poiId: string) {
    setExpanded((offen) =>
      offen.includes(poiId)
        ? offen.filter((id) => id !== poiId)
        : [...offen, poiId],
    );
  }

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
        hasApiKey={hasAiKey}
      />

      <PoiLinkImport
        tripId={tripId}
        onPoiImported={(poi) => onPoisAdded([poi])}
        hasApiKey={hasGoogleKey}
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
          const photos = poi.photos ?? [];
          const offen = expanded.includes(poi.id);
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
              {/* Das erste Foto ersetzt die farbige Flaeche des Typs
                  (req-026); ohne Fotos bleibt es bei der Flaeche (req-010). */}
              {photos.length > 0 ? (
                // Die Datei liegt im Bildverzeichnis ausserhalb des Repos
                // und geht ueber /api/poi-fotos heraus, nicht ueber den
                // Bild-Optimierer von Next.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className={styles.photo}
                  src={photoUrl(photos[0].id)}
                  alt={`Foto von ${poi.name}`}
                />
              ) : (
                <div
                  className={styles.swatch}
                  data-testid={`poi-swatch-${poi.id}`}
                  style={{ background: POI_TYPE_COLOR[poi.type] }}
                  aria-hidden="true"
                />
              )}
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
                  <button
                    type="button"
                    className={styles.rowName}
                    aria-expanded={offen}
                    onClick={() => toggleExpanded(poi.id)}
                  >
                    {poi.name}
                  </button>
                </div>
                <div className={styles.rowMeta}>
                  {poi.ort} · {POI_TYPE_LABEL[poi.type]}
                </div>
                {offen && (
                  <div
                    className={styles.detail}
                    data-testid={`poi-detail-${poi.id}`}
                  >
                    {poi.address && (
                      <p className={styles.detailLine}>
                        <span className={styles.detailLabel}>Adresse</span>
                        {poi.address}
                      </p>
                    )}
                    {poi.phone && (
                      <p className={styles.detailLine}>
                        <span className={styles.detailLabel}>Telefon</span>
                        {poi.phone}
                      </p>
                    )}
                    {poi.openingHours && poi.openingHours.length > 0 && (
                      <div className={styles.detailLine}>
                        <span className={styles.detailLabel}>
                          Öffnungszeiten
                        </span>
                        <ul className={styles.hours}>
                          {poi.openingHours.map((zeile) => (
                            <li key={zeile}>{zeile}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {photos.length > 0 && (
                      <div className={styles.photoStrip}>
                        {photos.map((photo) => (
                          // eslint-disable-next-line @next/next/no-img-element -- siehe oben
                          <img
                            key={photo.id}
                            className={styles.detailPhoto}
                            src={photoUrl(photo.id)}
                            alt={`Foto von ${poi.name}`}
                          />
                        ))}
                      </div>
                    )}
                    {!poi.address &&
                      !poi.phone &&
                      !poi.openingHours &&
                      photos.length === 0 && (
                        <p className={styles.detailLine}>
                          Zu diesem POI sind keine weiteren Angaben hinterlegt.
                        </p>
                      )}
                  </div>
                )}
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
