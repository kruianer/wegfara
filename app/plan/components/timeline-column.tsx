import {
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { TripDay } from "@/lib/trips/days";
import {
  groupActivities,
  groupKey,
  type ActivityGroup,
} from "@/lib/activities/groups";
import { insertTransfers, transferBetween } from "@/lib/transfers/timeline";
import {
  lueckeMinuten,
  passtInLuecke,
  zeitpuffer,
} from "@/lib/transfers/luecke";
import {
  ACTIVITY_TYPE_COLOR,
  ACTIVITY_TYPE_LABEL,
} from "@/lib/activities/type-meta";
import { formatTimeRange } from "@/lib/activities/format";
import { activityPoiNummer, formatPoiNummer } from "@/lib/pois/nummer";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { formatTransferMeta } from "@/lib/transfers/format";
import { TRANSFER_MODE_LABEL } from "@/lib/transfers/type-meta";
import {
  computeBlockLayout,
  formatGridHourLabel,
  gridHourHeightPx,
  type TimelineGrid,
} from "@/lib/plan/timeline-grid";
import {
  istGroessteStundenhoehe,
  istKleinsteStundenhoehe,
} from "@/lib/plan/timeline-zoom";
import { dropStartAt } from "@/lib/plan/plan-poi";
import { dropEndAt, sameTimeOnDay } from "@/lib/plan/move-activity";
import { timelineDragPreview } from "@/lib/plan/drag-preview";
import { assignLanes, type Lane } from "@/lib/plan/overlap";
import {
  dropGridProps,
  usePointerDrag,
  type DropTarget,
  type PointerDragHandlers,
} from "./pointer-drag";
import { DayTabs } from "./day-tabs";
import { TransferForm } from "./transfer-form";
import styles from "./timeline-column.module.css";
import bildlauf from "@/components/bildlauf.module.css";

/**
 * Was gerade am Zeitstrahl gezogen wird (req-040): der ganze Programmpunkt
 * ("move"), seine obere Kante ("resize-start", req-046) oder seine untere
 * ("resize-end"). Ein aus "Noch unverplant" gezogener POI steht hier nicht --
 * der liegt im Zustand der Planungsansicht, weil er aus der Schwesterspalte
 * kommt (req-039).
 */
type DragMode = "move" | "resize-start" | "resize-end";
type DraggedActivity = { activity: Activity; mode: DragMode };

/** Die Kante, auf der der Zeiger gerade liegt (bug-022). */
type GegriffeneKante = { activityId: string; mode: DragMode };

/**
 * Die Rahmenfarbe eines Programmpunkts, dessen Kante gegriffen ist (bug-022).
 * Sie liegt hier und nicht im Stylesheet, weil die Farbe des ungegriffenen
 * Rahmens aus dem Typ des Programmpunkts kommt und deshalb ohnehin am Element
 * gesetzt wird -- zwei Wege fuer dieselbe Eigenschaft ergaeben sonst einen
 * Wettlauf.
 */
const KANTE_GEGRIFFEN_COLOR = "var(--acc)";

/**
 * Der Hinweis am Transfer, dessen Fahrzeit nicht in die Luecke passt
 * (req-052). Angelegt wird er trotzdem, und umgeplant wird nichts von selbst
 * -- der Hinweis ist alles, was geschieht. Am Block selbst steht seit
 * req-073 statt seiner der Zeitpuffer; in der Liste hinter "Transfers"
 * bleibt er.
 */
const ZEIT_REICHT_NICHT = "Zeit reicht nicht";

/**
 * Die flachste Hoehe eines Transfer-Blocks in Pixeln (req-052): eine kurze
 * Luecke ergaebe sonst einen Strich. Der Block bleibt so flach wie moeglich,
 * damit er die benachbarten Programmpunkte nicht ueberdeckt -- in diese
 * Hoehe muss die Zeile mitsamt Zeitpuffer hineinpassen, sonst waere die Zahl
 * abgeschnitten (req-073, geprueft in timeline-column.layout.test.ts).
 */
const TRANSFER_MIN_HEIGHT_PX = 20;

/**
 * Ohne mitgegebene Nummern traegt kein Block eine (req-074). Die leere Karte
 * steht hier und nicht im Vorgabewert der Eigenschaft: eine bei jedem Rendern
 * neu angelegte waere jedes Mal eine andere.
 */
const EMPTY_POI_NUMMERN: Map<string, number> = new Map();

/**
 * Die flachste Hoehe einer Alternative innerhalb einer Options-Gruppe
 * (bug-053): eine Zeile mit Nummer und Titel, mitsamt Innenabstand und Rahmen.
 */
const OPTION_ROW_MIN_HEIGHT_PX = 20;

/** Kopfzeile der Gruppe -- dort steht, wie viele Alternativen hier liegen. */
const OPTION_GROUP_KOPF_PX = 11;

/** Innenabstand und Rahmen der Gruppe zusammen. */
const OPTION_GROUP_RAHMEN_PX = 6;

/** Der Abstand zwischen Kopfzeile und Zeilen und zwischen zwei Zeilen. */
const OPTION_GROUP_GAP_PX = 2;

/**
 * Wie flach eine Options-Gruppe gezeichnet werden darf (bug-053): jede
 * Alternative braucht ihre eigene Zeile, sonst lagen die Titel wieder
 * uebereinander -- genau das war der Fehler. Reicht die Dauer dafuer nicht,
 * wird die Gruppe hoeher gezeichnet, als sie dauert (so wie ein sehr kurzer
 * Programmpunkt, req-074); eine Gruppe, in der die Haelfte fehlt, waere
 * schlimmer.
 *
 * Die Masse stehen hier und nicht im Stylesheet, weil die Zahl der
 * Alternativen erst hier bekannt ist; dass sie zu den Regeln passen, prueft
 * timeline-column.layout.test.ts.
 */
function optionGroupMinHeightPx(alternativen: number): number {
  return (
    OPTION_GROUP_RAHMEN_PX +
    OPTION_GROUP_KOPF_PX +
    alternativen * (OPTION_GROUP_GAP_PX + OPTION_ROW_MIN_HEIGHT_PX)
  );
}

/**
 * Ein aus "Noch unverplant" gezogener POI, wie ihn die Planungsansicht meldet
 * (req-046). `offsetPx` traegt nur der Zug mit dem Finger: dessen
 * Zeiger-Ereignisse kommen bei der Schwesterspalte an, nicht hier -- beim
 * nativen Zug der Maus meldet das Raster die Stelle selbst.
 */
export interface PoiDragPreview {
  durationMinutes: number;
  offsetPx: number | null;
}

/**
 * Der Planvorschlag der KI, solange er zur Ansicht steht (req-056): der
 * Zeitstrahl zeigt ihn als Vorschlag, mit "Übernehmen" und "Verwerfen".
 * Gespeichert ist davon nichts.
 */
export interface VorschlagAnzeige {
  /** Wie viele POIs keinen Platz fanden. */
  ohnePlatz: number;
  /** Wo es eng bleibt -- je eine Zeile. */
  engeStellen: string[];
  /** Ob gerade uebernommen wird. */
  uebernimmt: boolean;
  /** Ob das Uebernehmen fehlgeschlagen ist. */
  fehlgeschlagen: boolean;
  onUebernehmen: () => void;
  onVerwerfen: () => void;
}

/**
 * Die Luecke zwischen zwei benachbarten Eintraegen des Tages (req-052): dort
 * erscheint das "+", und dort liegt der Transfer, den es oeffnet.
 */
interface Luecke {
  from: Activity;
  to: Activity;
  transfer: Transfer | null;
  topPx: number;
  heightPx: number;
}

/** Was das Transfer-Formular gerade zeigt (req-052). */
type OffenerTransfer = {
  from: Activity;
  to: Activity;
  transfer: Transfer | null;
};

function resolveGroupActivity(
  group: ActivityGroup,
  optionSelections: Record<string, string>,
): Activity {
  const selectedId =
    optionSelections[groupKey(group)] ?? group.activities[0].id;
  return (
    group.activities.find((a) => a.id === selectedId) ?? group.activities[0]
  );
}

/** Die Stelle, an der ein Block liegt: von links `lane` von `lanes` Spuren. */
function laneStyle({ lane, lanes }: Lane) {
  return {
    left: `${(lane * 100) / lanes}%`,
    width: `calc(${100 / lanes}% - 4px)`,
  };
}

/**
 * Mittlere Spalte "Zeitstrahl" der Planungsansicht (siehe req-011): Tages-
 * Reiter, eine Titelzeile mit zwei Schaltflaechen und das Stundenraster mit
 * den Programmpunkt- und Transfer-Bloecken des gewaehlten Tages. Beide
 * Schaltflaechen haben inzwischen ihre Funktion: "Transfers" klappt die
 * Transfers des Tages auf (req-052), "KI planen lassen" oeffnet die Planung
 * (req-056) und zeigt ihr Ergebnis hier als Vorschlag.
 *
 * Seit req-039 nimmt das Raster einen aus "Noch unverplant" gezogenen POI
 * entgegen und jeder Programmpunkt laesst sich wieder entfernen; seit req-040
 * laesst er sich auch auf eine andere Uhrzeit, auf den Reiter eines anderen
 * Reisetages und an seinem unteren Rand laenger oder kuerzer ziehen -- seit
 * bug-017 mit der Maus wie mit dem Finger. Seit req-046 laesst sich ebenso
 * seine obere Kante ziehen, und waehrend jedes Zuges ueber dem Raster liegt
 * dort ein Umriss mit der Uhrzeit, an der eingerastet wird. Seit bug-022
 * traegt jede der beiden Kanten einen sichtbaren Anfasser, und wer eine
 * greift, sieht das am umgefaerbten Rahmen, bevor er zieht. Ohne die
 * jeweiligen Rueckrufe bleibt es bei der reinen Anzeige.
 *
 * Seit req-074 traegt jeder Block, der aus einem POI entstanden ist, dessen
 * Nummer vor dem Titel -- ein von Hand angelegter keine.
 *
 * Seit req-076 laesst sich der Zeitstrahl zoomen: zwei Schalter in der
 * Titelzeile stellen dieselbe Stunde hoeher oder flacher dar. Welche Hoehe
 * gerade gilt, steht im Raster (`grid.hourHeightPx`) -- damit rechnen Bloecke,
 * Stundenlinien und das Umrechnen einer Zieh-Position in eine Uhrzeit mit
 * derselben Zahl. Das Einrasten auf 15 Minuten bleibt davon unberuehrt.
 *
 * Seit bug-053 ist eine Options-Gruppe (req-004) als solche zu erkennen: sie
 * steht in einem eigenen Rahmen mit der Zahl ihrer Alternativen und zeigt jede
 * davon in einer eigenen Zeile -- vorher lag dort nur die gewaehlte, und die
 * uebrigen Titel darunter. Mit `onSelectOption` laesst sich zwischen ihnen
 * wechseln, ohne die Zeiten anzufassen.
 */
export function TimelineColumn({
  days,
  selectedDate,
  onSelectDate,
  activities,
  transfers,
  grid,
  optionSelections = {},
  onSelectOption,
  poiNummern = EMPTY_POI_NUMMERN,
  poiPreview = null,
  kiGesperrt = false,
  vorschlag = null,
  onZoomGroesser,
  onZoomKleiner,
  onKiPlanen,
  onDropPoi,
  onRemoveActivity,
  onMoveActivity,
  onResizeActivity,
  onResizeActivityStart,
  onTransferSaved,
  onTransferRemoved,
}: {
  days: TripDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Programmpunkte des gewaehlten Tages (siehe lib/activities/day.ts). */
  activities: Activity[];
  /** Alle Transfers der Reise; nur die zwischen benachbarten Eintraegen des Tages werden gezeigt. */
  transfers: Transfer[];
  /** Der Stundenbereich des Tages -- er entscheidet, welche Uhrzeit eine Stelle im Raster meint. */
  grid: TimelineGrid;
  optionSelections?: Record<string, string>;
  /**
   * Eine andere Alternative einer Options-Gruppe wurde gewaehlt (bug-053) --
   * die Zeiten bleiben dabei unberuehrt. Ohne Rueckruf zeigt die Gruppe ihre
   * Alternativen, laesst die Wahl aber, wie sie ist.
   */
  onSelectOption?: (group: ActivityGroup, activityId: string) => void;
  /**
   * Die Nummern der POIs der Reise nach ihrer Kennung (req-074) -- daraus
   * traegt jeder Programmpunkt, der aus einem POI entstanden ist, dessen
   * Nummer. Wer sie nicht mitgibt, bekommt Bloecke ohne Nummer.
   */
  poiNummern?: Map<string, number>;
  /** Ein POI aus der Schwesterspalte, solange er gezogen wird (req-046). */
  poiPreview?: PoiDragPreview | null;
  /**
   * Ohne hinterlegten Zugangsschluessel ist "KI planen lassen" nicht
   * ausloesbar (req-056, req-028) -- ein Hinweis nennt den Grund.
   */
  kiGesperrt?: boolean;
  /** Der Planvorschlag, den der Zeitstrahl gerade zeigt (req-056). */
  vorschlag?: VorschlagAnzeige | null;
  /**
   * Eine Stunde hoeher darstellen (req-076) -- welche Hoehe gilt, steht im
   * Raster (`grid.hourHeightPx`); gefuehrt wird sie beim Aufrufer, damit sie
   * den Wechsel des Reisetages uebersteht. Ohne die beiden Rueckrufe zeigt der
   * Zeitstrahl keine Zoom-Schalter.
   */
  onZoomGroesser?: () => void;
  /** Eine Stunde flacher darstellen (req-076). */
  onZoomKleiner?: () => void;
  /** Oeffnet das Fenster "KI planen lassen"; ohne Rueckruf bleibt der Knopf stumm. */
  onKiPlanen?: () => void;
  /** Ein POI wurde auf dem Raster losgelassen -- mit der Zeit, an der er dort beginnt. */
  onDropPoi?: (startAt: string) => void;
  onRemoveActivity?: (activity: Activity) => void;
  /** Ein Programmpunkt wurde an eine neue Startzeit gezogen (req-040). */
  onMoveActivity?: (activity: Activity, startAt: string) => void;
  /** Der untere Rand eines Programmpunkts wurde auf ein neues Ende gezogen (req-040). */
  onResizeActivity?: (activity: Activity, endAt: string) => void;
  /** Die obere Kante wurde auf einen neuen Beginn gezogen; das Ende bleibt (req-046). */
  onResizeActivityStart?: (activity: Activity, startAt: string) => void;
  /** Ein angelegter oder geaenderter Transfer -- gespeichert ist er da bereits (req-052). */
  onTransferSaved?: (transfer: Transfer) => void;
  /** Ein entfernter Transfer (req-052). */
  onTransferRemoved?: (transfer: Transfer) => void;
}) {
  // Wer gerade gezogen wird. Der Zustand steht hier und nicht im Datentransfer
  // des Zuges: Block, Raster und Tages-Reiter gehoeren zu derselben Spalte,
  // und der Datentransfer ist erst beim Loslassen lesbar.
  const [dragged, setDragged] = useState<DraggedActivity | null>(null);
  // Wo der Zeiger gerade ueber dem Raster steht -- daraus entsteht der Umriss
  // (req-046). Null heisst: es wird nicht (mehr) ueber dem Raster gezogen.
  const [dragOffsetPx, setDragOffsetPx] = useState<number | null>(null);
  // Welche Kante gerade unter dem Zeiger liegt -- mit der Maus schwebend, mit
  // dem Finger aufgesetzt (bug-022). Daraus wird die Rahmenfarbe des
  // Programmpunkts: der Nutzer sieht, dass er die Kante hat, bevor er zieht.
  const [gegriffeneKante, setGegriffeneKante] =
    useState<GegriffeneKante | null>(null);
  // Der Transfer, der gerade angelegt oder geaendert wird (req-052).
  const [offenerTransfer, setOffenerTransfer] =
    useState<OffenerTransfer | null>(null);
  // Ob die Liste der Transfers des Tages aufgeklappt ist -- das ist die
  // Funktion des Knopfes "Transfers" (req-052).
  const [zeigtTransfers, setZeigtTransfers] = useState(false);
  const umplanbar = Boolean(onMoveActivity && onResizeActivity);
  const transferbar = Boolean(onTransferSaved && onTransferRemoved);
  const entries = insertTransfers(
    groupActivities(activities),
    transfers,
    activities,
  );
  const activityById = new Map(activities.map((a) => [a.id, a]));

  // Ueberlappende Programmpunkte teilen sich die Breite (req-039). Eine
  // Options-Gruppe zaehlt dabei als ein Block -- ihre Alternativen liegen
  // ohnehin aufeinander (req-004).
  const blockEntries = entries.filter((entry) => entry.kind !== "transfer");
  const blockActivities = blockEntries.map((entry) =>
    entry.kind === "single"
      ? entry.activity
      : resolveGroupActivity(entry.group, optionSelections),
  );
  const lanes = new Map<string, Lane>();
  assignLanes(blockActivities).forEach((lane, index) => {
    const entry = blockEntries[index];
    lanes.set(
      entry.kind === "single" ? entry.activity.id : groupKey(entry.group),
      lane,
    );
  });

  // Die Luecken zwischen zwei benachbarten Eintraegen des Tages: dort
  // erscheint beim Draufzeigen das "+" (req-052). Wo zwei Bloecke
  // aneinanderstossen oder sich ueberlappen, ist keine Luecke -- und damit
  // auch kein Platz fuer das "+"; ein dort liegender Transfer laesst sich
  // ueber seinen Block oeffnen.
  const luecken: Luecke[] = [];
  blockActivities.forEach((from, index) => {
    const to = blockActivities[index + 1];
    if (!to || to.startAt <= from.endAt) return;

    const layout = computeBlockLayout(
      { startAt: from.endAt, endAt: to.startAt },
      grid,
      selectedDate,
    );
    luecken.push({
      from,
      to,
      transfer:
        transferBetween(
          transfers,
          blockEntries[index],
          blockEntries[index + 1],
        ) ?? null,
      topPx: layout.topPx,
      heightPx: layout.heightPx,
    });
  });

  /** Die Transfers, die dieser Tag zeigt -- die Liste hinter "Transfers". */
  const tagesTransfers = entries.flatMap((entry) =>
    entry.kind === "transfer"
      ? [
          {
            transfer: entry.transfer,
            from: activityById.get(entry.transfer.fromActivityId),
            to: entry.toActivity,
          },
        ]
      : [],
  );

  /**
   * Ob die Fahrzeit in die Luecke zwischen beiden Programmpunkten passt
   * (req-052). Passt sie nicht, steht der Hinweis am Block und in der Liste
   * -- verschoben wird deshalb nichts.
   */
  function zeitReichtNicht(transfer: Transfer, from?: Activity, to?: Activity) {
    if (!from || !to) return false;
    return !passtInLuecke(lueckeMinuten(from, to), transfer.durationMin);
  }

  /** Das "+" einer Luecke: es oeffnet den vorhandenen Transfer oder legt an. */
  function oeffneTransfer(luecke: Pick<Luecke, "from" | "to" | "transfer">) {
    setOffenerTransfer({
      from: luecke.from,
      to: luecke.to,
      transfer: luecke.transfer,
    });
  }

  const hours: number[] = [];
  for (let hour = grid.startHour; hour <= grid.endHour; hour += 1) {
    hours.push(hour);
  }
  // Die Stundenhoehe des gewaehlten Zooms (req-076) -- dieselbe, mit der die
  // Bloecke gezeichnet werden und mit der eine Stelle im Raster in eine
  // Uhrzeit umgerechnet wird.
  const hourHeightPx = gridHourHeightPx(grid);
  const gridHeightPx = (grid.endHour - grid.startHour) * hourHeightPx;

  /**
   * Ein gezogener Programmpunkt wurde abgelegt -- ueber Maus oder Finger
   * derselbe Weg (bug-017). Auf dem Raster zaehlt die Stelle: der ganze
   * Programmpunkt beginnt dort, seine untere Kante endet dort (req-040), seine
   * obere beginnt dort und laesst das Ende stehen (req-046). Auf einem
   * Tages-Reiter wechselt er den Tag und behaelt Uhrzeit und Dauer -- eine
   * Kante hat dort nichts zu suchen, eine Dauer ergibt sich aus dem Raster.
   */
  function ablegen(gezogen: DraggedActivity, ziel: DropTarget) {
    if (ziel.kind === "day") {
      if (gezogen.mode !== "move" || !onMoveActivity) return;
      onMoveActivity(
        gezogen.activity,
        sameTimeOnDay(gezogen.activity, ziel.date),
      );
      return;
    }

    if (gezogen.mode === "resize-end" && onResizeActivity) {
      onResizeActivity(
        gezogen.activity,
        dropEndAt(selectedDate, ziel.offsetPx, grid),
      );
    } else if (gezogen.mode === "resize-start" && onResizeActivityStart) {
      onResizeActivityStart(
        gezogen.activity,
        dropStartAt(selectedDate, ziel.offsetPx, grid),
      );
    } else if (gezogen.mode === "move" && onMoveActivity) {
      onMoveActivity(
        gezogen.activity,
        dropStartAt(selectedDate, ziel.offsetPx, grid),
      );
    }
  }

  /** Der Umriss verschwindet -- der Zug ist vorbei (req-046). */
  function vorschauEnde() {
    setDragged(null);
    setDragOffsetPx(null);
    // Mit dem Zug ist auch die Kante wieder los (bug-022).
    setGegriffeneKante(null);
  }

  // Ziehen mit dem Finger (bug-017): der native Zug bleibt der Maus.
  const fingerZug = usePointerDrag<DraggedActivity>({
    enabled: umplanbar,
    // Beim Finger gibt es kein `dragstart`: was gezogen wird, steht erst mit
    // der ersten Bewegung fest (req-046).
    onDragMove: (gezogen, ziel) => {
      setDragged(gezogen);
      setDragOffsetPx(ziel?.kind === "grid" ? ziel.offsetPx : null);
    },
    onDrop: ablegen,
    onDragEnd: vorschauEnde,
  });

  /**
   * Derselbe Zug an einer Kante -- er bleibt dort haengen, sonst zoege der
   * Block darunter gleich mit (wie beim nativen Zug).
   */
  function kantenZug(activity: Activity, mode: DragMode): PointerDragHandlers {
    const handlers = fingerZug({ activity, mode });
    return {
      ...handlers,
      onPointerDown: (event) => {
        event.stopPropagation();
        handlers.onPointerDown(event);
      },
    };
  }

  /**
   * Was der native Zug einer Kante braucht (req-040, req-046) -- und die
   * Rueckmeldung, dass sie gegriffen ist (bug-022). Gemeldet wird sie beim
   * Schweben ebenso wie beim Aufsetzen des Fingers: mit der Maus zeigt sie
   * sich vor dem Druecken, mit dem Finger, sobald er liegt. Losgelassen wird
   * sie mit dem Zeiger -- und, falls ein Zug daraus wurde, mit dessen Ende.
   */
  function kantenZugProps(activity: Activity, mode: DragMode) {
    const handlers = kantenZug(activity, mode);
    const kante: GegriffeneKante = { activityId: activity.id, mode };
    return {
      draggable: true,
      onDragStart: (event: DragEvent<HTMLDivElement>) => {
        // Sonst zoege der Block darunter gleich mit.
        event.stopPropagation();
        event.dataTransfer?.setData("text/plain", activity.id);
        setDragged({ activity, mode });
        setGegriffeneKante(kante);
      },
      onDragEnd: vorschauEnde,
      ...handlers,
      onPointerEnter: () => setGegriffeneKante(kante),
      onPointerLeave: () => setGegriffeneKante(null),
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        setGegriffeneKante(kante);
        handlers.onPointerDown(event);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
        setGegriffeneKante(null);
        handlers.onPointerUp(event);
      },
      onPointerCancel: () => {
        setGegriffeneKante(null);
        handlers.onPointerCancel();
      },
    };
  }

  /** Der Anfasser, der die Kante sichtbar macht (bug-022). */
  function kantenAnfasser(activity: Activity, mode: DragMode) {
    const gegriffen =
      gegriffeneKante?.activityId === activity.id &&
      gegriffeneKante.mode === mode;
    return (
      <span
        className={`${styles.resizeGrip}${gegriffen ? ` ${styles.resizeGripGegriffen}` : ""}`}
        data-testid={`resize-grip-${mode === "resize-start" ? "start" : "end"}-${activity.id}`}
        aria-hidden="true"
      />
    );
  }

  /**
   * Eine Alternative innerhalb einer Options-Gruppe (bug-053): eine flache
   * Zeile mit der Nummer des POI, dem Titel und ihrem Zustand -- die gewaehlte
   * traegt "Gewählt", jede andere den Knopf, der sie waehlt. Ziehen laesst sie
   * sich wie jeder andere Programmpunkt; ihre Kanten nicht -- eine Zeile
   * teilt sich die Hoehe der Gruppe mit den anderen und ist dafuer zu flach.
   * Wer die Zeit einer Alternative aendern will, zieht sie aus der Gruppe
   * heraus und dann an ihren Kanten.
   */
  function optionZeile(
    group: ActivityGroup,
    activity: Activity,
    gewaehlt: boolean,
  ) {
    const nummer = activityPoiNummer(activity, poiNummern);
    return (
      <div
        key={activity.id}
        className={`${styles.optionZeile}${gewaehlt ? ` ${styles.optionGewaehlt}` : ""}${onMoveActivity ? ` ${styles.movable}` : ""}`}
        data-testid={`activity-block-${activity.id}`}
        style={{ borderColor: ACTIVITY_TYPE_COLOR[activity.type] }}
        draggable={Boolean(onMoveActivity)}
        onDragStart={(event) => {
          if (!onMoveActivity) return;
          event.dataTransfer?.setData("text/plain", activity.id);
          setDragged({ activity, mode: "move" });
        }}
        onDragEnd={vorschauEnde}
        {...fingerZug({ activity, mode: "move" })}
      >
        {/* Jede Alternative traegt die Nummer ihres eigenen POI (req-074) --
            eine Gruppe vereint mehrere POIs, und jeder hat seine. */}
        <p className={`${styles.activityTitle} ${styles.optionTitel}`}>
          {nummer !== null && (
            <span
              className={styles.activityNumber}
              data-testid={`activity-number-${activity.id}`}
            >
              {formatPoiNummer(nummer)}
            </span>
          )}
          <span className={styles.activityTitleText}>{activity.title}</span>
        </p>
        {gewaehlt ? (
          <span
            className={styles.optionGewaehltChip}
            data-testid={`option-gewaehlt-${activity.id}`}
          >
            ✓ Gewählt
          </span>
        ) : (
          onSelectOption && (
            <button
              type="button"
              className={styles.optionWaehlen}
              data-testid={`option-waehlen-${activity.id}`}
              aria-label={`Alternative „${activity.title}“ wählen`}
              // Sonst begaenne ein Fingertipp auf den Knopf einen Zug.
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onSelectOption(group, activity.id)}
            >
              Wählen
            </button>
          )
        )}
        {onRemoveActivity && (
          <button
            type="button"
            className={styles.optionEntfernen}
            data-testid={`remove-activity-${activity.id}`}
            aria-label={`Programmpunkt „${activity.title}“ entfernen`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onRemoveActivity(activity)}
          >
            ×
          </button>
        )}
      </div>
    );
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    if (!onDropPoi && !umplanbar) return;
    // Ohne dieses Abfangen nimmt der Browser den Zug gar nicht erst an.
    event.preventDefault();
    // Solange der Zeiger ueber dem Raster steht, folgt ihm der Umriss (req-046).
    setDragOffsetPx(offsetImRaster(event));
  }

  /** Der Zeiger hat das Raster verlassen -- dann rastet dort nichts ein. */
  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    // Zwischen Raster und den Bloecken darin wechselt der Zeiger waehrend des
    // Zuges staendig; nur ein Verlassen des Rasters selbst zaehlt, sonst
    // flackerte der Umriss ueber jedem Programmpunkt.
    const nach = event.relatedTarget;
    if (nach instanceof Node && event.currentTarget.contains(nach)) return;
    setDragOffsetPx(null);
  }

  /**
   * Die Stelle im Raster, gemessen an dessen Oberkante -- so zaehlt der Stand
   * der Bildlaufleiste bereits mit.
   */
  function offsetImRaster(event: DragEvent<HTMLDivElement>): number {
    return event.clientY - event.currentTarget.getBoundingClientRect().top;
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    if (!onDropPoi && !umplanbar) return;
    event.preventDefault();
    const ziel: DropTarget = { kind: "grid", offsetPx: offsetImRaster(event) };
    const gezogen = dragged;
    vorschauEnde();

    // Ein gezogener Programmpunkt geht vor: nur wenn keiner gezogen wird,
    // kommt ein POI aus "Noch unverplant" an (req-039).
    if (gezogen) ablegen(gezogen, ziel);
    else if (onDropPoi)
      onDropPoi(dropStartAt(selectedDate, ziel.offsetPx, grid));
  }

  /** Auf einem Tages-Reiter losgelassen (req-040). */
  function handleDropDay(date: string) {
    const gezogen = dragged;
    vorschauEnde();
    if (gezogen) ablegen(gezogen, { kind: "day", date });
  }

  /**
   * Der Umriss, der zeigt, wo eingerastet wird (req-046) -- fuer den gezogenen
   * Programmpunkt ebenso wie fuer einen POI aus der Schwesterspalte. Beim Zug
   * mit dem Finger meldet die Planungsansicht dessen Stelle, beim nativen Zug
   * der Maus das Raster selbst.
   */
  const vorschauOffsetPx = poiPreview?.offsetPx ?? dragOffsetPx;
  const vorschau =
    vorschauOffsetPx === null
      ? null
      : dragged
        ? timelineDragPreview(
            { kind: dragged.mode, activity: dragged.activity },
            selectedDate,
            vorschauOffsetPx,
            grid,
          )
        : poiPreview
          ? timelineDragPreview(
              { kind: "poi", durationMinutes: poiPreview.durationMinutes },
              selectedDate,
              vorschauOffsetPx,
              grid,
            )
          : null;

  return (
    <div className={styles.column}>
      <DayTabs
        days={days}
        selectedDate={selectedDate}
        onSelect={onSelectDate}
        onDropDay={umplanbar ? handleDropDay : undefined}
      />
      <div className={styles.titleRow}>
        {/* Der Knopf aus req-011 hat seit req-056 seine Funktion. Ohne
            Zugangsschluessel des Accounts ist er nicht ausloesbar (req-028);
            der Grund steht darunter. */}
        <button
          type="button"
          className={styles.aiButton}
          disabled={kiGesperrt || !onKiPlanen || Boolean(vorschlag)}
          onClick={onKiPlanen}
        >
          KI planen lassen
        </button>
        <button
          type="button"
          className={styles.transfersButton}
          aria-expanded={zeigtTransfers}
          onClick={() => setZeigtTransfers((offen) => !offen)}
        >
          Transfers
        </button>
        {/* Der Zoom (req-076): zwei Schalter, mit denen dieselbe Stunde hoeher
            oder flacher dargestellt wird. Sie stehen in der Titelzeile und
            haengen an keiner Media Query -- bei jeder Bildschirmbreite
            dieselbe Stelle und dieselbe Trefferflaeche (stack.md). Angeklickt
            wie angetippt loesen sie denselben Rueckruf aus; auf der hoechsten
            bzw. flachsten Stufe bleiben sie stumm. */}
        {(onZoomGroesser || onZoomKleiner) && (
          <div
            className={styles.zoomGruppe}
            role="group"
            aria-label="Zoom des Zeitstrahls"
          >
            <button
              type="button"
              className={styles.zoomButton}
              data-testid="zoom-kleiner"
              aria-label="Zeitstrahl verkleinern"
              title="Zeitstrahl verkleinern — mehr Stunden auf einen Blick"
              disabled={!onZoomKleiner || istKleinsteStundenhoehe(hourHeightPx)}
              onClick={onZoomKleiner}
            >
              −
            </button>
            <button
              type="button"
              className={styles.zoomButton}
              data-testid="zoom-groesser"
              aria-label="Zeitstrahl vergrößern"
              title="Zeitstrahl vergrößern — eine Viertelstunde bekommt mehr Platz"
              disabled={
                !onZoomGroesser || istGroessteStundenhoehe(hourHeightPx)
              }
              onClick={onZoomGroesser}
            >
              +
            </button>
          </div>
        )}
      </div>
      {/* Der fehlende Schluessel steht als Grund am gesperrten Knopf --
          beheben laesst er sich nur in "Mein Bereich" (req-028). */}
      {kiGesperrt && (
        <p className={styles.kiHinweis} data-testid="ki-kein-schluessel">
          {apiKeyMissingHint("ki_suche")}
        </p>
      )}
      {/* Der Vorschlag steht zur Ansicht: erkennbar als Vorschlag, mit
          "Übernehmen" und "Verwerfen" (req-056). Gespeichert ist davon
          nichts -- ein Neuladen der Seite laesst ihn verschwinden. */}
      {vorschlag && (
        <div className={styles.vorschlagBanner} data-testid="vorschlag-banner">
          <p className={styles.vorschlagTitel}>
            Vorschlag der KI — noch nicht gespeichert.
          </p>
          {vorschlag.ohnePlatz > 0 && (
            <p
              className={styles.vorschlagHinweis}
              data-testid="vorschlag-ohne-platz"
            >
              {vorschlag.ohnePlatz === 1
                ? "1 POI fand keinen Platz und bleibt in „Noch unverplant“."
                : `${vorschlag.ohnePlatz} POIs fanden keinen Platz und bleiben in „Noch unverplant“.`}
            </p>
          )}
          {vorschlag.engeStellen.map((stelle) => (
            <p key={stelle} className={styles.vorschlagHinweis}>
              {stelle}
            </p>
          ))}
          {vorschlag.fehlgeschlagen && (
            <p
              className={styles.vorschlagFehler}
              role="alert"
              data-testid="vorschlag-fehler"
            >
              Der Vorschlag konnte nicht übernommen werden. Der Plan ist
              unverändert.
            </p>
          )}
          <div className={styles.vorschlagAktionen}>
            <button
              type="button"
              className={styles.transfersButton}
              onClick={vorschlag.onVerwerfen}
            >
              Verwerfen
            </button>
            <button
              type="button"
              className={styles.aiButton}
              disabled={vorschlag.uebernimmt}
              onClick={vorschlag.onUebernehmen}
            >
              {vorschlag.uebernimmt ? "Übernimmt…" : "Übernehmen"}
            </button>
          </div>
        </div>
      )}
      {/* Alle Transfers des gewaehlten Tages (req-052) -- damit bekommt der
          Knopf aus req-011 seine Funktion. */}
      {zeigtTransfers && (
        <div className={styles.transferList} data-testid="transfer-list">
          {tagesTransfers.length === 0 ? (
            <p className={styles.transferListEmpty}>
              An diesem Reisetag ist kein Transfer hinterlegt.
            </p>
          ) : (
            <ul className={styles.transferListItems}>
              {tagesTransfers.map(({ transfer, from, to }) => (
                <li key={transfer.id} className={styles.transferListItem}>
                  <span className={styles.transferListTitle}>
                    {transfer.title}
                  </span>
                  <span className={styles.transferListMeta}>
                    {TRANSFER_MODE_LABEL[transfer.mode]} ·{" "}
                    {formatTransferMeta(transfer)}
                  </span>
                  {zeitReichtNicht(transfer, from, to) && (
                    <span className={styles.transferWarnung}>
                      {ZEIT_REICHT_NICHT}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className={`${styles.scroll} ${bildlauf.bildlauf}`}>
        <div
          className={styles.grid}
          style={{ height: gridHeightPx }}
          data-testid="timeline-grid"
          {...dropGridProps}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className={styles.hourLine}
              style={{ top: (hour - grid.startHour) * hourHeightPx }}
            >
              <span className={styles.hourLabel}>
                {formatGridHourLabel(hour)}
              </span>
            </div>
          ))}

          <div className={styles.blocks}>
            {entries.map((entry) => {
              if (entry.kind === "transfer") {
                const fromActivity = activityById.get(
                  entry.transfer.fromActivityId,
                );
                if (!fromActivity) return null;
                const layout = computeBlockLayout(
                  {
                    startAt: fromActivity.endAt,
                    endAt: entry.toActivity.startAt,
                  },
                  grid,
                  selectedDate,
                );
                // Der Zeitpuffer steht immer am Block (req-073) -- das
                // Vorzeichen sagt, ob Zeit uebrig ist oder fehlt, und mit
                // ihm faellt der frueher danebenstehende Warnsatz weg.
                const puffer = zeitpuffer(
                  lueckeMinuten(fromActivity, entry.toActivity),
                  entry.transfer.durationMin,
                );
                const knapp = !puffer.passt;
                const beschriftung = `${entry.transfer.title} · ${formatTransferMeta(entry.transfer)}`;
                const transferProps = {
                  className: `${styles.transferBlock}${knapp ? ` ${styles.transferBlockKnapp}` : ""}`,
                  "data-testid": `transfer-block-${entry.transfer.id}`,
                  style: {
                    top: layout.topPx,
                    height: Math.max(layout.heightPx, TRANSFER_MIN_HEIGHT_PX),
                  },
                };
                const inhalt = (
                  <>
                    <span className={styles.transferBeschriftung}>
                      {beschriftung}
                    </span>
                    <span
                      className={`${styles.zeitpuffer} ${
                        puffer.passt
                          ? styles.zeitpufferPos
                          : styles.zeitpufferNeg
                      }`}
                      data-testid={`transfer-puffer-${entry.transfer.id}`}
                    >
                      {puffer.text}
                    </span>
                  </>
                );

                // Ohne die Rueckrufe bleibt es bei der reinen Anzeige --
                // dann ist der Block kein Knopf (req-052).
                return transferbar ? (
                  <button
                    key={entry.transfer.id}
                    type="button"
                    {...transferProps}
                    aria-label={`Transfer „${entry.transfer.title}“ ändern`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() =>
                      oeffneTransfer({
                        from: fromActivity,
                        to: entry.toActivity,
                        transfer: entry.transfer,
                      })
                    }
                  >
                    {inhalt}
                  </button>
                ) : (
                  <div key={entry.transfer.id} {...transferProps}>
                    {inhalt}
                  </div>
                );
              }

              // Eine Options-Gruppe steht in einem eigenen Rahmen und zeigt
              // jede ihrer Alternativen (bug-053) -- nicht mehr nur die
              // gewaehlte, unter der die uebrigen Titel lagen.
              if (entry.kind === "group") {
                const gruppe = entry.group;
                const key = groupKey(gruppe);
                const layout = computeBlockLayout(gruppe, grid, selectedDate);
                const lane = lanes.get(key) ?? { lane: 0, lanes: 1 };
                const gewaehlt = resolveGroupActivity(gruppe, optionSelections);
                const kopf = `${gruppe.activities.length} Optionen · ${formatTimeRange(gruppe)}`;

                return (
                  <div
                    key={key}
                    className={styles.optionGroup}
                    data-testid={`option-group-${key}`}
                    role="group"
                    aria-label={kopf}
                    style={{
                      top: layout.topPx,
                      height: layout.heightPx,
                      minHeight: optionGroupMinHeightPx(
                        gruppe.activities.length,
                      ),
                      ...laneStyle(lane),
                    }}
                  >
                    {/* Wie viele Alternativen hier liegen und fuer welchen
                        Zeitraum -- dieselbe Auskunft wie im Begleiter
                        (req-004). */}
                    <p className={styles.optionGroupKopf}>{kopf}</p>
                    {gruppe.activities.map((alternative) =>
                      optionZeile(
                        gruppe,
                        alternative,
                        alternative.id === gewaehlt.id,
                      ),
                    )}
                  </div>
                );
              }

              const activity = entry.activity;
              const key = entry.activity.id;
              const layout = computeBlockLayout(activity, grid, selectedDate);
              const lane = lanes.get(key) ?? { lane: 0, lanes: 1 };
              // Eine seiner Kanten liegt unter dem Zeiger (bug-022).
              const kanteGegriffen =
                gegriffeneKante?.activityId === activity.id;
              // Die Nummer des POI, aus dem er entstanden ist (req-074) --
              // null bei einem von Hand angelegten Programmpunkt.
              const nummer = activityPoiNummer(activity, poiNummern);

              return (
                <div
                  key={key}
                  className={`${styles.activityBlock}${onMoveActivity ? ` ${styles.movable}` : ""}${kanteGegriffen ? ` ${styles.kanteGegriffen}` : ""}`}
                  data-testid={`activity-block-${activity.id}`}
                  style={{
                    top: layout.topPx,
                    height: layout.heightPx,
                    borderColor: kanteGegriffen
                      ? KANTE_GEGRIFFEN_COLOR
                      : ACTIVITY_TYPE_COLOR[activity.type],
                    ...laneStyle(lane),
                  }}
                  draggable={Boolean(onMoveActivity)}
                  onDragStart={(event) => {
                    if (!onMoveActivity) return;
                    // Manche Browser starten einen Zug nur mit gesetzten Daten.
                    event.dataTransfer?.setData("text/plain", activity.id);
                    setDragged({ activity, mode: "move" });
                  }}
                  onDragEnd={vorschauEnde}
                  {...fingerZug({ activity, mode: "move" })}
                >
                  {/* Die Nummer des POI steht vor dem Titel (req-074) --
                      dieselbe, die auf dem Kartenmarker und in der POI-Liste
                      steht. Ein von Hand angelegter Programmpunkt traegt
                      keine und auch keinen Platzhalter an ihrer Stelle. */}
                  <p className={styles.activityTitle}>
                    {nummer !== null && (
                      <span
                        className={styles.activityNumber}
                        data-testid={`activity-number-${activity.id}`}
                      >
                        {formatPoiNummer(nummer)}
                      </span>
                    )}
                    <span className={styles.activityTitleText}>
                      {activity.title}
                    </span>
                  </p>
                  <p className={styles.activityMeta}>
                    {formatTimeRange(activity)} ·{" "}
                    {ACTIVITY_TYPE_LABEL[activity.type]}
                  </p>
                  {onResizeActivityStart && (
                    <div
                      className={`${styles.resizeHandle} ${styles.resizeHandleTop}`}
                      data-testid={`resize-activity-start-${activity.id}`}
                      title={`Beginn von „${activity.title}“ ziehen`}
                      {...kantenZugProps(activity, "resize-start")}
                    >
                      {kantenAnfasser(activity, "resize-start")}
                    </div>
                  )}
                  {onResizeActivity && (
                    <div
                      className={`${styles.resizeHandle} ${styles.resizeHandleBottom}`}
                      data-testid={`resize-activity-${activity.id}`}
                      title={`Ende von „${activity.title}“ ziehen`}
                      {...kantenZugProps(activity, "resize-end")}
                    >
                      {kantenAnfasser(activity, "resize-end")}
                    </div>
                  )}
                  {/* Nach den Kanten und damit ueber ihnen: die obere Kante
                      liegt sonst auf dem Kreuz, und es liesse sich nicht mehr
                      treffen (req-039). */}
                  {onRemoveActivity && (
                    <button
                      type="button"
                      className={styles.removeButton}
                      data-testid={`remove-activity-${activity.id}`}
                      aria-label={`Programmpunkt „${activity.title}“ entfernen`}
                      // Sonst begaenne ein Fingertipp auf das Kreuz einen Zug.
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => onRemoveActivity(activity)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {/* Das "+" in der Luecke zwischen zwei Programmpunkten (req-052).
                Es liegt ueber den Bloecken, aber unter dem Umriss, und
                erscheint erst, wenn der Zeiger auf der Luecke steht (siehe
                timeline-column.module.css). Waehrend eines Zuges ist es
                stumm -- sonst faenge ein Loslassen darauf nichts an. */}
            {transferbar &&
              luecken.map((luecke) => (
                <div
                  key={`luecke-${luecke.from.id}-${luecke.to.id}`}
                  className={`${styles.luecke}${dragged || poiPreview ? ` ${styles.lueckeStumm}` : ""}`}
                  style={{ top: luecke.topPx, height: luecke.heightPx }}
                >
                  <button
                    type="button"
                    className={styles.addTransfer}
                    data-testid={`add-transfer-${luecke.from.id}-${luecke.to.id}`}
                    aria-label={
                      luecke.transfer
                        ? `Transfer zwischen „${luecke.from.title}“ und „${luecke.to.title}“ ändern`
                        : `Transfer zwischen „${luecke.from.title}“ und „${luecke.to.title}“ anlegen`
                    }
                    // Sonst begaenne ein Fingertipp auf das "+" einen Zug.
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => oeffneTransfer(luecke)}
                  >
                    +
                  </button>
                </div>
              ))}

            {/* Zuletzt und damit ueber den Bloecken: der Umriss soll auch
                sichtbar bleiben, wenn dort schon ein Programmpunkt liegt
                (Ueberlappungen sind erlaubt, req-039). */}
            {vorschau && (
              <div
                className={styles.previewBlock}
                data-testid="drag-preview"
                aria-hidden="true"
                style={{ top: vorschau.topPx, height: vorschau.heightPx }}
              >
                <span className={styles.previewTime}>{vorschau.label}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {offenerTransfer && onTransferSaved && onTransferRemoved && (
        <TransferForm
          fromActivity={offenerTransfer.from}
          toActivity={offenerTransfer.to}
          transfer={offenerTransfer.transfer}
          onSaved={(gespeichert) => {
            onTransferSaved(gespeichert);
            setOffenerTransfer(null);
          }}
          onRemoved={(entfernt) => {
            onTransferRemoved(entfernt);
            setOffenerTransfer(null);
          }}
          onCancel={() => setOffenerTransfer(null)}
        />
      )}
    </div>
  );
}
