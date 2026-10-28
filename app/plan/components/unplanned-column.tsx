import { useState } from "react";
import type { Poi } from "@/lib/pois/types";
import {
  POI_AUSWAHL_SORTIERUNGEN,
  gefiltertePois,
  leereListeGrund,
  sortiertePois,
} from "@/lib/pois/listenansicht";
import {
  VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
  type PoiAuswahlEinstellungen,
} from "@/lib/pois/ansicht-einstellungen";
import { PLANNABLE_STATUSES } from "@/lib/pois/plannable";
import {
  POI_STATUS_COLOR,
  POI_STATUS_KURZ,
  POI_STATUS_LABEL,
} from "@/lib/pois/status-meta";
import { POI_TYPE_COLOR, POI_TYPE_LABEL } from "@/lib/pois/type-meta";
import { bewertungKurz, bewertungText } from "@/lib/pois/bewertung";
import { POI_BUCHUNG_LABEL, poiBuchung } from "@/lib/pois/buchung";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import { istKiBild } from "@/lib/pois/ki-bild";
import { KiBildMarke } from "@/components/ki-bild-marke";
import { formatPoiNummer } from "@/lib/pois/nummer";
import { formatPoiDuration } from "@/lib/pois/estimated-duration";
import {
  AufklappenIcon,
  AusrufeIcon,
  HakenIcon,
  UhrIcon,
  ZuklappenIcon,
} from "@/components/icons";
import { usePointerDrag, type DropTarget } from "./pointer-drag";
import { PoiListenKopf } from "./poi-listen-kopf";
import styles from "./unplanned-column.module.css";
import bildlauf from "@/components/bildlauf.module.css";

/**
 * Linke Spalte "POI-Auswahl" der Planungsansicht (siehe req-011): gesetzte
 * und wahrscheinliche POIs, gleich ob und wie oft sie schon verplant sind.
 *
 * Bis req-083 hiess die Spalte "Noch unverplant" und zeigte nur POIs ohne
 * Programmpunkt -- seit req-083 laesst sich ein POI beliebig oft verplanen,
 * die Spalte zeigt deshalb alle und traegt auf jeder Karte, wie oft ihr POI
 * schon verplant ist (`planCounts`). Seit req-099 steht die Zahl immer, ohne
 * Programmpunkt als "0" im gestrichelten Rahmen.
 *
 * Seit req-039 laesst sich ein POI von hier auf den Zeitstrahl ziehen -- mit
 * der Maus nativ, seit bug-017 mit dem Finger ueber Zeiger-Ereignisse. Ohne
 * `onDragStart` ist das nicht moeglich -- dann bleibt es bei der Anzeige.
 *
 * Waehrend des Zuges zeigt der Zeitstrahl einen Umriss (req-046). Wo der
 * Finger dabei steht, weiss nur diese Spalte -- ihm gehoeren die
 * Zeiger-Ereignisse, sobald der Zug laeuft; sie meldet es deshalb weiter.
 *
 * Seit req-074 traegt jede Karte die Nummer ihres POI -- dieselbe, die auf dem
 * Kartenmarker und in der POI-Liste steht. Seit req-099 sieht die Karte aus
 * wie die Zeile der POI-Liste (req-097), nur kleiner: Bild mit Nummer und
 * Typ, Bewertung und Buchung, Titel, Ort, Dauer, Status und Verplanung.
 *
 * Bleibt der Finger auf einer Karte liegen, ist der POI gegriffen (bug-023):
 * seine Rahmenfarbe sagt es an, und von da an laesst er sich in einem Zug
 * direkt auf die Uhrzeit ziehen.
 *
 * Seit req-099 laesst sich die Spalte zuklappen, damit die Tageskarte daneben
 * Platz bekommt. Uebrig bleibt ein Streifen mit dem Griff zum Aufklappen --
 * ganz verschwindet sie nie, sonst wuesste niemand, wie sie zurueckkommt.
 * Zugeklappt wird nichts gezogen, und sie springt beim Anfassen auch nicht
 * von selbst auf: wer ziehen will, klappt vorher auf.
 */

/**
 * Der Griff zum Zu- und Aufklappen (req-099) -- dieselbe Art Knopf wie
 * "Liste ausblenden" der SplitView (bug-042): ein Symbol, der Zustand am
 * `aria-pressed`, der Satz in `title` und `aria-label`.
 */
function AuswahlGriff({
  zugeklappt,
  onUmschalten,
}: {
  zugeklappt: boolean;
  onUmschalten: () => void;
}) {
  const label = zugeklappt ? "Auswahl aufklappen" : "Auswahl zuklappen";
  return (
    <button
      type="button"
      className={styles.griff}
      aria-pressed={zugeklappt}
      title={label}
      aria-label={label}
      data-testid="poi-auswahl-griff"
      onClick={onUmschalten}
    >
      <span className={styles.griffFlaeche}>
        {zugeklappt ? <AufklappenIcon /> : <ZuklappenIcon />}
      </span>
    </button>
  );
}
/**
 * Die Geistbox, die beim Ziehen mit der Maus am Zeiger haengt (req-099):
 * Nummer, Titel und Dauer, ohne Bild. Ohne sie nimmt der Browser ein Abbild
 * der ganzen Karte -- mit Bild groesser als der Block, den sie ankuendigt,
 * und traeger beim Bewegen.
 *
 * Der Browser liest das Element nur im Augenblick des Zugbeginns ab; danach
 * wird es wieder entfernt. Mit dem Finger (bug-017) gibt es kein Zugbild --
 * dort zeigt allein der Umriss im Zeitstrahl, wo der POI landet (req-046).
 */
export function geistboxFuer(poi: Poi): HTMLElement {
  const box = document.createElement("div");
  box.className = styles.geist;
  box.setAttribute("aria-hidden", "true");
  box.setAttribute("data-testid", `unplanned-poi-geist-${poi.id}`);
  for (const [klasse, text] of [
    [styles.geistNummer, formatPoiNummer(poi.number)],
    [styles.geistName, poi.name],
    [styles.geistDauer, formatPoiDuration(poi)],
  ]) {
    const teil = document.createElement("span");
    teil.className = klasse;
    teil.textContent = text;
    box.append(teil);
  }
  return box;
}

function zeigeGeistbox(
  transfer: DataTransfer | null,
  karte: HTMLElement,
  poi: Poi,
): void {
  if (!transfer?.setDragImage) return;
  const box = geistboxFuer(poi);
  // In die Spalte, nicht an das Dokument: nur dort gelten die Farben des
  // Planers.
  (karte.closest('[data-testid="poi-auswahl"]') ?? document.body).append(box);
  transfer.setDragImage(box, 14, 14);
  // Erst nach dem Ablesen entfernen -- im selben Augenblick waere das Bild
  // in manchen Browsern leer.
  window.setTimeout(() => box.remove(), 0);
}

export function UnplannedColumn({
  pois,
  planCounts,
  einstellungen = VORGEWAEHLTE_AUSWAHL_EINSTELLUNGEN,
  onEinstellungenChange = () => {},
  gegenden = [],
  onDragStart,
  onDragEnd,
  onPointerDragMove,
  onPointerDrop,
  onPointerDragEnd,
  zugeklappt = false,
  onZugeklapptChange,
}: {
  /** Alle POIs, die sich verplanen lassen -- gefiltert wird hier. */
  pois: Poi[];
  /** Wie oft jeder POI ueber die ganze Reise verplant ist (req-083). */
  planCounts: Map<string, number>;
  /**
   * Filter und Sortierung (req-083, req-095, req-099) -- sie liegen beim
   * Aufrufer, damit sie den Wechsel des Planer-Bereichs ueberleben.
   */
  einstellungen?: PoiAuswahlEinstellungen;
  onEinstellungenChange?: (einstellungen: PoiAuswahlEinstellungen) => void;
  /**
   * Die Gegenden dieser Reise (req-095). Ist die Liste leer, fehlt das Feld
   * im Filterblatt -- ein Filter ohne Inhalt ist nur ein leeres Feld.
   */
  gegenden?: string[];
  onDragStart?: (poi: Poi) => void;
  onDragEnd?: () => void;
  /** Mit dem Finger ueber einer Ablageflaeche bewegt (req-046). */
  onPointerDragMove?: (poi: Poi, target: DropTarget | null) => void;
  /** Mit dem Finger auf einer Ablageflaeche losgelassen (bug-017). */
  onPointerDrop?: (poi: Poi, target: DropTarget) => void;
  /** Der Finger-Zug ist vorbei, gleich ob abgelegt oder abgebrochen (req-046). */
  onPointerDragEnd?: () => void;
  /**
   * Ob die Spalte zugeklappt ist (req-099). Der Zustand liegt beim Aufrufer,
   * damit er den Wechsel des Reisetages und des Bereichs ueberdauert.
   */
  zugeklappt?: boolean;
  /**
   * Ohne diesen Rueckruf laesst sich die Spalte nicht zuklappen -- etwa in
   * der schmalen Ordnung (req-088), wo sie allein neben dem Zeitstrahl steht.
   */
  onZugeklapptChange?: (zugeklappt: boolean) => void;
}) {
  const draggable = Boolean(onDragStart);
  // Der Suchbegriff wird bewusst nicht gemerkt (req-098) -- er lebt, solange
  // die Spalte steht, auch zugeklappt.
  const [suche, setSuche] = useState("");
  // Dieselbe Filterlogik wie in der POI-Liste, mit dem Feld "Verplanung"
  // mehr (req-099).
  const sichtbar = sortiertePois(
    gefiltertePois(pois, einstellungen, suche, planCounts),
    einstellungen.sortierung,
  );
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

  if (zugeklappt && onZugeklapptChange) {
    // Der Streifen (req-099): der Griff, die Zahl der POIs, die der Filter
    // durchlaesst, und der Name senkrecht. Gezogen wird von hier nichts.
    return (
      <div
        className={`${styles.column} ${styles.zu}`}
        data-testid="poi-auswahl"
        data-zugeklappt="true"
      >
        <div className={styles.streifen}>
          <AuswahlGriff
            zugeklappt
            onUmschalten={() => onZugeklapptChange(false)}
          />
          <span
            className={styles.streifenZahl}
            data-testid="poi-auswahl-streifen-zahl"
            title={
              sichtbar.length === 1
                ? "1 POI passt zu Filter und Suche"
                : `${sichtbar.length} POIs passen zu Filter und Suche`
            }
          >
            {sichtbar.length}
          </span>
          <span className={styles.senkrecht} aria-hidden="true">
            POI-Auswahl
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.column} data-testid="poi-auswahl">
      {/* Der Kopf wie in der POI-Liste (req-098): Suchfeld, Filter und
          Sortieren -- dazu der Griff zum Zuklappen, wo es ihn gibt. */}
      <PoiListenKopf
        titel="POI-Auswahl"
        verplanung
        statuses={PLANNABLE_STATUSES}
        sortierungen={POI_AUSWAHL_SORTIERUNGEN}
        griff={
          onZugeklapptChange && (
            <AuswahlGriff
              zugeklappt={false}
              onUmschalten={() => onZugeklapptChange(true)}
            />
          )
        }
        pois={pois}
        sichtbar={sichtbar.length}
        gegenden={gegenden}
        einstellungen={einstellungen}
        onEinstellungenChange={onEinstellungenChange}
        suche={suche}
        onSucheChange={setSuche}
      />
      {sichtbar.length === 0 && pois.length > 0 && (
        <p className={styles.leer} data-testid="poi-auswahl-leer">
          {leereListeGrund(einstellungen, suche)}
        </p>
      )}
      <ul className={`${styles.list} ${bildlauf.bildlauf}`}>
        {sichtbar.map((poi) => {
          const anzahl = planCounts.get(poi.id) ?? 0;
          const foto = poi.photos?.[0];
          const bewertung = bewertungKurz(poi);
          const buchung = poiBuchung(poi);
          return (
            <li
              key={poi.id}
              style={
                {
                  "--typ": POI_TYPE_COLOR[poi.type],
                  "--status": POI_STATUS_COLOR[poi.status],
                } as React.CSSProperties
              }
              className={`${styles.card}${draggable ? ` ${styles.draggable}` : ""}${
                gegriffenerPoi?.id === poi.id ? ` ${styles.gegriffen}` : ""
              }`}
              data-testid={`unplanned-poi-${poi.id}`}
              draggable={draggable}
              onDragStart={(event) => {
                if (!onDragStart) return;
                // Manche Browser starten einen Zug nur mit gesetzten Daten;
                // die Oberflaeche selbst merkt sich den POI in ihrem Zustand.
                event.dataTransfer?.setData("text/plain", poi.id);
                zeigeGeistbox(event.dataTransfer, event.currentTarget, poi);
                onDragStart(poi);
              }}
              onDragEnd={onDragEnd}
              {...fingerZug(poi)}
            >
              {/* Drei Spalten wie die Zeile der POI-Liste (req-097, req-099):
                  das Bild mit Bewertung und Buchung darunter, in der Mitte
                  Titel, Ort und Dauer, rechts Status und Verplanungsstand. */}
              <div className={styles.bildspalte}>
                <div
                  className={`${styles.bild} ${
                    poi.type === "weltkulturerbe" ? styles.bildWelterbe : ""
                  }`}
                  data-testid={`unplanned-poi-bild-${poi.id}`}
                >
                  {foto && (
                    // Die Datei geht ueber /api/poi-fotos heraus, nicht ueber
                    // den Bild-Optimierer von Next. Sie selbst wird nicht
                    // gezogen -- gezogen wird die ganze Karte.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.foto}
                      src={poiFotoUrl(foto.id)}
                      alt=""
                      draggable={false}
                    />
                  )}
                  {/* Nummer und Typ liegen auf dem Bild -- auch ohne Foto,
                      dann auf der leeren Flaeche. Die Nummer ist dieselbe wie
                      auf dem Kartenmarker und in der POI-Liste (req-074). */}
                  <span
                    className={styles.nummer}
                    data-testid={`unplanned-poi-number-${poi.id}`}
                  >
                    {formatPoiNummer(poi.number)}
                  </span>
                  <span
                    className={styles.typBand}
                    data-testid={`unplanned-poi-typ-${poi.id}`}
                  >
                    {POI_TYPE_LABEL[poi.type]}
                  </span>
                  {foto && istKiBild(foto) && (
                    <span className={styles.kiEcke}>
                      <KiBildMarke />
                    </span>
                  )}
                </div>
                <div className={styles.unterbild}>
                  {bewertung && (
                    <span
                      className={styles.stern}
                      data-testid={`unplanned-poi-bewertung-${poi.id}`}
                      title={`${bewertungText(poi)} Bewertungen`}
                    >
                      <span aria-hidden="true">★</span> {bewertung.note}
                    </span>
                  )}
                  {/* "Nicht noetig" traegt kein Zeichen (req-061, req-097). */}
                  {buchung !== "nicht_noetig" && (
                    <span
                      className={`${styles.buchung} ${
                        buchung === "gebucht"
                          ? styles.buchungGebucht
                          : styles.buchungOffen
                      }`}
                      data-testid={`unplanned-poi-buchung-${poi.id}`}
                      role="img"
                      aria-label={`Buchung: ${POI_BUCHUNG_LABEL[buchung]}`}
                      title={`Buchung: ${POI_BUCHUNG_LABEL[buchung]}`}
                    >
                      {buchung === "gebucht" ? (
                        <HakenIcon size={9} />
                      ) : (
                        <AusrufeIcon size={9} />
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.mitte}>
                <p className={styles.name} title={poi.name}>
                  {poi.name}
                </p>
                {poi.ort.trim().length > 0 && (
                  <p className={styles.ort}>{poi.ort.trim()}</p>
                )}
                {/* Die Dauer bleibt hier (req-099): sie entscheidet, wie hoch
                    der Block auf dem Zeitstrahl wird. */}
                <p
                  className={styles.dauer}
                  data-testid={`unplanned-poi-dauer-${poi.id}`}
                >
                  <UhrIcon />
                  {formatPoiDuration(poi)}
                </p>
              </div>
              <div className={styles.rechts}>
                <span
                  className={styles.statusPille}
                  data-testid={`unplanned-poi-status-${poi.id}`}
                  title={POI_STATUS_LABEL[poi.status]}
                >
                  {POI_STATUS_KURZ[poi.status]}
                </span>
                {/* Wie oft der POI schon verplant ist (req-083). Seit req-099
                    steht die Zahl immer -- unverplant als "0" im
                    gestrichelten Rahmen, damit die Karten gleich hoch
                    bleiben. */}
                <span
                  className={`${styles.planCount} ${
                    anzahl === 0 ? styles.planCountNull : ""
                  }`}
                  data-testid={`unplanned-poi-count-${poi.id}`}
                  data-verplant={anzahl > 0 ? "ja" : "nein"}
                  title={
                    anzahl === 0
                      ? "Noch nicht verplant"
                      : anzahl === 1
                        ? "Einmal verplant"
                        : `${anzahl}-mal verplant`
                  }
                >
                  {anzahl}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
