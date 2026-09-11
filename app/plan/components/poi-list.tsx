"use client";

import { useCallback, useState } from "react";
import type {
  Poi,
  PoiPosition,
  PoiStatus,
  PoiStatusFilter,
  PoiTypeFilter,
} from "@/lib/pois/types";
import {
  gefiltertePois,
  sortiertePois,
  POI_SORTIERUNGEN,
  POI_SORTIERUNG_LABEL,
  VORGEWAEHLTE_SORTIERUNG,
  type PoiSortierung,
} from "@/lib/pois/listenansicht";
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
import { poiOrtUndTyp } from "@/lib/pois/meta-line";
import { bewertungText } from "@/lib/pois/bewertung";
import { kostenText } from "@/lib/pois/kosten";
import { buchungKennzeichen } from "@/lib/pois/buchung";
import { poiMapsUrl } from "@/lib/pois/maps-link";
import type { Bewertungsrunde, Stimme } from "@/lib/bewertungen/types";
import {
  bewertungsstand,
  laufendeRunde,
  type BewertendePerson,
} from "@/lib/bewertungen/stand";
import {
  beendeBewertungsrunde,
  starteBewertungsrunde,
} from "@/lib/bewertungen/save";
import type { Vorbelegung } from "@/lib/pois/formular-fuellen";
import { TippzielCheckbox } from "@/components/tippziel-checkbox";
import { TrashIcon } from "@/components/icons";
import { PoiAnlegezeile } from "./poi-anlegezeile";
import { PoiForm } from "./poi-form";
import { PoiBewertung } from "./poi-bewertung";
import styles from "./poi-list.module.css";

/** Der Schluessel des Formulars, mit dem ein neuer POI angelegt wird. */
export const NEUER_POI = "neu";

/** Die Adresse eines Fotos in der Bildablage (siehe req-026). */
function photoUrl(photoId: string): string {
  return `/api/poi-fotos/${photoId}`;
}

function links(poi: Poi) {
  // Ohne abgeleiteten Ort sucht der Name allein (req-041).
  const bezeichnung = [poi.name, poi.ort.trim()]
    .filter((teil) => teil.length > 0)
    .join(" ");
  const query = encodeURIComponent(bezeichnung);
  return {
    google: `https://www.google.com/search?q=${query}`,
    website:
      poi.web ??
      `https://www.google.com/search?q=${encodeURIComponent(`${bezeichnung} offizielle website`)}`,
    maps: poiMapsUrl(poi),
  };
}

export function PoiList({
  pois,
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
  onPoisDelete = () => {},
  istReiseleiter = false,
  runden = [],
  stimmen = [],
  personen = [],
  onRundeGestartet = () => {},
  onRundeBeendet = () => {},
}: {
  /** Alle POIs der geoeffneten Reise, ungefiltert (fuer den Gesamtzaehler). */
  pois: Poi[];
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
  /** Oeffnet die Rueckfrage vor dem Entfernen der angekreuzten POIs (req-057). */
  onPoisDelete?: (pois: Poi[]) => void;
  /**
   * Ob die angemeldete Person diese Reise fuehrt (req-054). Nur sie startet
   * und beendet eine Bewertungsrunde -- geprueft wird das serverseitig, hier
   * bleibt der Weg dorthin nur verborgen.
   */
  istReiseleiter?: boolean;
  /** Die Bewertungsrunden der geoeffneten Reise (req-054). */
  runden?: Bewertungsrunde[];
  /** Die abgegebenen Stimmen dieser Runden. */
  stimmen?: Stimme[];
  /** Die Teilnehmer der Reise -- auch wer noch nicht gestimmt hat, wird genannt. */
  personen?: BewertendePerson[];
  /** Eine gestartete Runde -- gespeichert ist sie da bereits. */
  onRundeGestartet?: (runde: Bewertungsrunde) => void;
  /** Eine beendete Runde -- gespeichert ist sie da bereits. */
  onRundeBeendet?: (runde: Bewertungsrunde) => void;
}) {
  // Welche Zeilen als Formular aufgeklappt sind (req-035; loest das
  // Nur-Lesen-Detail aus req-026 ab). Mehrere duerfen es sein -- beim
  // Vergleichen zweier Orte will man beide nebeneinander.
  const [expanded, setExpanded] = useState<string[]>([]);
  // Filter und Sortierung gehoeren seit req-060 der Liste allein: die Karte
  // daneben hat ihre eigene Statusauswahl (req-013), und die KI-Suche in der
  // Anlegezeile darueber nimmt keinen von beiden mit.
  const [typeFilter, setTypeFilter] = useState<PoiTypeFilter>("alle");
  const [statusFilter, setStatusFilter] = useState<PoiStatusFilter>("alle");
  const [sortierung, setSortierung] = useState<PoiSortierung>(
    VORGEWAEHLTE_SORTIERUNG,
  );
  // Ob das Formular zum Anlegen offen steht -- und womit die Anlegezeile es
  // gefuellt hat (req-060). null heisst: es steht keines offen.
  const [creating, setCreating] = useState<{
    vorbelegung: Vorbelegung | null;
  } | null>(null);
  // Welche POIs angekreuzt sind. Die Auswahl traegt zweierlei: das
  // Aussortieren mehrerer POIs auf einmal (req-057) und, beim Reiseleiter,
  // die Vorbereitung einer Bewertungsrunde (req-054) -- angekreuzt wird
  // dafuer dasselbe, nur die Schaltflaeche daneben ist eine andere.
  const [ausgewaehlt, setAusgewaehlt] = useState<string[]>([]);
  const [startet, setStartet] = useState(false);
  // Was beim letzten Speichern mit den Bildern aus Google schiefging
  // (bug-027) -- null heisst: nichts zu melden.
  const [fotoProblem, setFotoProblem] = useState<string | null>(null);

  // Waehrend eine Runde laeuft, wird keine zweite vorbereitet: zu einer Reise
  // laeuft hoechstens eine (req-054, Out of Scope).
  const laufende = laufendeRunde(runden, tripId);

  function toggleAuswahl(poiId: string) {
    setAusgewaehlt((offen) =>
      offen.includes(poiId)
        ? offen.filter((id) => id !== poiId)
        : [...offen, poiId],
    );
  }

  async function starteRunde() {
    const ids = angekreuzte.map((poi) => poi.id);
    if (ids.length === 0 || startet) return;
    setStartet(true);
    const runde = await starteBewertungsrunde(tripId, ids);
    setStartet(false);
    if (!runde) return;
    setAusgewaehlt([]);
    onRundeGestartet(runde);
  }

  async function beendeRunde() {
    if (!laufende || startet) return;
    setStartet(true);
    const runde = await beendeBewertungsrunde(laufende.id);
    setStartet(false);
    if (runde) onRundeBeendet(runde);
  }

  function toggleExpanded(poiId: string) {
    if (!expanded.includes(poiId)) {
      // Ein offenes Formular wartet nicht von sich aus auf den Kartenklick
      // (req-044, loest bug-015 ab): sonst verstellte ein Klick beim
      // Verschieben der Karte versehentlich die Position. Wer sie setzen
      // will, schaltet den Schalter im Formular ein.
      setExpanded((offen) => [...offen, poiId]);
      return;
    }
    setExpanded((offen) => offen.filter((id) => id !== poiId));
    // Mit dem Formular endet auch sein Warten auf die Karte.
    if (picking === poiId) onPickingChange(null);
  }

  function openCreate() {
    setCreating({ vorbelegung: null });
  }

  /** Der in der Anlegezeile gefundene Ort oeffnet das Formular (req-060). */
  const openCreateMitOrt = useCallback((vorbelegung: Vorbelegung) => {
    setCreating({ vorbelegung });
  }, []);

  function closeCreate() {
    setCreating(null);
    if (picking === NEUER_POI) onPickingChange(null);
  }

  function togglePicking(key: string) {
    onPickingChange(picking === key ? null : key);
  }

  /** Die zuletzt gesetzte Position, aber nur fuer das Formular, das sie angefordert hat. */
  function positionFor(key: string): PoiPosition | null {
    return picked && picked.key === key ? picked.position : null;
  }

  // Die Nummer bleibt dabei jedem POI erhalten (req-013): sortiert wird die
  // Anzeige, nicht die Vergabe.
  const visible = sortiertePois(
    gefiltertePois(pois, { typeFilter, statusFilter }),
    sortierung,
  );

  /** Die angekreuzten POIs — nur die, die es noch gibt und die man sieht. */
  const angekreuzte = visible.filter((poi) => ausgewaehlt.includes(poi.id));

  function loescheAusgewaehlte() {
    if (angekreuzte.length === 0) return;
    onPoisDelete(angekreuzte);
    setAusgewaehlt([]);
  }

  return (
    <div className={styles.list}>
      {/* Über der Liste steht keine Überschrift mehr (req-060): der Bereich
          trägt seinen Namen schon in der Navigation, und der Platz gehört
          der Liste. Von oben nach unten kommt zuerst das Anlegen, dann der
          Filter, dann die Liste -- das Anlegen gehört nicht in sie hinein. */}
      <PoiAnlegezeile
        tripId={tripId}
        hasSearchArea={hasSearchArea}
        hasAiKey={hasAiKey}
        hasGoogleKey={hasGoogleKey}
        anlegenOffen={creating !== null}
        onOrtGefunden={openCreateMitOrt}
        onLeeresFormular={openCreate}
        onPoisAdded={onPoisAdded}
      />

      {/* Gefiltert wird über Auswahllisten statt über eine Leiste aus Chips
          (req-060): bei sieben Typen und fünf Status nimmt eine Leiste zu
          viel Platz, und mehr als einen Wert gleichzeitig gibt es nicht. */}
      <div className={styles.filterRow} data-testid="poi-filterzeile">
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>Typ</span>
          <select
            className={styles.filterSelect}
            aria-label="Nach Typ filtern"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PoiTypeFilter)}
          >
            <option value="alle">Alle</option>
            {POI_TYPES.map((type) => (
              <option key={type} value={type}>
                {POI_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>Status</span>
          <select
            className={styles.filterSelect}
            aria-label="Nach Status filtern"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PoiStatusFilter)}
          >
            <option value="alle">Alle</option>
            {POI_STATUSES.map((status) => (
              <option key={status} value={status}>
                {POI_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterField}>
          <span className={styles.filterLabel}>Sortieren</span>
          <select
            className={styles.filterSelect}
            aria-label="Sortieren nach"
            value={sortierung}
            onChange={(e) => setSortierung(e.target.value as PoiSortierung)}
          >
            {POI_SORTIERUNGEN.map((art) => (
              <option key={art} value={art}>
                {POI_SORTIERUNG_LABEL[art]}
              </option>
            ))}
          </select>
        </div>
        <span className={styles.count}>
          {visible.length} von {pois.length}
        </span>
      </div>

      {/* Der POI ist gespeichert, seine Bilder aus Google nicht (bug-027).
          Die Meldung steht hier und nicht im Formular: beim Anlegen
          schließt sich das Formular mit dem Speichern. */}
      {fotoProblem && (
        <p
          className={styles.fotoProblem}
          role="alert"
          data-testid="poi-foto-problem"
        >
          {fotoProblem}
        </p>
      )}

      {/* Alles unterhalb der Leisten liegt in einem gemeinsamen
          Bildlaufbereich -- so ist jedes aufgeklappte Formular vollständig
          erreichbar, auch wenn es höher ist als die Spalte (bug-016). */}
      <div className={styles.scroll} data-testid="poi-scrollbereich">
        {creating && (
          <PoiForm
            poi={null}
            tripId={tripId}
            vorbelegung={creating.vorbelegung}
            hasGoogleKey={hasGoogleKey}
            hasAiKey={hasAiKey}
            picking={picking === NEUER_POI}
            pickedPosition={positionFor(NEUER_POI)}
            onTogglePicking={() => togglePicking(NEUER_POI)}
            onSaved={(poi) => {
              onPoiSaved(poi);
              closeCreate();
            }}
            onFotoProblem={setFotoProblem}
            onCancel={closeCreate}
            onDelete={() => {}}
          />
        )}

        {/* Die Auswahlleiste. Angekreuzt wird für zweierlei: das
            Aussortieren mehrerer POIs auf einmal (req-057) -- das darf
            jeder, der auch einzeln löschen darf -- und, beim Reiseleiter,
            das Vorbereiten einer Bewertungsrunde (req-054). Läuft eine
            Runde, tritt an ihre Stelle der Hinweis darauf. */}
        <div className={styles.banner}>
          <label className={styles.bannerLabel}>
            <TippzielCheckbox
              aria-label="Alle POIs auswählen"
              checked={
                visible.length > 0 && angekreuzte.length === visible.length
              }
              onChange={(e) =>
                setAusgewaehlt(
                  e.target.checked ? visible.map((poi) => poi.id) : [],
                )
              }
            />
            {angekreuzte.length === 0
              ? "POIs auswählen"
              : `${angekreuzte.length} ausgewählt`}
          </label>
          <div className={styles.bannerActions}>
            <button
              type="button"
              className={styles.bannerDangerButton}
              onClick={loescheAusgewaehlte}
              disabled={angekreuzte.length === 0}
            >
              Ausgewählte löschen
            </button>
            {istReiseleiter &&
              (laufende ? (
                <>
                  <span className={styles.bannerNote}>
                    Bewertungsrunde läuft — {laufende.poiIds.length}{" "}
                    {laufende.poiIds.length === 1 ? "POI" : "POIs"}
                  </span>
                  <button
                    type="button"
                    className={styles.bannerButton}
                    onClick={beendeRunde}
                    disabled={startet}
                  >
                    Bewertungsrunde beenden
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.bannerButton}
                  onClick={starteRunde}
                  disabled={angekreuzte.length === 0 || startet}
                >
                  Bewertungsrunde starten
                </button>
              ))}
          </div>
        </div>

        <ul className={styles.rows}>
          {visible.map((poi) => {
            const { google, website, maps } = links(poi);
            const photos = poi.photos ?? [];
            const bewertung = bewertungText(poi);
            const kosten = kostenText(poi);
            const buchung = buchungKennzeichen(poi);
            const offen = expanded.includes(poi.id);
            const stand = bewertungsstand(poi.id, runden, stimmen, personen);
            return (
              <li
                key={poi.id}
                data-testid={`poi-row-${poi.id}`}
                className={`${styles.row} ${
                  poi.id === highlightedPoiId ? styles.rowHighlighted : ""
                }`}
              >
                {/* Die Angaben der Zeile stehen nebeneinander; das Formular
                  darunter gehoert der Zeile selbst und nutzt darum ihre
                  ganze Breite (bug-014). */}
                <div className={styles.rowTop}>
                  {/* Angehakt wird zum Aussortieren (req-057) und, beim
                      Reiseleiter, zum Vorbereiten einer Bewertungsrunde
                      (req-054). */}
                  <TippzielCheckbox
                    aria-label={`${poi.name} auswählen`}
                    checked={ausgewaehlt.includes(poi.id)}
                    onChange={() => toggleAuswahl(poi.id)}
                  />
                  {/* Ob eine Runde vorbereitet werden kann, entscheidet
                      allein die Leiste oben -- die Zeile bleibt dieselbe. */}
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
                        data-testid={`poi-name-${poi.id}`}
                        aria-expanded={offen}
                        onClick={() => toggleExpanded(poi.id)}
                      >
                        {poi.name}
                      </button>
                      {/* Das Kennzeichen der Buchung (req-061). „Nicht
                          nötig" trägt keines: sonst trüge jeder Strand
                          eines, und es sagte nichts mehr. */}
                      {buchung && (
                        <span
                          className={styles.buchungPill}
                          data-testid={`poi-buchung-${poi.id}`}
                        >
                          Buchung: {buchung}
                        </span>
                      )}
                    </div>
                    <div className={styles.rowMeta}>{poiOrtUndTyp(poi)}</div>
                    {/* Die Bewertung bei Google mit der Anzahl dahinter
                        (req-057) -- an einem Namen allein sieht man nicht,
                        ob ein Ort etwas taugt. */}
                    {bewertung && (
                      <div
                        className={styles.rowBewertung}
                        data-testid={`poi-google-bewertung-${poi.id}`}
                      >
                        <span aria-hidden="true">★</span> {bewertung}
                      </div>
                    )}
                    {/* Was der Ort je Person kostet (req-061) -- es
                        entscheidet mit, ob er in den Plan kommt. Ohne
                        eingetragenen Betrag steht hier nichts. */}
                    {kosten && (
                      <div
                        className={styles.rowKosten}
                        data-testid={`poi-kosten-${poi.id}`}
                      >
                        {kosten}
                      </div>
                    )}
                    {/* Der Kurztext steht in der Zeile (req-044); seine
                        Grenze von 200 Zeichen haelt sie zusammen. */}
                    {poi.shortText && (
                      <div
                        className={styles.rowShortText}
                        data-testid={`poi-kurztext-${poi.id}`}
                      >
                        {poi.shortText}
                      </div>
                    )}
                    {/* Warum die KI diesen Ort vorschlaegt (req-057), mit
                        Bezug auf die Praeferenzen der Reise. Nur POIs aus
                        der Suche tragen ihn. */}
                    {poi.kiBegruendung && (
                      <div
                        className={styles.rowBegruendung}
                        data-testid={`poi-begruendung-${poi.id}`}
                      >
                        {poi.kiBegruendung}
                      </div>
                    )}
                    {/* Der Stand der Bewertung (req-054) -- auch der einer
                        beendeten Runde: ihre Stimmen bleiben sichtbar. */}
                    {stand && <PoiBewertung poiId={poi.id} stand={stand} />}
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
                  {/* Rechts in der Box das Löschen-Symbol (req-060): zum
                      Aussortieren eines einzelnen POI musste man bis dahin
                      erst sein Formular aufklappen. Es entfernt nicht
                      selbst, sondern öffnet die Rückfrage aus req-035 --
                      die auch warnt, wenn der POI bereits verplant ist. */}
                  <button
                    type="button"
                    className={styles.rowDelete}
                    aria-label={`${poi.name} entfernen`}
                    onClick={() => onPoiDelete(poi)}
                  >
                    <TrashIcon />
                  </button>
                </div>
                {/* Ein Klick auf den Namen klappt die Zeile zu einem Formular
                  auf (req-035). Bis req-026 stand hier ein Detail zum Lesen
                  -- dieselben Angaben stehen jetzt änderbar im Formular.
                  Es steht unter der Zeile statt in ihrer mittleren Spalte,
                  damit es dieselbe Breite hat wie beim Anlegen (bug-014). */}
                {offen && (
                  <PoiForm
                    poi={poi}
                    tripId={tripId}
                    hasGoogleKey={hasGoogleKey}
                    hasAiKey={hasAiKey}
                    picking={picking === poi.id}
                    pickedPosition={positionFor(poi.id)}
                    onTogglePicking={() => togglePicking(poi.id)}
                    onSaved={onPoiSaved}
                    onFotoProblem={setFotoProblem}
                    onCancel={() => toggleExpanded(poi.id)}
                    onDelete={onPoiDelete}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
