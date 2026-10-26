"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi, PoiPlanFilter } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import { tripDays } from "@/lib/trips/days";
import { defaultDay } from "@/lib/trips/select-default";
import { activitiesForDay } from "@/lib/activities/day";
import {
  moveActivity,
  planPoi,
  removeActivity,
  resizeActivity,
  resizeActivityStart,
} from "@/lib/activities/save-activity";
import { saveOptionSelection } from "@/lib/activities/save-option-selection";
import { groupKey, type ActivityGroup } from "@/lib/activities/groups";
import {
  filterByPlanState,
  plannablePois,
  poiPlanCounts,
} from "@/lib/pois/plannable";
import { poiNummernNachId } from "@/lib/pois/nummer";
import { poiDurationMinutes } from "@/lib/pois/estimated-duration";
import { computeTimelineGrid } from "@/lib/plan/timeline-grid";
import {
  ZOOM_GRUNDSTUFE_PX,
  groessereStundenhoehePx,
  kleinereStundenhoehePx,
} from "@/lib/plan/timeline-zoom";
import { GRUNDRASTER_MINUTEN, type RasterMinuten } from "@/lib/plan/raster";
import { dropStartAt } from "@/lib/plan/plan-poi";
import {
  vorschlagAlsActivities,
  type Planvorschlag,
} from "@/lib/plan/ki-planung";
import { uebernimmVorschlag } from "@/lib/plan/run-ki-planung";
import {
  VORGEWAEHLTE_PLANUNG_SEITE,
  stehenSpaltenNebeneinander,
  type PlanungSeite,
} from "@/lib/plan/spalten";
import type { DropTarget } from "./pointer-drag";
import { UnplannedColumn } from "./unplanned-column";
import { TimelineColumn } from "./timeline-column";
import { KiPlanungDialog } from "./ki-planung-dialog";
import { DayRouteMap } from "./day-route-map";
import { SeitenUmschalter, type Seite } from "./seiten-umschalter";
import styles from "./planung-view.module.css";

/** Was neben dem Zeitstrahl stehen kann, solange nicht alle drei Platz haben. */
const SEITEN: Seite<PlanungSeite>[] = [
  { id: "auswahl", label: "POI-Auswahl" },
  { id: "karte", label: "Karte" },
];

/**
 * Der Bereich "Planung" des Planers (siehe req-011): drei Spalten
 * nebeneinander -- die POI-Auswahl, Zeitstrahl des gewaehlten Reisetages und
 * dessen Karte.
 *
 * Seit req-039 wird hier auch geplant: ein POI laesst sich aus der Auswahl
 * auf den Zeitstrahl ziehen, und ein Programmpunkt laesst sich wieder
 * entfernen. Seit req-083 bleibt der POI dabei in der Auswahl stehen --
 * beliebig oft verplanen ist erlaubt, die Auswahl zeigt dafuer, wie oft jeder
 * POI schon einen Programmpunkt hat. Seit req-040 laesst er sich ausserdem
 * umplanen -- auf eine andere Uhrzeit, auf einen anderen Reisetag oder auf
 * eine andere Dauer, seit req-046 an beiden Kanten. Seit bug-017 geht beides
 * mit der Maus wie mit dem Finger (siehe pointer-drag.ts). Seit req-052
 * laesst sich ausserdem zwischen zwei aufeinanderfolgenden Programmpunkten
 * ein Transfer anlegen, aendern und entfernen; die Liste der Transfers fuehrt
 * wie die der Programmpunkte der Aufrufer. Seit req-074 tragen die POIs
 * beider Spalten ihre Nummer, und seit bug-053 zeigt der Zeitstrahl eine
 * Options-Gruppe mit allen ihren Alternativen -- gewaehlt wird hier, ohne
 * dass sich eine Zeit aendert. Seit req-076 laesst sich der Zeitstrahl
 * ausserdem zoomen; der gewaehlte Zoom liegt hier und ueberdauert damit den
 * Wechsel des Reisetages. Seit req-082 laesst sich ausserdem zwischen 15 und
 * 5 Minuten Raster umschalten -- es liegt aus demselben Grund hier wie der
 * Zoom. Alles ist sofort gespeichert; die Liste der Programmpunkte fuehrt der
 * Aufrufer, damit sie den Bereichswechsel uebersteht. Ohne die jeweiligen
 * Rueckrufe bleibt es bei der reinen Anzeige.
 *
 * Seit req-088 laeuft der Planer auch auf dem iPad hochkant. Haben die drei
 * Spalten nicht nebeneinander Platz (lib/plan/spalten.ts), steht der
 * Zeitstrahl allein fest, und daneben die POI-Auswahl oder die Karte -- ein
 * Umschalter darueber waehlt. Die Wahl fuehrt der Aufrufer, damit sie den
 * Wechsel des Bereichs uebersteht; ohne ihn merkt sie sich die Ansicht selbst.
 */
export function PlanungView({
  trip,
  pois,
  activities,
  transfers,
  today,
  optionSelections = {},
  hasAiKey = false,
  planFilter = "alle",
  onPlanFilterChange = () => {},
  onActivityPlanned,
  onActivityRemoved,
  onActivityRescheduled,
  onOptionSelected,
  onTransferSaved,
  onTransferRemoved,
  onVorschlagUebernommen,
  windowWidth,
  seite: seiteVonAussen,
  onSeiteChange,
}: {
  trip: Trip;
  pois: Poi[];
  activities: Activity[];
  transfers: Transfer[];
  today: Date;
  optionSelections?: Record<string, string>;
  /**
   * Ob der Account einen Zugangsschluessel fuer die KI hat (req-028) -- ohne
   * ihn ist "KI planen lassen" nicht ausloesbar (req-056).
   */
  hasAiKey?: boolean;
  /**
   * Der Filter der POI-Auswahl nach Verplanungsstand (req-083) -- er liegt
   * beim Aufrufer, damit er den Wechsel des Planer-Bereichs ueberlebt.
   */
  planFilter?: PoiPlanFilter;
  onPlanFilterChange?: (filter: PoiPlanFilter) => void;
  onActivityPlanned?: (activity: Activity) => void;
  onActivityRemoved?: (activity: Activity) => void;
  /** Ein verschobener oder in seiner Dauer geaenderter Programmpunkt (req-040). */
  onActivityRescheduled?: (activity: Activity) => void;
  /**
   * Eine andere Alternative einer Options-Gruppe wurde gewaehlt (bug-053) --
   * abgeschickt ist die Wahl da bereits. Ohne Rueckruf zeigt die Gruppe ihre
   * Alternativen, laesst die Wahl aber, wie sie ist: wer sie nicht fuehrt,
   * koennte die neue nicht zeigen.
   */
  onOptionSelected?: (group: ActivityGroup, activityId: string) => void;
  /** Ein angelegter oder geaenderter Transfer (req-052). */
  onTransferSaved?: (transfer: Transfer) => void;
  /** Ein entfernter Transfer (req-052). */
  onTransferRemoved?: (transfer: Transfer) => void;
  /**
   * Ein uebernommener Planvorschlag (req-056): die angelegten und
   * verschobenen Programmpunkte samt der dabei entstandenen Transfers --
   * gespeichert sind sie da bereits.
   */
  onVorschlagUebernommen?: (
    activities: Activity[],
    transfers: Transfer[],
  ) => void;
  /** Die Breite des Fensters (req-088) -- ohne sie stehen alle drei Spalten. */
  windowWidth?: number;
  /** Was neben dem Zeitstrahl steht, solange nicht alle drei Platz haben. */
  seite?: PlanungSeite;
  onSeiteChange?: (seite: PlanungSeite) => void;
}) {
  const days = tripDays(trip);
  const nebeneinander =
    windowWidth === undefined || stehenSpaltenNebeneinander(windowWidth);
  const [eigeneSeite, setEigeneSeite] = useState<PlanungSeite>(
    VORGEWAEHLTE_PLANUNG_SEITE,
  );
  const seite = seiteVonAussen ?? eigeneSeite;
  const waehleSeite = onSeiteChange ?? setEigeneSeite;
  const [selectedDate, setSelectedDate] = useState(() =>
    defaultDay(trip, today),
  );
  // Welcher POI gerade gezogen wird. Er steht hier und nicht im
  // Datentransfer des Zuges: Spalte und Zeitstrahl sind Schwestern, und der
  // Zustand ist ueberall lesbar -- der Datentransfer erst beim Loslassen.
  // Der ganze POI und nicht nur seine Kennung: der Zeitstrahl zeigt waehrend
  // des Zuges einen Umriss in der Hoehe seiner geschaetzten Dauer (req-046).
  const [draggedPoi, setDraggedPoi] = useState<Poi | null>(null);
  // Wo der Finger den gezogenen POI ueber dem Raster haelt (req-046) -- beim
  // Zug mit der Maus meldet der Zeitstrahl die Stelle selbst.
  const [poiDragOffsetPx, setPoiDragOffsetPx] = useState<number | null>(null);
  // Das Fenster "KI planen lassen" (req-056).
  const [kiDialogOffen, setKiDialogOffen] = useState(false);
  // Der Vorschlag der KI, solange er zur Ansicht steht. Er liegt hier und
  // nicht beim Aufrufer: gespeichert ist davon nichts, und ein Neuladen der
  // Seite laesst ihn verschwinden (req-056).
  const [vorschlag, setVorschlag] = useState<Planvorschlag | null>(null);
  const [uebernimmt, setUebernimmt] = useState(false);
  const [uebernahmeFehler, setUebernahmeFehler] = useState(false);
  // Wie hoch eine Stunde gerade dargestellt wird (req-076). Der Zoom steht
  // hier und nicht im Zeitstrahl: er ueberdauert damit den Wechsel des
  // Reisetages, und beide Spalten rechnen mit derselben Hoehe, seit ein POI
  // auch mit dem Finger auf dem Raster losgelassen werden kann (bug-017).
  // Gespeichert wird er nicht -- ein Neustart der App und ein Wechsel der
  // Reise setzen ihn zurueck (wie die Filter, bug-052).
  const [hourHeightPx, setHourHeightPx] = useState(ZOOM_GRUNDSTUFE_PX);
  // Das Raster, in dem Startzeit und Dauer einrasten (req-082). Es liegt wie
  // der Zoom hier und nicht im Zeitstrahl: es ueberdauert damit den Wechsel
  // des Reisetages. Gespeichert wird es nicht -- ein Neustart der App und
  // ein Wechsel der Reise setzen es zurueck (wie der Zoom, bug-052).
  const [raster, setRaster] = useState<RasterMinuten>(GRUNDRASTER_MINUTEN);
  // Ein fehlgeschlagenes Speichern der gewaehlten Alternative (bug-060) --
  // still bleiben darf das nicht.
  const [optionProblem, setOptionProblem] = useState<string | null>(null);

  // Solange ein Vorschlag steht, zeigt der Zeitstrahl ihn statt des Plans --
  // zur Ansicht, ohne Ziehen und ohne Entfernen. Die Transfers dazu gibt es
  // noch nicht: sie entstehen erst beim Uebernehmen (req-052).
  const gezeigteActivities = vorschlag
    ? vorschlagAlsActivities(vorschlag, trip.id)
    : activities;
  const gezeigteTransfers = vorschlag ? [] : transfers;

  const dayActivities = activitiesForDay(
    gezeigteActivities,
    trip.id,
    selectedDate,
  );
  // Der Stundenbereich des Tages steht hier und nicht im Zeitstrahl: beide
  // Spalten rechnen damit, seit ein POI auch mit dem Finger auf dem Raster
  // losgelassen werden kann (bug-017).
  // Der gewaehlte Zoom gehoert zum Raster (req-076): jede Stelle, die eine
  // Zeit in Pixel oder Pixel in eine Zeit umrechnet, bekommt es mit.
  const grid = {
    ...computeTimelineGrid(dayActivities, selectedDate),
    hourHeightPx,
  };
  // Die Nummern der POIs (req-074): der Zeitstrahl zeigt sie an den
  // Programmpunkten, die aus ihnen entstanden sind, und seit bug-055 die Karte
  // an ihren Wegpunkten. Gezaehlt wird dabei nichts -- die Zahl steht am POI
  // (req-013).
  const poiNummern = poiNummernNachId(pois);
  // Wie oft jeder POI schon verplant ist (req-083): ueber die ganze Reise
  // gerechnet, nicht nur ueber den gewaehlten Tag -- `gezeigteActivities`
  // fuehrt bereits alle Programmpunkte der Reise, nicht nur die des Tages.
  const planCounts = poiPlanCounts(gezeigteActivities);
  // Am Vorschlag wird nichts gezogen und nichts entfernt -- er steht zur
  // Ansicht (req-056).
  const plannable =
    Boolean(onActivityPlanned && onActivityRemoved) && !vorschlag;
  const reschedulable = Boolean(onActivityRescheduled) && !vorschlag;

  /**
   * Den Vorschlag uebernehmen (req-056): erst hier wird gespeichert, und dabei
   * entstehen auch die Transfers (req-052). Erst gespeichert, dann gezeigt --
   * was nicht geschrieben werden konnte, laesst den Vorschlag stehen.
   */
  async function uebernehmen() {
    if (!vorschlag || uebernimmt || !onVorschlagUebernommen) return;
    setUebernimmt(true);
    setUebernahmeFehler(false);

    const ergebnis = await uebernimmVorschlag(trip.id, vorschlag.punkte);
    setUebernimmt(false);
    if (!ergebnis) {
      setUebernahmeFehler(true);
      return;
    }

    onVorschlagUebernommen(ergebnis.activities, ergebnis.transfers);
    setVorschlag(null);
  }

  /** "Verwerfen" laesst den Plan unveraendert -- gespeichert war nichts. */
  function verwerfen() {
    setVorschlag(null);
    setUebernahmeFehler(false);
  }

  /**
   * Erst gespeichert, dann gezeigt: was nicht angelegt werden konnte, darf im
   * Zeitstrahl nicht liegen (req-039).
   */
  async function planPoiAt(poiId: string, startAt: string) {
    if (!onActivityPlanned) return;

    const activity = await planPoi(poiId, startAt, raster);
    if (activity) onActivityPlanned(activity);
  }

  /** Mit der Maus auf dem Raster losgelassen -- gezogen wird, was der Zug meldet. */
  async function handleDropPoi(startAt: string) {
    const poi = draggedPoi;
    beendePoiZug();
    if (!poi) return;

    await planPoiAt(poi.id, startAt);
  }

  /**
   * Mit dem Finger ueber dem Raster (req-046): der Zeitstrahl bekommt diese
   * Zeiger-Ereignisse nicht -- sie gehoeren der gezogenen Karte -- und
   * erfaehrt die Stelle deshalb von hier.
   */
  function handlePoiPointerMove(poi: Poi, target: DropTarget | null) {
    setDraggedPoi(poi);
    setPoiDragOffsetPx(target?.kind === "grid" ? target.offsetPx : null);
  }

  /** Der Zug ist vorbei -- der Umriss verschwindet (req-046). */
  function beendePoiZug() {
    setDraggedPoi(null);
    setPoiDragOffsetPx(null);
  }

  /**
   * Mit dem Finger losgelassen (bug-017): auf dem Raster entsteht dort ein
   * Programmpunkt, auf einem Tages-Reiter passiert nichts -- ein POI wird an
   * einer Uhrzeit verplant, nicht an einem Tag.
   */
  async function handlePointerDropPoi(poi: Poi, target: DropTarget) {
    if (target.kind !== "grid") return;

    await planPoiAt(
      poi.id,
      dropStartAt(selectedDate, target.offsetPx, grid, raster),
    );
  }

  /**
   * Auf eine andere Uhrzeit oder einen anderen Reisetag gezogen (req-040):
   * die Dauer bleibt gleich. Erst gespeichert, dann gezeigt -- was nicht
   * geschrieben werden konnte, bleibt liegen, wo es lag.
   */
  async function handleMoveActivity(activity: Activity, startAt: string) {
    if (!onActivityRescheduled) return;

    const moved = await moveActivity(activity.id, startAt, raster);
    if (moved) onActivityRescheduled(moved);
  }

  /** An der unteren Kante laenger oder kuerzer gezogen (req-040). */
  async function handleResizeActivity(activity: Activity, endAt: string) {
    if (!onActivityRescheduled) return;

    const resized = await resizeActivity(activity.id, endAt, raster);
    if (resized) onActivityRescheduled(resized);
  }

  /** An der oberen Kante gezogen: der Beginn wandert, das Ende bleibt (req-046). */
  async function handleResizeActivityStart(
    activity: Activity,
    startAt: string,
  ) {
    if (!onActivityRescheduled) return;

    const resized = await resizeActivityStart(activity.id, startAt, raster);
    if (resized) onActivityRescheduled(resized);
  }

  /**
   * Eine andere Alternative gewaehlt (bug-053): die Zeiten bleiben unberuehrt,
   * geschrieben wird allein die Wahl. Gezeigt wird sie sofort und gespeichert
   * danach -- dieselbe optimistische Reihenfolge wie im Begleiter (req-004,
   * siehe lib/activities/save-option-selection.ts).
   *
   * Schlaegt das Speichern fehl, kehrt die Anzeige auf die vorherige
   * Alternative zurueck und sagt es (bug-060) -- ein stiller Fehlschlag, nach
   * dem alles aussieht wie nach einem erfolgreichen Speichern, darf es nicht
   * geben (vgl. bug-021).
   */
  async function handleSelectOption(group: ActivityGroup, activityId: string) {
    if (!onOptionSelected) return;

    const vorherige =
      optionSelections[groupKey(group)] ?? group.activities[0].id;
    setOptionProblem(null);
    onOptionSelected(group, activityId);

    const ok = await saveOptionSelection(
      group.tripId,
      group.startAt,
      group.endAt,
      activityId,
    );
    if (ok) return;

    onOptionSelected(group, vorherige);
    setOptionProblem("Die Wahl konnte nicht gespeichert werden.");
  }

  async function handleRemoveActivity(activity: Activity) {
    if (!onActivityRemoved) return;

    const removed = await removeActivity(activity.id);
    if (removed) onActivityRemoved(removed);
  }

  const auswahlSpalte = (
    <UnplannedColumn
      pois={filterByPlanState(plannablePois(pois), planCounts, planFilter)}
      planCounts={planCounts}
      planFilter={planFilter}
      onPlanFilterChange={onPlanFilterChange}
      onDragStart={plannable ? setDraggedPoi : undefined}
      onDragEnd={plannable ? beendePoiZug : undefined}
      onPointerDragMove={plannable ? handlePoiPointerMove : undefined}
      onPointerDrop={plannable ? handlePointerDropPoi : undefined}
      onPointerDragEnd={plannable ? beendePoiZug : undefined}
    />
  );
  const zeitstrahl = (
    <TimelineColumn
      days={days}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      activities={dayActivities}
      transfers={gezeigteTransfers}
      grid={grid}
      optionSelections={optionSelections}
      onSelectOption={
        onOptionSelected && !vorschlag ? handleSelectOption : undefined
      }
      poiNummern={poiNummern}
      kiGesperrt={!hasAiKey}
      raster={raster}
      onRasterChange={setRaster}
      onZoomGroesser={() => setHourHeightPx(groessereStundenhoehePx)}
      onZoomKleiner={() => setHourHeightPx(kleinereStundenhoehePx)}
      onKiPlanen={
        onVorschlagUebernommen ? () => setKiDialogOffen(true) : undefined
      }
      vorschlag={
        vorschlag && {
          ohnePlatz: vorschlag.ohnePlatz,
          engeStellen: vorschlag.engeStellen,
          uebernimmt,
          fehlgeschlagen: uebernahmeFehler,
          onUebernehmen: () => void uebernehmen(),
          onVerwerfen: verwerfen,
        }
      }
      poiPreview={
        draggedPoi && {
          durationMinutes: poiDurationMinutes(draggedPoi),
          offsetPx: poiDragOffsetPx,
        }
      }
      onDropPoi={plannable ? handleDropPoi : undefined}
      onRemoveActivity={plannable ? handleRemoveActivity : undefined}
      onMoveActivity={reschedulable ? handleMoveActivity : undefined}
      onResizeActivity={reschedulable ? handleResizeActivity : undefined}
      onResizeActivityStart={
        reschedulable ? handleResizeActivityStart : undefined
      }
      onTransferSaved={onTransferSaved}
      onTransferRemoved={onTransferRemoved}
    />
  );
  const karte = (
    <DayRouteMap
      tripId={trip.id}
      days={days}
      selectedDate={selectedDate}
      mainPlace={trip.mainPlace}
      activities={dayActivities}
      transfers={gezeigteTransfers}
      optionSelections={optionSelections}
      poiNummern={poiNummern}
    />
  );

  return (
    <div className={styles.wrapper}>
      {optionProblem && (
        <p
          className={styles.optionProblem}
          role="alert"
          data-testid="option-hinweis"
        >
          {optionProblem}
        </p>
      )}
      <div className={styles.planung}>
        {nebeneinander ? (
          <>
            {auswahlSpalte}
            {zeitstrahl}
            {karte}
          </>
        ) : (
          /* Schmal (req-088): der Zeitstrahl bleibt stehen, daneben die
             gewaehlte der beiden anderen Spalten. */
          <>
            {zeitstrahl}
            <div className={styles.daneben} data-testid="planung-daneben">
              <SeitenUmschalter
                label="Neben dem Zeitstrahl"
                seiten={SEITEN}
                gewaehlt={seite}
                onWaehle={waehleSeite}
              />
              <div className={styles.danebenInhalt}>
                {seite === "auswahl" ? auswahlSpalte : karte}
              </div>
            </div>
          </>
        )}
        {kiDialogOffen && (
          <KiPlanungDialog
            tripId={trip.id}
            onVorschlag={(gefunden) => {
              setVorschlag(gefunden);
              setUebernahmeFehler(false);
              setKiDialogOffen(false);
            }}
            onClose={() => setKiDialogOffen(false)}
          />
        )}
      </div>
    </div>
  );
}
