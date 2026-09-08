import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Ziehen mit dem Finger (bug-017): Der native Zug des Browsers (`draggable`
 * und `dragstart`) kommt auf dem iPad nicht zustande -- Safari startet ihn
 * mit dem Finger nicht. Hier wird derselbe Zug aus Zeiger-Ereignissen
 * nachgebildet, die auf jedem Geraet ankommen: druecken, ziehen, loslassen.
 * Wo losgelassen wurde, entscheidet die Ablageflaeche unter dem Zeiger.
 *
 * Die Maus bleibt beim nativen Zug: dort funktioniert er, er rollt die
 * Ansicht am Rand von selbst mit, und beide Wege gleichzeitig wuerden
 * dasselbe Loslassen zweimal auswerten.
 *
 * Gegriffen wird seit bug-023, indem der Finger kurz liegen bleibt: dann
 * meldet `onGrab`, was gegriffen ist -- die Karte zeigt es an -- und von da an
 * gehoert die ganze Bewegung dem Zug, in jede Richtung. Vorher rollt die
 * Liste weiter wie gewohnt.
 */

/** Kennzeichnung des Stundenrasters als Ablageflaeche. */
const DROP_GRID_ATTR = "data-drop-grid";

/** Kennzeichnung eines Tages-Reiters als Ablageflaeche; sein Wert ist das Datum. */
const DROP_DAY_ATTR = "data-drop-day";

/** Macht das Stundenraster des Zeitstrahls zur Ablageflaeche (req-039). */
export const dropGridProps = { [DROP_GRID_ATTR]: "" };

/** Macht den Reiter eines Reisetages zur Ablageflaeche (req-040). */
export function dropDayProps(date: string) {
  return { [DROP_DAY_ATTR]: date };
}

/** Wo ein gezogener POI oder Programmpunkt losgelassen wurde. */
export type DropTarget =
  | { kind: "grid"; offsetPx: number }
  | { kind: "day"; date: string };

/** Erst ab dieser Strecke ist es ein Zug und kein Tippen. */
const DRAG_THRESHOLD_PX = 8;

/**
 * So lange muss der Finger liegen bleiben, bis gegriffen ist (bug-023) --
 * lang genug, um es von einem Wisch ueber die Liste zu unterscheiden, kurz
 * genug, um sich wie ein Aufheben und kein Warten anzufuehlen.
 */
const HALTEZEIT_MS = 250;

/**
 * Sperrt das Rollen, solange gezogen wird (bug-023). Ohne diese Sperre gehoert
 * eine Bewegung nach unten dem Browser (`touch-action: pan-y` an der Karte):
 * er rollt die Liste und bricht den Zug ab. Man muesste den POI erst zur Seite
 * -- also auf die Tagesansicht -- ziehen und koennte erst danach die Uhrzeit
 * ansteuern. Gesperrt wird erst ab dem Greifen, damit sich die Liste vorher
 * weiterhin mit dem Finger rollen laesst.
 *
 * Das Rollen laesst sich nur so abwenden: React haengt `touchmove` passiv
 * ein, und `touch-action` an der Karte wirkt nicht mehr, sobald die Geste
 * laeuft.
 */
function sperreRollen(event: Event) {
  if (event.cancelable) event.preventDefault();
}

/**
 * Die Ablageflaeche unter einer Stelle des Bildschirms -- null, wenn dort
 * keine liegt. Das Raster meldet zugleich den Abstand von seiner Oberkante,
 * gemessen wie beim nativen Zug (siehe timeline-column.tsx), damit beide
 * Wege dieselbe Uhrzeit ergeben.
 *
 * Gesucht wird ueber das Dokument und nicht ueber das Ziel des Ereignisses:
 * sobald der Zeiger dem gezogenen Element gehoert, kommen alle Ereignisse
 * dort an, egal wo der Finger gerade ist.
 */
export function dropTargetAtPoint(x: number, y: number): DropTarget | null {
  const unterZeiger = document.elementFromPoint(x, y);

  const reiter = unterZeiger?.closest(`[${DROP_DAY_ATTR}]`);
  const datum = reiter?.getAttribute(DROP_DAY_ATTR);
  if (datum) return { kind: "day", date: datum };

  const raster = unterZeiger?.closest(`[${DROP_GRID_ATTR}]`);
  if (raster) {
    return { kind: "grid", offsetPx: y - raster.getBoundingClientRect().top };
  }

  return null;
}

/** Was ein Element braucht, um sich mit dem Finger ziehen zu lassen. */
export interface PointerDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
}

interface Zug<T> {
  pointerId: number;
  item: T;
  element: HTMLElement;
  startX: number;
  startY: number;
  gestartet: boolean;
}

/**
 * Liefert die Ereignis-Behandlung, mit der sich ein Element mit dem Finger
 * ziehen laesst. `onDrop` bekommt, was gezogen wurde, und die Ablageflaeche,
 * auf der es losgelassen wurde -- losgelassen ausserhalb einer solchen,
 * passiert nichts. Ohne `enabled` bleibt es bei der reinen Anzeige.
 *
 * `onGrab` meldet, was gegriffen ist, und null, sobald es wieder los ist
 * (bug-023) -- daraus entsteht die Rueckmeldung am Element selbst. Gegriffen
 * ist es, sobald der Finger die Haltezeit liegen geblieben ist oder sich weit
 * genug bewegt hat, um kein Tippen mehr zu sein.
 *
 * `onDragMove` meldet waehrend des Zuges, wo der Finger gerade steht -- daraus
 * entsteht die Vorschau (req-046); `onDragEnd` meldet sein Ende, gleich ob
 * abgelegt oder abgebrochen, damit sie wieder verschwindet. Beim nativen Zug
 * der Maus leisten das `dragover` und `dragend` des Browsers.
 */
export function usePointerDrag<T>({
  enabled = true,
  onGrab,
  onDragMove,
  onDrop,
  onDragEnd,
}: {
  enabled?: boolean;
  onGrab?: (item: T | null) => void;
  onDragMove?: (item: T, target: DropTarget | null) => void;
  onDrop: (item: T, target: DropTarget) => void;
  onDragEnd?: () => void;
}): (item: T) => PointerDragHandlers {
  // Der laufende Zug steht in einer Referenz und nicht im Zustand: er aendert
  // sich mit jedem Zeigerschritt, und neu gezeichnet werden muss dafuer
  // nichts.
  const zug = useRef<Zug<T> | null>(null);
  const halteUhr = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stoppeHalten() {
    if (halteUhr.current === null) return;
    clearTimeout(halteUhr.current);
    halteUhr.current = null;
  }

  /**
   * Gegriffen (bug-023): der Zeiger gehoert ab hier dem gezogenen Element,
   * auch wenn der Finger es laengst verlassen hat (jsdom kennt das nicht),
   * die Bewegung rollt nichts mehr, und das Element zeigt sich als gegriffen.
   */
  function greife(laufend: Zug<T>) {
    stoppeHalten();
    if (laufend.gestartet) return;

    laufend.gestartet = true;
    laufend.element.setPointerCapture?.(laufend.pointerId);
    document.addEventListener("touchmove", sperreRollen, { passive: false });
    onGrab?.(laufend.item);
  }

  /** Der Zug ist vorbei -- Haltezeit und Rollsperre gelten nicht mehr. */
  function loesen() {
    stoppeHalten();
    document.removeEventListener("touchmove", sperreRollen);
  }

  // Verschwindet das Element mitten im Zug, bleibt sonst die Rollsperre
  // stehen und die Seite liesse sich nicht mehr bewegen.
  useEffect(
    () => () => {
      if (halteUhr.current !== null) clearTimeout(halteUhr.current);
      document.removeEventListener("touchmove", sperreRollen);
    },
    [],
  );

  return function handlersFuer(item: T): PointerDragHandlers {
    return {
      onPointerDown(event) {
        if (!enabled || event.pointerType === "mouse") return;
        const laufend: Zug<T> = {
          pointerId: event.pointerId,
          item,
          // Das Element und nicht das Ereignis: React gibt `currentTarget`
          // nach der Behandlung wieder her.
          element: event.currentTarget,
          startX: event.clientX,
          startY: event.clientY,
          gestartet: false,
        };
        zug.current = laufend;

        // Bleibt der Finger liegen, ist gegriffen -- ohne dass sich schon
        // etwas bewegt haben muesste (bug-023).
        stoppeHalten();
        halteUhr.current = setTimeout(() => {
          if (zug.current === laufend) greife(laufend);
        }, HALTEZEIT_MS);
      },
      onPointerMove(event) {
        const laufend = zug.current;
        if (!laufend || laufend.pointerId !== event.pointerId) return;

        if (!laufend.gestartet) {
          const strecke = Math.hypot(
            event.clientX - laufend.startX,
            event.clientY - laufend.startY,
          );
          // Ein Tippen ist noch kein Zug -- sonst verschoebe jede Beruehrung.
          if (strecke < DRAG_THRESHOLD_PX) return;

          greife(laufend);
        }

        onDragMove?.(
          laufend.item,
          dropTargetAtPoint(event.clientX, event.clientY),
        );
      },
      onPointerUp(event) {
        const laufend = zug.current;
        zug.current = null;
        loesen();
        if (
          !laufend ||
          laufend.pointerId !== event.pointerId ||
          !laufend.gestartet
        ) {
          return;
        }

        const ziel = dropTargetAtPoint(event.clientX, event.clientY);
        if (ziel) onDrop(laufend.item, ziel);
        onGrab?.(null);
        onDragEnd?.();
      },
      onPointerCancel() {
        // Der Browser hat den Zug an sich genommen, etwa um die Spalte zu
        // rollen. Dann ist nichts gezogen worden.
        const laufend = zug.current;
        zug.current = null;
        loesen();
        if (laufend?.gestartet) {
          onGrab?.(null);
          onDragEnd?.();
        }
      },
    };
  };
}
