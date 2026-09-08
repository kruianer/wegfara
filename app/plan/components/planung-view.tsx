"use client";

import { useState } from "react";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
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
import { unplannedPois } from "@/lib/pois/unplanned";
import { poiDurationMinutes } from "@/lib/pois/estimated-duration";
import { computeTimelineGrid } from "@/lib/plan/timeline-grid";
import { dropStartAt } from "@/lib/plan/plan-poi";
import {
  vorschlagAlsActivities,
  type Planvorschlag,
} from "@/lib/plan/ki-planung";
import { uebernimmVorschlag } from "@/lib/plan/run-ki-planung";
import type { DropTarget } from "./pointer-drag";
import { UnplannedColumn } from "./unplanned-column";
import { TimelineColumn } from "./timeline-column";
import { KiPlanungDialog } from "./ki-planung-dialog";
import { DayRouteMap } from "./day-route-map";
import styles from "./planung-view.module.css";

/**
 * Der Bereich "Planung" des Planers (siehe req-011): drei Spalten
 * nebeneinander -- noch unverplante POIs, Zeitstrahl des gewaehlten
 * Reisetages und dessen Karte.
 *
 * Seit req-039 wird hier auch geplant: ein POI laesst sich aus "Noch
 * unverplant" auf den Zeitstrahl ziehen, und ein Programmpunkt laesst sich
 * wieder entfernen. Seit req-040 laesst er sich ausserdem umplanen -- auf eine
 * andere Uhrzeit, auf einen anderen Reisetag oder auf eine andere Dauer, seit
 * req-046 an beiden Kanten. Seit bug-017 geht beides mit der Maus wie mit dem
 * Finger (siehe pointer-drag.ts). Seit req-052 laesst sich ausserdem zwischen
 * zwei aufeinanderfolgenden Programmpunkten ein Transfer anlegen, aendern und
 * entfernen; die Liste der Transfers fuehrt wie die der Programmpunkte der
 * Aufrufer. Alles
 * ist sofort gespeichert; die Liste der Programmpunkte fuehrt der Aufrufer,
 * damit sie den Bereichswechsel uebersteht. Ohne die jeweiligen Rueckrufe
 * bleibt es bei der reinen Anzeige.
 */
export function PlanungView({
  trip,
  pois,
  activities,
  transfers,
  today,
  optionSelections = {},
  hasAiKey = false,
  onActivityPlanned,
  onActivityRemoved,
  onActivityRescheduled,
  onTransferSaved,
  onTransferRemoved,
  onVorschlagUebernommen,
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
  onActivityPlanned?: (activity: Activity) => void;
  onActivityRemoved?: (activity: Activity) => void;
  /** Ein verschobener oder in seiner Dauer geaenderter Programmpunkt (req-040). */
  onActivityRescheduled?: (activity: Activity) => void;
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
}) {
  const days = tripDays(trip);
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
  const grid = computeTimelineGrid(dayActivities, selectedDate);
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

    const activity = await planPoi(poiId, startAt);
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

    await planPoiAt(poi.id, dropStartAt(selectedDate, target.offsetPx, grid));
  }

  /**
   * Auf eine andere Uhrzeit oder einen anderen Reisetag gezogen (req-040):
   * die Dauer bleibt gleich. Erst gespeichert, dann gezeigt -- was nicht
   * geschrieben werden konnte, bleibt liegen, wo es lag.
   */
  async function handleMoveActivity(activity: Activity, startAt: string) {
    if (!onActivityRescheduled) return;

    const moved = await moveActivity(activity.id, startAt);
    if (moved) onActivityRescheduled(moved);
  }

  /** An der unteren Kante laenger oder kuerzer gezogen (req-040). */
  async function handleResizeActivity(activity: Activity, endAt: string) {
    if (!onActivityRescheduled) return;

    const resized = await resizeActivity(activity.id, endAt);
    if (resized) onActivityRescheduled(resized);
  }

  /** An der oberen Kante gezogen: der Beginn wandert, das Ende bleibt (req-046). */
  async function handleResizeActivityStart(
    activity: Activity,
    startAt: string,
  ) {
    if (!onActivityRescheduled) return;

    const resized = await resizeActivityStart(activity.id, startAt);
    if (resized) onActivityRescheduled(resized);
  }

  async function handleRemoveActivity(activity: Activity) {
    if (!onActivityRemoved) return;

    const removed = await removeActivity(activity.id);
    if (removed) onActivityRemoved(removed);
  }

  return (
    <div className={styles.planung}>
      <UnplannedColumn
        pois={unplannedPois(pois, gezeigteActivities)}
        onDragStart={plannable ? setDraggedPoi : undefined}
        onDragEnd={plannable ? beendePoiZug : undefined}
        onPointerDragMove={plannable ? handlePoiPointerMove : undefined}
        onPointerDrop={plannable ? handlePointerDropPoi : undefined}
        onPointerDragEnd={plannable ? beendePoiZug : undefined}
      />
      <TimelineColumn
        days={days}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        activities={dayActivities}
        transfers={gezeigteTransfers}
        grid={grid}
        optionSelections={optionSelections}
        kiGesperrt={!hasAiKey}
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
      <DayRouteMap
        days={days}
        selectedDate={selectedDate}
        mainPlace={trip.mainPlace}
        activities={dayActivities}
        transfers={gezeigteTransfers}
        optionSelections={optionSelections}
      />
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
  );
}
