"use client";

import { useState } from "react";
import type {
  Poi,
  PoiPosition,
  PoiStatus,
  PoiTypeFilter,
} from "@/lib/pois/types";
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
import { PoiForm } from "./poi-form";
import styles from "./poi-list.module.css";

/** Der Schluessel des Formulars, mit dem ein neuer POI angelegt wird. */
const NEUER_POI = "neu";

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
  picking = null,
  picked = null,
  onPickingChange = () => {},
  onPoiSaved = () => {},
  onPoiDelete = () => {},
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
  /**
   * Welches Formular gerade auf einen Klick in die Karte wartet (req-035):
   * die Kennung des POI oder "neu". Der Zustand liegt in PoisView, weil ihn
   * die Karte daneben braucht.
   */
  picking?: string | null;
  /** Die zuletzt auf der Karte gesetzte Position samt Formular dazu. */
  picked?: { key: string; position: PoiPosition } | null;
  onPickingChange?: (key: string | null) => void;
  /** Ein angelegter oder geaenderter POI (req-035). */
  onPoiSaved?: (poi: Poi) => void;
  /** Oeffnet die Rueckfrage vor dem Entfernen (req-035). */
  onPoiDelete?: (poi: Poi) => void;
}) {
  // Welche Zeilen als Formular aufgeklappt sind (req-035; loest das
  // Nur-Lesen-Detail aus req-026 ab). Mehrere duerfen es sein -- beim
  // Vergleichen zweier Orte will man beide nebeneinander.
  const [expanded, setExpanded] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  function toggleExpanded(poiId: string) {
    setExpanded((offen) => {
      if (!offen.includes(poiId)) return [...offen, poiId];
      // Mit dem Formular endet auch sein Warten auf die Karte.
      if (picking === poiId) onPickingChange(null);
      return offen.filter((id) => id !== poiId);
    });
  }

  function closeCreate() {
    setCreating(false);
    if (picking === NEUER_POI) onPickingChange(null);
  }

  function togglePicking(key: string) {
    onPickingChange(picking === key ? null : key);
  }

  /** Die zuletzt gesetzte Position, aber nur fuer das Formular, das sie angefordert hat. */
  function positionFor(key: string): PoiPosition | null {
    return picked && picked.key === key ? picked.position : null;
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

      {/* Neben der KI-Suche und dem Feld für den Google-Link: der Weg für
          einen Ort, den mir jemand mündlich empfohlen hat (req-035). */}
      <div className={styles.createBar}>
        <button
          type="button"
          className={styles.createButton}
          onClick={() => setCreating(true)}
          disabled={creating}
        >
          POI anlegen
        </button>
      </div>

      {creating && (
        <PoiForm
          poi={null}
          tripId={tripId}
          picking={picking === NEUER_POI}
          pickedPosition={positionFor(NEUER_POI)}
          onTogglePicking={() => togglePicking(NEUER_POI)}
          onSaved={(poi) => {
            onPoiSaved(poi);
            closeCreate();
          }}
          onCancel={closeCreate}
          onDelete={() => {}}
        />
      )}

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
                {/* Ein Klick auf die Zeile klappt sie zu einem Formular auf
                    (req-035). Bis req-026 stand hier ein Detail zum Lesen --
                    dieselben Angaben stehen jetzt änderbar im Formular. */}
                {offen && (
                  <PoiForm
                    poi={poi}
                    tripId={tripId}
                    picking={picking === poi.id}
                    pickedPosition={positionFor(poi.id)}
                    onTogglePicking={() => togglePicking(poi.id)}
                    onSaved={onPoiSaved}
                    onCancel={() => toggleExpanded(poi.id)}
                    onDelete={onPoiDelete}
                  />
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
