import { entryContains, type PlanEntry } from "@/lib/transfers/timeline";
import type { PlanEintrag, Standortlage } from "./types";
import { IM_ZEITPLAN_TEXT, verzugText } from "./verzug";
import { uhrzeit } from "./zeit";

/**
 * Wo eine Linie im Zeitstrahl des Begleiters liegt (req-086), bezogen auf
 * die Eintraege, die der Zeitstrahl zeigt:
 * - `bei`  -- beim Programmpunkt (bzw. der Options-Gruppe) an `index`,
 * - `weg`  -- auf der Wegzeile an `index`,
 * - `vor`  -- direkt vor dem Programmpunkt an `index`, weil keine Wegzeile
 *             zu ihm fuehrt,
 * - `ende` -- nach dem letzten Eintrag: heute steht nichts mehr an.
 */
export type LinienStelle =
  | { art: "bei"; index: number }
  | { art: "weg"; index: number }
  | { art: "vor"; index: number }
  | { art: "ende" };

export interface ZeitstrahlLinie {
  stelle: LinienStelle;
  text: string;
}

export interface ZeitstrahlLinien {
  /** Die "Jetzt"-Linie (Soll) -- am heutigen Tag immer vorhanden. */
  jetzt: ZeitstrahlLinie;
  /**
   * Die GPS-Linie (Ist) -- nur mit geteilter Position, und nicht, wenn sie
   * an derselben Stelle laege wie die "Jetzt"-Linie: dann sagt diese
   * allein "Im Zeitplan".
   */
  gps: ZeitstrahlLinie | null;
}

/**
 * Wo die beiden Linien des heutigen Tages liegen und was an ihnen steht
 * (req-086). `eintrag` und `lage` sind dieselben, aus denen der Live-Status
 * seine Zeilen und seine Pille baut -- Linie und Pille sagen damit nie
 * Unterschiedliches.
 */
export function zeitstrahlLinien(
  entries: PlanEntry[],
  eintrag: PlanEintrag,
  lage: Standortlage,
  zeit: string,
): ZeitstrahlLinien {
  const stelle = jetztStelle(entries, eintrag);
  // Derselbe Verzug wie in der Status-Pille: er gehoert zum Programmpunkt
  // unter "Laut Plan" und entfaellt, wenn heute nichts mehr ansteht.
  const verzug = eintrag ? verzugText(lage.verzug) : null;

  // Ohne geteilte Position gibt es nur die "Jetzt"-Linie.
  const gps = lage.ort === null ? null : gpsStelle(entries, eintrag, lage);
  if (!gps) {
    return { jetzt: { stelle, text: `Jetzt · ${uhrzeit(zeit)}` }, gps: null };
  }

  // Am Ort des laufenden Programmpunkts sind Soll und Ist dieselbe Stelle.
  if (
    !gps.unterwegs &&
    stelle.art === "bei" &&
    gps.stelle.art === "bei" &&
    gps.stelle.index === stelle.index
  ) {
    return {
      jetzt: { stelle, text: `Jetzt · ${verzug ?? IM_ZEITPLAN_TEXT}` },
      gps: null,
    };
  }

  const beschriftung = gps.unterwegs ? "unterwegs" : "GPS";
  return {
    jetzt: { stelle, text: `Jetzt · ${uhrzeit(zeit)}` },
    gps: {
      stelle: gps.stelle,
      text: verzug === null ? beschriftung : `${beschriftung} · ${verzug}`,
    },
  };
}

/**
 * Wo die GPS-Linie liegt: beim heutigen Programmpunkt am Ort der Position,
 * sonst "unterwegs" auf der Wegzeile zu dem Programmpunkt, auf den sich der
 * Verzug bezieht -- dem laufenden oder dem naechsten. Steht heute nichts
 * mehr an und ist die Position an keinem Ort, gibt es keine Stelle.
 */
function gpsStelle(
  entries: PlanEntry[],
  eintrag: PlanEintrag,
  lage: Standortlage,
): { stelle: LinienStelle; unterwegs: boolean } | null {
  const amOrt = lage.beiProgrammpunkt
    ? indexDes(entries, lage.beiProgrammpunkt)
    : -1;
  if (amOrt >= 0) {
    return { stelle: { art: "bei", index: amOrt }, unterwegs: false };
  }

  const ziel = eintrag ? indexDes(entries, eintrag.activity.id) : -1;
  if (ziel < 0) return null;
  return { stelle: stelleVor(entries, ziel), unterwegs: true };
}

function jetztStelle(entries: PlanEntry[], eintrag: PlanEintrag): LinienStelle {
  if (!eintrag) return { art: "ende" };
  const index = indexDes(entries, eintrag.activity.id);
  if (index < 0) return { art: "ende" };
  return eintrag.art === "laufend"
    ? { art: "bei", index }
    : stelleVor(entries, index);
}

/** Die Wegzeile vor dem Programmpunkt an `index`, sonst direkt davor. */
function stelleVor(entries: PlanEntry[], index: number): LinienStelle {
  return entries[index - 1]?.kind === "transfer"
    ? { art: "weg", index: index - 1 }
    : { art: "vor", index };
}

/** Der Zeitstrahl-Eintrag mit diesem Programmpunkt -- Wegzeilen zaehlen nicht. */
function indexDes(entries: PlanEntry[], activityId: string): number {
  return entries.findIndex(
    (entry) => entry.kind !== "transfer" && entryContains(entry, activityId),
  );
}
