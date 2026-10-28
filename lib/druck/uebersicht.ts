import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import type { Transfer } from "../transfers/types";
import { uebersichtsKarte } from "./karte";
import { tagesfarbe } from "./tagesfarben";
import { anzahlInWorten } from "./text";
import type { DruckTag, DruckUebersicht } from "./types";

/**
 * Seite 2 des gedruckten Reiseplans (req-103): die Reise im Ueberblick --
 * oben die Karte der ganzen Reise, darunter je Reisetag eine Zeile und drei
 * Zahlen.
 */

/**
 * Die Gegenden, in denen die Stationen liegen (req-095) -- in der Reihenfolge,
 * in der die Reise sie erreicht.
 */
export function gegendenDerReise(tage: DruckTag[], pois: Poi[]): string[] {
  const poiById = new Map(pois.map((poi) => [poi.id, poi]));
  return [
    ...new Set(
      tage.flatMap((tag) =>
        tag.stationen.flatMap((station) => {
          const gegend = station.poiId
            ? poiById.get(station.poiId)?.gegend
            : null;
          return gegend ? [gegend] : [];
        }),
      ),
    ),
  ];
}

/** Die Ueberschrift der Seite, z.B. "Sechs Tage, drei Gegenden". */
export function uebersichtTitel(tage: number, gegenden: number): string {
  const dauer = anzahlInWorten(tage, "Tag", "Tage");
  return gegenden >= 2
    ? `${dauer}, ${anzahlInWorten(gegenden, "Gegend", "Gegenden").toLowerCase()}`
    : dauer;
}

export function druckUebersicht({
  tage,
  activities,
  transfers,
  pois,
}: {
  tage: DruckTag[];
  activities: Activity[];
  transfers: Transfer[];
  pois: Poi[];
}): DruckUebersicht {
  return {
    titel: uebersichtTitel(tage.length, gegendenDerReise(tage, pois).length),
    karte: uebersichtsKarte({ tage, activities, transfers }),
    legende: tage.map((tag) => ({
      tag: tag.nummer,
      farbe: tagesfarbe(tag.nummer),
    })),
  };
}
