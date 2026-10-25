import { entryContains, type PlanEntry } from "@/lib/transfers/timeline";
import type { PlanEintrag, Standortlage } from "./types";
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
  _lage: Standortlage,
  zeit: string,
): ZeitstrahlLinien {
  const jetzt: ZeitstrahlLinie = {
    stelle: jetztStelle(entries, eintrag),
    text: `Jetzt · ${uhrzeit(zeit)}`,
  };

  return { jetzt, gps: null };
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
