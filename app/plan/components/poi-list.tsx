"use client";

import { useCallback, useState } from "react";
import type {
  Poi,
  PoiGegendFilter,
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
  type PoiSortierung,
} from "@/lib/pois/listenansicht";
import {
  VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
  type PoiListenEinstellungen,
} from "@/lib/pois/ansicht-einstellungen";
import {
  POI_STATUSES,
  POI_STATUS_COLOR,
  POI_STATUS_KURZ,
  POI_STATUS_LABEL,
} from "@/lib/pois/status-meta";
import {
  POI_TYPES,
  POI_TYPE_LABEL,
  POI_TYPE_COLOR,
} from "@/lib/pois/type-meta";
import {
  gegendFilterNochGueltig,
  gegendInDerListe,
  gegendenAus,
} from "@/lib/pois/gegenden";
import { bewertungKurz, bewertungText } from "@/lib/pois/bewertung";
import { formatPoiNummer } from "@/lib/pois/nummer";
import { POI_BUCHUNG_LABEL, poiBuchung } from "@/lib/pois/buchung";
import { poiWege } from "@/lib/pois/wege";
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
import { FotoAnsicht } from "@/components/foto-ansicht";
import {
  AusrufeIcon,
  GlobeIcon,
  HakenIcon,
  NavigationIcon,
  StarIcon,
  StopIcon,
  SucheIcon,
} from "@/components/icons";
import { KiBildMarke } from "@/components/ki-bild-marke";
import { istKiBild } from "@/lib/pois/ki-bild";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import { PoiAnlegezeile } from "./poi-anlegezeile";
import { PoiForm } from "./poi-form";
import { PoiBewertung } from "./poi-bewertung";
import bildlauf from "@/components/bildlauf.module.css";
import styles from "./poi-list.module.css";

/** Der Schluessel des Formulars, mit dem ein neuer POI angelegt wird. */
export const NEUER_POI = "neu";

export function PoiList({
  pois,
  highlightedPoiId,
  onStatusChange,
  onStatusChangeFuerMehrere = () => {},
  tripId,
  hasSearchArea,
  onPoisAdded,
  hasAiKey = false,
  hasGoogleKey = false,
  listenEinstellungen = VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
  onListenEinstellungenChange = () => {},
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
  /**
   * Derselbe Status fuer alle angekreuzten POIs (req-069). Es ist dieselbe
   * Statusliste wie beim einzelnen POI -- es kommt keiner hinzu und keiner
   * faellt weg.
   */
  onStatusChangeFuerMehrere?: (poiIds: string[], status: PoiStatus) => void;
  tripId: string;
  hasSearchArea: boolean;
  onPoisAdded: (pois: Poi[]) => void;
  /** Ob der Account einen Zugangsschluessel fuer die KI-Suche hat (req-028). */
  hasAiKey?: boolean;
  /** Ob der Account einen Zugangsschluessel fuer Google hat (req-028). */
  hasGoogleKey?: boolean;
  /**
   * Typfilter, Statusfilter und Sortierung der Liste (req-010, req-060). Sie
   * liegen seit bug-052 ausserhalb: diese Komponente unmountet beim Wechsel
   * des Planer-Bereichs, und mit ihr waere die Einstellung fort. Wer sie
   * nicht hereinreicht, bekommt die unbefangene Liste -- umstellen laesst sie
   * sich dann nicht.
   */
  listenEinstellungen?: PoiListenEinstellungen;
  onListenEinstellungenChange?: (einstellungen: PoiListenEinstellungen) => void;
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
  // Anlegezeile darueber nimmt keinen von beiden mit. Gehalten werden sie
  // seit bug-052 weiter oben -- hier stuenden sie nur bis zum naechsten
  // Bereichswechsel.
  const { typeFilter, statusFilter, gegendFilter, sortierung } =
    listenEinstellungen;
  // Die Gegenden entstehen aus den POIs selbst (req-095) -- es gibt keine
  // eigene Verwaltung und damit nichts zu laden.
  const gegenden = gegendenAus(pois);

  function setzeTypFilter(typeFilter: PoiTypeFilter) {
    onListenEinstellungenChange({ ...listenEinstellungen, typeFilter });
  }

  function setzeGegendFilter(gegendFilter: PoiGegendFilter) {
    onListenEinstellungenChange({ ...listenEinstellungen, gegendFilter });
  }

  function setzeStatusFilter(statusFilter: PoiStatusFilter) {
    onListenEinstellungenChange({ ...listenEinstellungen, statusFilter });
  }

  function setzeSortierung(sortierung: PoiSortierung) {
    onListenEinstellungenChange({ ...listenEinstellungen, sortierung });
  }
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
  // Ob die Liste gerade ausgewählt wird (req-097). Erst dann tragen die
  // Zeilen ein Ankreuzfeld, und im Kopf stehen statt der Filter die Aktionen
  // für die Auswahl -- eine seltene Handlung kostet sonst in jeder Zeile
  // dauerhaft Platz.
  const [auswahlModus, setAuswahlModus] = useState(false);
  const [startet, setStartet] = useState(false);
  // Was beim letzten Speichern mit den Bildern aus Google schiefging
  // (bug-027) -- null heisst: nichts zu melden.
  const [fotoProblem, setFotoProblem] = useState<string | null>(null);
  // Von welchem POI die Fotos gerade gross gezeigt werden (bug-038) -- null
  // heisst: von keinem. Gespeichert wird die Kennung, nicht der POI selbst:
  // so zeigt die Ansicht auch nach einer Aenderung den aktuellen Stand.
  const [grossansichtVon, setGrossansichtVon] = useState<string | null>(null);

  // Waehrend eine Runde laeuft, wird keine zweite vorbereitet: zu einer Reise
  // laeuft hoechstens eine (req-054, Out of Scope).
  const laufende = laufendeRunde(runden, tripId);

  /** „Fertig": der Auswahlmodus endet, und mit ihm die Auswahl. */
  function beendeAuswahl() {
    setAuswahlModus(false);
    setAusgewaehlt([]);
  }

  /**
   * Im Auswahlmodus ist die ganze Zeile das Tippziel (req-097) -- nur was
   * selbst bedienbar ist (Wege, Status, das Kästchen), tut weiter das
   * Seine.
   */
  function zeileAngetippt(poiId: string, ziel: EventTarget) {
    if (!auswahlModus) return;
    if (ziel instanceof Element && ziel.closest("a, select, input, label")) {
      return;
    }
    toggleAuswahl(poiId);
  }

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
  // Wurde die gefilterte Gegend beim letzten POI entfernt, gibt es sie nicht
  // mehr -- der gemerkte Filter (bug-052) zeigte dann dauerhaft eine leere
  // Liste. Er faellt deshalb auf "alle" zurueck (req-095).
  const geltenderGegendFilter = gegendFilterNochGueltig(gegendFilter, pois)
    ? gegendFilter
    : "alle";
  const visible = sortiertePois(
    gefiltertePois(pois, {
      typeFilter,
      statusFilter,
      gegendFilter: geltenderGegendFilter,
    }),
    sortierung,
  );

  /** Die angekreuzten POIs — nur die, die es noch gibt und die man sieht. */
  const angekreuzte = visible.filter((poi) => ausgewaehlt.includes(poi.id));

  // Der POI, dessen Fotos gerade gross gezeigt werden (bug-038). Ist er
  // inzwischen fort oder hat er kein Foto mehr, gibt es nichts zu zeigen.
  const grossansicht = pois.find((poi) => poi.id === grossansichtVon) ?? null;
  // Die Herkunft geht mit: ein erzeugtes Bild traegt sein Zeichen auch in
  // der Grossansicht (req-072).
  const grossansichtFotos = (grossansicht?.photos ?? []).map((foto) => ({
    src: poiFotoUrl(foto.id),
    kiBild: istKiBild(foto),
  }));

  function loescheAusgewaehlte() {
    if (angekreuzte.length === 0) return;
    onPoisDelete(angekreuzte);
    setAusgewaehlt([]);
  }

  /**
   * Den gewaehlten Status fuer alle angekreuzten POIs (req-069). Die Auswahl
   * bleibt danach stehen -- anders als beim Entfernen gibt es die POIs noch,
   * und oft schliesst sich gleich eine zweite Aktion an.
   */
  function setzeStatusFuerAusgewaehlte(status: PoiStatus) {
    if (angekreuzte.length === 0) return;
    onStatusChangeFuerMehrere(
      angekreuzte.map((poi) => poi.id),
      status,
    );
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
          viel Platz, und mehr als einen Wert gleichzeitig gibt es nicht.

          Dieselbe Zeile trägt seit bug-040 die Auswahl und ihre Aktionen:
          links das Ankreuzkästchen „alle", rechts „Ausgewählte löschen" und
          die Bewertungsrunde — als Symbol mit Tooltip statt mit Text. Sie
          standen bis dahin in einer eigenen Leiste darunter und kosteten
          eine ganze Zeile über der Liste. */}
      <div className={styles.filterRow} data-testid="poi-filterzeile">
        {auswahlModus ? (
          <>
            {/* Angekreuzt wird für zweierlei: das Aussortieren mehrerer POIs
                auf einmal (req-057) -- das darf jeder, der auch einzeln
                löschen darf -- und, beim Reiseleiter, das Vorbereiten einer
                Bewertungsrunde (req-054). */}
            <span className={styles.filterAuswahl}>
              <TippzielCheckbox
                aria-label="Alle POIs auswählen"
                title="Alle POIs auswählen"
                checked={
                  visible.length > 0 && angekreuzte.length === visible.length
                }
                onChange={(e) =>
                  setAusgewaehlt(
                    e.target.checked ? visible.map((poi) => poi.id) : [],
                  )
                }
              />
            </span>
            <span className={styles.auswahlZahl}>
              {angekreuzte.length} ausgewählt
            </span>
            {/* Die Aktionen stehen dort, wo sonst die Filter liegen
                (req-097). */}
            <div className={styles.filterActions}>
              {/* Der Status für alle angekreuzten POIs auf einmal (req-069).
                  Gesetzt werden kann jeder Status, den ein einzelner POI
                  auch annehmen kann; der neue ersetzt den bisherigen. Die
                  Auswahlliste fällt nach jedem Setzen auf ihre Beschriftung
                  zurück: sie zeigt keinen Zustand an, sondern löst eine
                  Aktion aus -- die angekreuzten POIs können ja verschiedene
                  Status tragen. */}
              <select
                className={`${styles.filterSelect} ${styles.bulkStatus}`}
                aria-label="Status für Ausgewählte setzen"
                title="Status für Ausgewählte setzen"
                value=""
                disabled={angekreuzte.length === 0}
                onChange={(e) =>
                  setzeStatusFuerAusgewaehlte(e.target.value as PoiStatus)
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
              {/* Entfernt nicht selbst, sondern öffnet die Rückfrage aus
                  req-035 -- und bleibt ohne angekreuzte POIs unwirksam. */}
              <button
                type="button"
                className={`${styles.filterAction} ${styles.filterActionText} ${styles.filterActionDanger}`}
                title="Ausgewählte entfernen"
                onClick={loescheAusgewaehlte}
                disabled={angekreuzte.length === 0}
              >
                Entfernen
              </button>
              {istReiseleiter && !laufende && (
                <button
                  type="button"
                  className={styles.filterAction}
                  title="Bewertungsrunde starten"
                  aria-label="Bewertungsrunde starten"
                  onClick={starteRunde}
                  disabled={angekreuzte.length === 0 || startet}
                >
                  <StarIcon />
                </button>
              )}
              <button
                type="button"
                className={`${styles.filterAction} ${styles.filterActionText} ${styles.filterActionLeise}`}
                onClick={beendeAuswahl}
              >
                Fertig
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.filterField}>
              <span className={styles.filterLabel}>Typ</span>
              <select
                className={styles.filterSelect}
                aria-label="Nach Typ filtern"
                value={typeFilter}
                onChange={(e) =>
                  setzeTypFilter(e.target.value as PoiTypeFilter)
                }
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
                onChange={(e) =>
                  setzeStatusFilter(e.target.value as PoiStatusFilter)
                }
              >
                <option value="alle">Alle</option>
                {POI_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {POI_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </div>
            {/* Nach Gegend filtern (req-095). Die Auswahl fehlt ganz, solange
                kein POI eine Gegend traegt -- ein Filter ohne Inhalt ist nur ein
                leeres Feld. */}
            {gegenden.length > 0 && (
              <div className={styles.filterField}>
                <span className={styles.filterLabel}>Gegend</span>
                <select
                  className={styles.filterSelect}
                  aria-label="Nach Gegend filtern"
                  value={geltenderGegendFilter}
                  onChange={(e) => setzeGegendFilter(e.target.value)}
                >
                  <option value="alle">Alle</option>
                  {gegenden.map((gegend) => (
                    <option key={gegend} value={gegend}>
                      {gegend}
                    </option>
                  ))}
                  <option value="ohne">Ohne Gegend</option>
                </select>
              </div>
            )}
            <div className={styles.filterField}>
              <span className={styles.filterLabel}>Sortieren</span>
              <select
                className={styles.filterSelect}
                aria-label="Sortieren nach"
                value={sortierung}
                onChange={(e) =>
                  setzeSortierung(e.target.value as PoiSortierung)
                }
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
            {/* Läuft eine Runde, steht ihr Hinweis und das Beenden hier
                (req-054) -- beenden braucht keine Auswahl. */}
            {istReiseleiter && laufende && (
              <span className={styles.filterNote}>
                Bewertungsrunde läuft — {laufende.poiIds.length}{" "}
                {laufende.poiIds.length === 1 ? "POI" : "POIs"}
              </span>
            )}
            <div className={styles.filterActions}>
              {istReiseleiter && laufende && (
                <button
                  type="button"
                  className={styles.filterAction}
                  title="Bewertungsrunde beenden"
                  aria-label="Bewertungsrunde beenden"
                  onClick={beendeRunde}
                  disabled={startet}
                >
                  <StopIcon />
                </button>
              )}
              <button
                type="button"
                className={`${styles.filterAction} ${styles.filterActionText}`}
                onClick={() => setAuswahlModus(true)}
              >
                Auswählen
              </button>
            </div>
          </>
        )}
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
      <div
        className={`${styles.scroll} ${bildlauf.bildlauf}`}
        data-testid="poi-scrollbereich"
      >
        {creating && (
          <PoiForm
            poi={null}
            tripId={tripId}
            vorbelegung={creating.vorbelegung}
            hasGoogleKey={hasGoogleKey}
            hasAiKey={hasAiKey}
            gegenden={gegenden}
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

        <ul className={styles.rows}>
          {visible.map((poi) => {
            const { webseite, karte } = poiWege(poi);
            const photos = poi.photos ?? [];
            const bewertung = bewertungKurz(poi);
            const buchung = poiBuchung(poi);
            const gegend = gegendInDerListe(poi);
            const offen = expanded.includes(poi.id);
            const stand = bewertungsstand(poi.id, runden, stimmen, personen);
            const ort = poi.ort.trim();
            const titelId = `poi-titel-${poi.id}`;
            const kurztextId = `poi-text-${poi.id}`;
            const welterbe = poi.type === "weltkulturerbe";
            return (
              <li
                key={poi.id}
                data-testid={`poi-row-${poi.id}`}
                className={`${styles.row} ${
                  poi.id === highlightedPoiId ? styles.rowHighlighted : ""
                } ${
                  auswahlModus && ausgewaehlt.includes(poi.id)
                    ? styles.rowAusgewaehlt
                    : ""
                }`}
                // Typ- und Statusfarbe kommen aus den bestehenden Konstanten
                // (req-097) -- das Blatt liest sie von hier.
                style={
                  {
                    "--typ": POI_TYPE_COLOR[poi.type],
                    "--status": POI_STATUS_COLOR[poi.status],
                  } as React.CSSProperties
                }
              >
                {/* Drei Spalten (req-097): das Bild mit Bewertung und
                    Buchung darunter, in der Mitte Titel, Kurztext und Wege,
                    rechts Status und Gegend. Das Formular darunter gehoert
                    der Zeile selbst und nutzt ihre ganze Breite (bug-014). */}
                <div
                  className={`${styles.rowTop} ${
                    auswahlModus ? styles.rowTopWaehlbar : ""
                  }`}
                  onClick={(e) => zeileAngetippt(poi.id, e.target)}
                >
                  {/* Angehakt wird zum Aussortieren (req-057) und, beim
                      Reiseleiter, zum Vorbereiten einer Bewertungsrunde
                      (req-054). */}
                  {auswahlModus && (
                    <span className={styles.haken}>
                      <TippzielCheckbox
                        ueberlagernd
                        aria-label={`${poi.name} auswählen`}
                        checked={ausgewaehlt.includes(poi.id)}
                        onChange={() => toggleAuswahl(poi.id)}
                      />
                    </span>
                  )}
                  <div className={styles.bildspalte}>
                    <div
                      className={`${styles.bild} ${
                        welterbe ? styles.bildWelterbe : ""
                      }`}
                      data-testid={`poi-bild-${poi.id}`}
                    >
                      {/* Das erste Foto ersetzt die leere Flaeche (req-026).
                          Ein Klick darauf zeigt es gross (bug-038). */}
                      {photos.length > 0 ? (
                        <button
                          type="button"
                          className={styles.photoButton}
                          aria-label={`Fotos von ${poi.name} groß anzeigen`}
                          onClick={() => {
                            // Im Auswahlmodus kreuzt der Tipp die Zeile an
                            // (über die Zeile selbst), statt zu vergrößern.
                            if (!auswahlModus) setGrossansichtVon(poi.id);
                          }}
                        >
                          {/* Die Datei liegt im Bildverzeichnis ausserhalb
                              des Repos und geht ueber /api/poi-fotos heraus,
                              nicht ueber den Bild-Optimierer von Next. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className={styles.photo}
                            src={poiFotoUrl(photos[0].id)}
                            alt={`Foto von ${poi.name}`}
                          />
                        </button>
                      ) : (
                        <div
                          className={styles.swatch}
                          data-testid={`poi-swatch-${poi.id}`}
                          aria-hidden="true"
                        />
                      )}
                      {/* Nummer und Typ liegen auf dem Bild (req-097) und
                          brauchen so keinen Platz in der Mitte -- auch ohne
                          Foto, dann auf der leeren Flaeche. */}
                      <span
                        className={styles.nummer}
                        data-testid={`poi-number-${poi.id}`}
                      >
                        {formatPoiNummer(poi.number)}
                      </span>
                      <span
                        className={styles.typBand}
                        data-testid={`poi-typ-${poi.id}`}
                      >
                        {POI_TYPE_LABEL[poi.type]}
                      </span>
                      {/* Ist das erste Foto ein KI-Bild, ist es auch hier
                          als solches zu erkennen (req-072) -- oben rechts,
                          weil unten der Typ steht. */}
                      {photos.length > 0 && istKiBild(photos[0]) && (
                        <span className={styles.kiEcke}>
                          <KiBildMarke />
                        </span>
                      )}
                    </div>
                    <div className={styles.unterbild}>
                      {/* Die Bewertung bei Google mit der Anzahl (req-057),
                          knapp gefasst; die volle Angabe im Tooltip. */}
                      {bewertung && (
                        <span
                          className={styles.bewertung}
                          data-testid={`poi-google-bewertung-${poi.id}`}
                          title={`${bewertungText(poi)} Bewertungen`}
                        >
                          <span className={styles.stern}>
                            <span aria-hidden="true">★</span> {bewertung.note}
                          </span>
                          {bewertung.anzahl && (
                            <span className={styles.anzahl}>
                              {bewertung.anzahl}
                            </span>
                          )}
                        </span>
                      )}
                      {/* Die Buchung als Zeichen (req-061, req-097). „Nicht
                          nötig" trägt keines: sonst trüge jede Zeile ein
                          Zeichen für „nichts zu tun". */}
                      {buchung !== "nicht_noetig" && (
                        <span
                          className={`${styles.buchung} ${
                            buchung === "gebucht"
                              ? styles.buchungGebucht
                              : styles.buchungOffen
                          }`}
                          data-testid={`poi-buchung-${poi.id}`}
                          role="img"
                          aria-label={`Buchung: ${POI_BUCHUNG_LABEL[buchung]}`}
                          title={`Buchung: ${POI_BUCHUNG_LABEL[buchung]}`}
                        >
                          {buchung === "gebucht" ? (
                            <HakenIcon />
                          ) : (
                            <AusrufeIcon />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.mitte}>
                    {/* Titel und Kurztext klappen gemeinsam das Formular der
                        Zeile auf (req-035): so ist die Flaeche gross genug
                        für den Finger, ohne die Zeile höher zu machen. Ihr
                        Name bleibt der des POI. */}
                    <button
                      type="button"
                      className={styles.rowName}
                      data-testid={`poi-name-${poi.id}`}
                      aria-expanded={offen}
                      aria-labelledby={titelId}
                      aria-describedby={kurztextId}
                      onClick={() => {
                        // Im Auswahlmodus kreuzt der Tipp die Zeile an.
                        if (!auswahlModus) toggleExpanded(poi.id);
                      }}
                    >
                      <span
                        id={titelId}
                        className={styles.titel}
                        data-testid={`poi-titel-${poi.id}`}
                      >
                        {poi.name}
                      </span>
                      {/* Der Ort steht vor dem Kurztext (req-097) -- er ist
                          ein Stück Beschreibung und braucht keine eigene
                          Zeile. Was nicht hineinpasst, wird abgeschnitten;
                          die Zeile bleibt gleich hoch. */}
                      <span id={kurztextId} className={styles.kurztext}>
                        {ort.length > 0 && (
                          <span
                            className={styles.ort}
                            data-testid={`poi-ort-${poi.id}`}
                          >
                            {ort}
                          </span>
                        )}
                        {poi.shortText && (
                          <span data-testid={`poi-kurztext-${poi.id}`}>
                            {poi.shortText}
                          </span>
                        )}
                        {/* Warum die KI diesen Ort vorschlägt (req-057) --
                            kursiv, nach dem Kurztext. */}
                        {poi.kiBegruendung && (
                          <span
                            className={styles.begruendung}
                            data-testid={`poi-begruendung-${poi.id}`}
                          >
                            {poi.kiBegruendung}
                          </span>
                        )}
                      </span>
                    </button>
                    {/* Zwei Wege (req-097): Webseite und Karte. Fehlt die
                        Webseite, führt dasselbe Symbol an derselben Stelle
                        zur Google-Suche -- als Lupe mit Punkt. */}
                    <div className={styles.wege}>
                      <a
                        className={`${styles.weg} ${
                          webseite.istSuche ? styles.wegSuche : ""
                        }`}
                        data-testid={`poi-webseite-${poi.id}`}
                        href={webseite.url}
                        target="_blank"
                        rel="noreferrer"
                        title={
                          webseite.istSuche
                            ? "Bei Google suchen (keine Webseite hinterlegt)"
                            : "Webseite"
                        }
                        aria-label={
                          webseite.istSuche ? "Bei Google suchen" : "Webseite"
                        }
                      >
                        <span className={styles.wegSymbol}>
                          {webseite.istSuche ? (
                            <SucheIcon size={13} />
                          ) : (
                            <GlobeIcon size={13} />
                          )}
                        </span>
                      </a>
                      <a
                        className={styles.weg}
                        data-testid={`poi-karte-${poi.id}`}
                        href={karte}
                        target="_blank"
                        rel="noreferrer"
                        title="Auf der Karte"
                        aria-label="Auf der Karte"
                      >
                        <span className={styles.wegSymbol}>
                          <NavigationIcon size={13} />
                        </span>
                      </a>
                    </div>
                  </div>
                  <div className={styles.rechts}>
                    {/* Der Status trägt seine Farbe selbst (req-097) -- es
                        ist dieselbe wie die der Nadel auf der Karte. Das
                        Farbband links gibt es dafür nicht mehr. */}
                    <select
                      className={styles.statusSelect}
                      data-testid={`poi-status-${poi.id}`}
                      aria-label={`Status von ${poi.name}`}
                      value={poi.status}
                      onChange={(e) =>
                        onStatusChange(poi.id, e.target.value as PoiStatus)
                      }
                    >
                      {POI_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {POI_STATUS_KURZ[status]}
                        </option>
                      ))}
                    </select>
                    {/* Die Gegend als Kürzel (req-095, req-097), der volle
                        Name beim Überfahren. */}
                    <span
                      className={`${styles.gegend} ${
                        gegend.leer ? styles.gegendLeer : ""
                      }`}
                      data-testid={`poi-gegend-${poi.id}`}
                      title={gegend.titel}
                    >
                      {gegend.text}
                    </span>
                  </div>
                </div>
                {/* Der Stand der Bewertung (req-054) -- auch der einer
                    beendeten Runde: ihre Stimmen bleiben sichtbar. Er steht
                    unter der Zeile, deren Höhe fest ist. */}
                {stand && <PoiBewertung poiId={poi.id} stand={stand} />}
                {/* Ein Klick auf den Titel klappt die Zeile zu einem
                  Formular auf (req-035). Es steht unter der Zeile, damit es
                  dieselbe Breite hat wie beim Anlegen (bug-014). Dort wird
                  auch gelöscht -- einen Papierkorb je Zeile gibt es nicht
                  (req-097). */}
                {offen && (
                  <PoiForm
                    poi={poi}
                    tripId={tripId}
                    hasGoogleKey={hasGoogleKey}
                    hasAiKey={hasAiKey}
                    gegenden={gegenden}
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

      {/* Die Großansicht liegt über der ganzen Seite und deshalb außerhalb
          des Bildlaufbereichs (bug-038). Sie zeigt alle Fotos des POI, nicht
          nur das erste aus der Zeile. */}
      {grossansicht && grossansichtFotos.length > 0 && (
        <FotoAnsicht
          fotos={grossansichtFotos}
          titel={grossansicht.name}
          onClose={() => setGrossansichtVon(null)}
        />
      )}
    </div>
  );
}
