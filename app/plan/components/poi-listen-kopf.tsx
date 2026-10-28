"use client";

import { useState } from "react";
import type { Poi, PoiStatus } from "@/lib/pois/types";
import { GEGEND_FILTER_OHNE } from "@/lib/pois/types";
import {
  anzahlGesetzterFilter,
  filterChips,
  filterUmschalten,
  gegendFilterLabel,
  LEERER_POI_FILTER,
  ohneFilterwert,
  POI_SORTIERUNGEN,
  POI_SORTIERUNG_LABEL,
  sortierRichtung,
  type PoiFilter,
  type PoiFilterChip,
  type PoiFilterFeld,
  type PoiSortierung,
} from "@/lib/pois/listenansicht";
import type { PoiListenEinstellungen } from "@/lib/pois/ansicht-einstellungen";
import {
  POI_STATUSES,
  POI_STATUS_COLOR,
  POI_STATUS_KURZ,
} from "@/lib/pois/status-meta";
import {
  POI_TYPES,
  POI_TYPE_COLOR,
  POI_TYPE_LABEL,
} from "@/lib/pois/type-meta";
import { TippzielCheckbox } from "@/components/tippziel-checkbox";
import {
  AuswaehlenIcon,
  FilterIcon,
  KreuzIcon,
  SortierenIcon,
  StarIcon,
  StatusIcon,
  SucheIcon,
  TrashIcon,
} from "@/components/icons";
import styles from "./poi-listen-kopf.module.css";

/** Welches Blatt unter dem Kopf offen steht -- immer höchstens eines. */
type Blatt = "filter" | "sortieren" | null;

/**
 * Eine Pille im Filterblatt (req-098): ein Wert eines Feldes, an- und
 * abwählbar. Status und Typ tragen ihren Farbpunkt immer, nicht nur im
 * gewählten Zustand -- sieben Typen mit Punkt überfliegt man, sieben graue
 * Wörter muss man lesen.
 *
 * Die Schaltfläche ist 44 px hoch (stack.md, Regel 4), gezeichnet wird darin
 * nur die 26 px hohe Pille: so ist eine Reihe mit dem Abstand dazwischen
 * genau ein Tippziel hoch.
 */
function Pille({
  label,
  farbe,
  art,
  an,
  onClick,
}: {
  label: string;
  /** Die Farbe aus POI_STATUS_COLOR oder POI_TYPE_COLOR -- die Gegend hat keine. */
  farbe?: string;
  /** Wie die Schrift im gewählten Zustand gefärbt wird (siehe CSS). */
  art: "status" | "typ" | "neutral";
  an: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.pille}
      aria-pressed={an}
      onClick={onClick}
      style={farbe ? ({ "--c": farbe } as React.CSSProperties) : undefined}
    >
      <span
        className={`${styles.pillenFlaeche} ${an ? styles.an : ""} ${
          art === "typ" ? styles.pilleTyp : ""
        } ${art === "neutral" ? styles.pilleNeutral : ""}`}
      >
        {farbe && (
          <span
            className={styles.punkt}
            data-testid="pillen-punkt"
            aria-hidden="true"
          />
        )}
        {label}
      </span>
    </button>
  );
}

/** Ein Feld des Filterblatts: Überschrift und die Pillen darunter. */
function Feld({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className={styles.feld} role="group" aria-label={name}>
      <span className={styles.feldName} aria-hidden="true">
        {name}
      </span>
      <div className={styles.wahl}>{children}</div>
    </div>
  );
}

/**
 * Der Kopf der POI-Liste (req-098). Er hat drei Zustände, von denen immer
 * nur einer sichtbar ist:
 *
 * - **Ruhe** -- eine Zeile mit vier Griffen: Suchfeld, Filter, Sortieren,
 *   Auswählen. Gesetzte Filter stehen als Chips unter dem Titel.
 * - **Filter offen** -- dasselbe, darunter ein Blatt mit allen Filtern.
 * - **Auswahl** -- die Massenaktionen an der Stelle der Filter.
 *
 * Bis req-098 trug derselbe Kopf neun Bedienelemente gleichzeitig; in die
 * 324 px schmale Spalte aus req-097 passten sie nicht.
 */
export function PoiListenKopf({
  pois,
  sichtbar,
  gegenden,
  einstellungen,
  onEinstellungenChange,
  suche,
  onSucheChange,
  auswahlModus,
  onAuswahlStarten,
  onAuswahlBeenden,
  angekreuzt,
  alleAngekreuzt,
  onAlleAnkreuzen,
  onStatusFuerAusgewaehlte,
  onEntfernen,
  rundeStartbar,
  rundeStartet,
  onRundeStarten,
}: {
  /** Alle POIs der Reise -- für „7 von 32" und die Richtung der Nummer. */
  pois: Poi[];
  /** Wie viele davon Filter und Suche gerade durchlassen. */
  sichtbar: number;
  /** Die Gegenden der Reise (req-095); ohne sie fehlt das Feld. */
  gegenden: string[];
  /** Filter und Sortierung, gemerkt je Reise (bug-052). */
  einstellungen: PoiListenEinstellungen;
  onEinstellungenChange: (einstellungen: PoiListenEinstellungen) => void;
  /** Der Suchbegriff -- er wird bewusst nicht gemerkt (req-098). */
  suche: string;
  onSucheChange: (suche: string) => void;
  auswahlModus: boolean;
  onAuswahlStarten: () => void;
  /** „Fertig": der Modus endet, und mit ihm die Auswahl (req-097). */
  onAuswahlBeenden: () => void;
  /** Wie viele POIs angekreuzt sind. */
  angekreuzt: number;
  alleAngekreuzt: boolean;
  onAlleAnkreuzen: (alle: boolean) => void;
  /** Derselbe Status für alle angekreuzten POIs (req-069). */
  onStatusFuerAusgewaehlte: (status: PoiStatus) => void;
  /** Öffnet die Rückfrage vor dem Entfernen der angekreuzten (req-057). */
  onEntfernen: () => void;
  /** Ob aus der Auswahl eine Bewertungsrunde werden kann (req-054). */
  rundeStartbar: boolean;
  rundeStartet: boolean;
  onRundeStarten: () => void;
}) {
  const [blatt, setBlatt] = useState<Blatt>(null);
  const { sortierung } = einstellungen;
  const filter: PoiFilter = {
    typeFilter: einstellungen.typeFilter,
    statusFilter: einstellungen.statusFilter,
    gegendFilter: einstellungen.gegendFilter,
  };
  const gesetzt = anzahlGesetzterFilter(filter);
  const chips = filterChips(filter);
  // „7 von 32" steht, sobald etwas eingrenzt (req-098): die Karte daneben
  // hat ihre eigene Statusauswahl (req-013) und zeigt sonst unerklärt mehr
  // Nadeln als die Liste Zeilen.
  const eingegrenzt = gesetzt > 0 || suche.trim().length > 0;

  function setzeFilter(neu: PoiFilter) {
    onEinstellungenChange({ ...einstellungen, ...neu });
  }

  function umschalten(feld: PoiFilterFeld, wert: string) {
    setzeFilter(filterUmschalten(filter, feld, wert));
  }

  function chipWeg(chip: PoiFilterChip) {
    setzeFilter(ohneFilterwert(filter, chip));
  }

  function zuruecksetzen() {
    setzeFilter(LEERER_POI_FILTER);
  }

  function setzeSortierung(neu: PoiSortierung) {
    onEinstellungenChange({ ...einstellungen, sortierung: neu });
    // Gewählt ist gewählt -- das Blatt hat seine Aufgabe erfüllt.
    setBlatt(null);
  }

  function blattUmschalten(welches: Exclude<Blatt, null>) {
    setBlatt((offen) => (offen === welches ? null : welches));
  }

  if (auswahlModus) {
    return (
      <div className={styles.kopf} data-testid="poi-filterzeile">
        <div className={styles.titelzeile}>
          {/* Angekreuzt wird für zweierlei: das Aussortieren mehrerer POIs
              auf einmal (req-057) und, beim Reiseleiter, das Vorbereiten
              einer Bewertungsrunde (req-054). */}
          <span className={styles.alle}>
            <TippzielCheckbox
              aria-label="Alle POIs auswählen"
              title="Alle POIs auswählen"
              checked={alleAngekreuzt}
              onChange={(e) => onAlleAnkreuzen(e.target.checked)}
            />
          </span>
          <span className={styles.von} data-testid="poi-auswahl-zahl">
            {angekreuzt} gewählt
          </span>
          {/* „Fertig" verlässt einen Zustand, statt einen zu öffnen -- es
              trägt deshalb keinen Rahmen (req-098). */}
          <button
            type="button"
            className={`${styles.knopf} ${styles.leise} ${styles.rechts}`}
            onClick={onAuswahlBeenden}
          >
            <span className={styles.knopfFlaeche}>Fertig</span>
          </button>
        </div>
        {/* Die Massenaktionen stehen an der Stelle der Filter (req-098) --
            beides wird nie gleichzeitig gebraucht. */}
        <div className={styles.kopfzeile}>
          {/* Der Status für alle angekreuzten POIs auf einmal (req-069). Die
              Auswahlliste fällt nach jedem Setzen auf ihre Beschriftung
              zurück: sie zeigt keinen Zustand an, sondern löst eine Aktion
              aus -- die angekreuzten POIs können ja verschiedene Status
              tragen. */}
          <label className={`${styles.knopf} ${styles.breit}`}>
            <span className={styles.knopfFlaeche}>
              <StatusIcon />
              Status…
            </span>
            <select
              className={styles.aktionsliste}
              aria-label="Status für Ausgewählte setzen"
              title="Status für Ausgewählte setzen"
              value=""
              disabled={angekreuzt === 0}
              onChange={(e) =>
                onStatusFuerAusgewaehlte(e.target.value as PoiStatus)
              }
            >
              <option value="">Status…</option>
              {/* Dieselben kurzen Namen wie in den Zeilen (req-097). */}
              {POI_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {POI_STATUS_KURZ[status]}
                </option>
              ))}
            </select>
          </label>
          {rundeStartbar && (
            <button
              type="button"
              className={styles.knopf}
              title="Bewertungsrunde starten"
              aria-label="Bewertungsrunde starten"
              onClick={onRundeStarten}
              disabled={angekreuzt === 0 || rundeStartet}
            >
              <span className={styles.knopfFlaeche}>
                <StarIcon />
              </span>
            </button>
          )}
          {/* Bei einer endgültigen Handlung steht da, wie viele es trifft
              (req-098); die Rückfrage danach bleibt (req-057). */}
          <button
            type="button"
            className={`${styles.knopf} ${styles.gefahr}`}
            title="Ausgewählte entfernen"
            aria-label={`Entfernen (${angekreuzt})`}
            onClick={onEntfernen}
            disabled={angekreuzt === 0}
          >
            <span className={styles.knopfFlaeche}>
              <TrashIcon />
              <span data-testid="poi-entfernen-zahl">{angekreuzt}</span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.kopf} data-testid="poi-filterzeile">
      <div className={styles.titelzeile}>
        <h2 className={styles.titel}>POIs</h2>
        <span
          className={eingegrenzt ? styles.von : styles.zahl}
          data-testid="poi-zaehler"
        >
          {eingegrenzt ? `${sichtbar} von ${pois.length}` : pois.length}
        </span>
      </div>

      {/* Zugeklappt stehen die gesetzten Filter als Chips unter dem Titel,
          jeder einzeln wegzunehmen (req-098). */}
      {blatt !== "filter" && chips.length > 0 && (
        <div className={styles.chips} data-testid="poi-filter-chips">
          {chips.map((chip) => (
            <button
              key={`${chip.feld}-${chip.wert}`}
              type="button"
              className={styles.chip}
              aria-label={`Filter „${chip.label}“ entfernen`}
              title={`Filter „${chip.label}“ entfernen`}
              onClick={() => chipWeg(chip)}
              style={
                chip.feld === "status"
                  ? ({
                      "--c": POI_STATUS_COLOR[chip.wert as PoiStatus],
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <span
                className={`${styles.chipFlaeche} ${
                  chip.feld === "status" ? "" : styles.chipNeutral
                }`}
              >
                {chip.label}
                <KreuzIcon />
              </span>
            </button>
          ))}
          <button
            type="button"
            className={`${styles.chip} ${styles.leise}`}
            onClick={zuruecksetzen}
          >
            <span className={styles.chipFlaeche}>zurücksetzen</span>
          </button>
        </div>
      )}

      {/* Die vier Griffe (req-098). Filter und Sortieren sind Symbolknöpfe:
          die Beschriftungen „Typ", „Status", „Sortieren" entfallen. */}
      <div className={styles.kopfzeile}>
        <label className={styles.suche}>
          <span className={styles.suchSymbol} aria-hidden="true">
            <SucheIcon size={13} />
          </span>
          <input
            type="search"
            className={styles.suchfeld}
            aria-label="POIs durchsuchen"
            placeholder="Suchen…"
            value={suche}
            onChange={(e) => onSucheChange(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={`${styles.knopf} ${blatt === "filter" ? styles.offen : ""}`}
          aria-label="Filter"
          title={gesetzt > 0 ? `Filter (${gesetzt} gesetzt)` : "Filter"}
          aria-expanded={blatt === "filter"}
          onClick={() => blattUmschalten("filter")}
        >
          <span className={styles.knopfFlaeche}>
            <FilterIcon />
            {/* Die Zahl der gesetzten Filter (req-098) -- warum die Liste
                kurz ist, sieht man so ohne Aufklappen. */}
            {gesetzt > 0 && (
              <span className={styles.zaehler} data-testid="poi-filter-zahl">
                {gesetzt}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          className={`${styles.knopf} ${
            blatt === "sortieren" ? styles.offen : ""
          }`}
          aria-label="Sortieren"
          title={`Sortieren: ${POI_SORTIERUNG_LABEL[sortierung]}`}
          aria-expanded={blatt === "sortieren"}
          onClick={() => blattUmschalten("sortieren")}
        >
          <span className={styles.knopfFlaeche}>
            <SortierenIcon />
          </span>
        </button>
        {/* Alle vier Griffe sehen gleich aus -- sie sind Werkzeuge der
            Liste (req-098). */}
        <button
          type="button"
          className={styles.knopf}
          aria-label="Auswählen"
          title="Auswählen"
          onClick={() => {
            setBlatt(null);
            onAuswahlStarten();
          }}
        >
          <span className={styles.knopfFlaeche}>
            <AuswaehlenIcon />
          </span>
        </button>
      </div>

      {blatt === "filter" && (
        <div className={styles.blatt} data-testid="poi-filterblatt">
          {/* Innerhalb eines Feldes gilt „oder", zwischen den Feldern
              „und" (req-098). Ein Feld ohne Wahl filtert nicht. */}
          <Feld name="Status">
            {POI_STATUSES.map((status) => (
              <Pille
                key={status}
                label={POI_STATUS_KURZ[status]}
                farbe={POI_STATUS_COLOR[status]}
                art="status"
                an={filter.statusFilter.includes(status)}
                onClick={() => umschalten("status", status)}
              />
            ))}
          </Feld>
          {/* Die Gegend fehlt, solange kein POI eine trägt (req-095) -- ein
              Filter ohne Inhalt ist nur ein leeres Feld. */}
          {gegenden.length > 0 && (
            <Feld name="Gegend">
              {[...gegenden, GEGEND_FILTER_OHNE].map((gegend) => (
                <Pille
                  key={gegend}
                  label={gegendFilterLabel(gegend)}
                  art="neutral"
                  an={filter.gegendFilter.includes(gegend)}
                  onClick={() => umschalten("gegend", gegend)}
                />
              ))}
            </Feld>
          )}
          <Feld name="Typ">
            {POI_TYPES.map((typ) => (
              <Pille
                key={typ}
                label={POI_TYPE_LABEL[typ]}
                farbe={POI_TYPE_COLOR[typ]}
                art="typ"
                an={filter.typeFilter.includes(typ)}
                onClick={() => umschalten("typ", typ)}
              />
            ))}
          </Feld>
          {/* Ohne Rahmen: beide verlassen einen Zustand (req-098). */}
          <div className={styles.blattfuss}>
            <button
              type="button"
              className={`${styles.knopf} ${styles.leise}`}
              onClick={zuruecksetzen}
              disabled={gesetzt === 0}
            >
              <span className={styles.knopfFlaeche}>Alle zurücksetzen</span>
            </button>
            <button
              type="button"
              className={`${styles.knopf} ${styles.leise} ${styles.rechts}`}
              onClick={() => setBlatt(null)}
            >
              <span className={styles.knopfFlaeche}>Fertig</span>
            </button>
          </div>
        </div>
      )}

      {blatt === "sortieren" && (
        <div className={styles.blatt} data-testid="poi-sortierblatt">
          {/* Dieselben vier Ordnungen wie bisher; neu ist nur, dass jede
              ihre Richtung nennt (req-098). Umschalten lässt sie sich
              nicht. */}
          <Feld name="Sortieren nach">
            {POI_SORTIERUNGEN.map((art) => (
              <button
                key={art}
                type="button"
                className={`${styles.pille} ${styles.pilleZeile}`}
                aria-pressed={sortierung === art}
                onClick={() => setzeSortierung(art)}
              >
                <span
                  className={`${styles.pillenFlaeche} ${styles.pilleNeutral} ${
                    sortierung === art ? styles.an : ""
                  }`}
                >
                  {POI_SORTIERUNG_LABEL[art]}{" "}
                  <span
                    className={styles.richtung}
                    data-testid={`poi-sortier-richtung-${art}`}
                  >
                    {sortierRichtung(art, pois)}
                  </span>
                </span>
              </button>
            ))}
          </Feld>
        </div>
      )}
    </div>
  );
}
