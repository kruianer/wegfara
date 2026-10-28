import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import type { Transfer } from "../transfers/types";
import type { KostenSummen } from "../kosten/summen";
import { formatKurzesDatum } from "../trips/format";
import { druckBetrag } from "./geld";
import { uebersichtsKarte } from "./karte";
import { tagesfarbe } from "./tagesfarben";
import { anzahlInWorten } from "./text";
import type { TagesUeberschrift } from "./ueberschriften";
import type {
  DruckTag,
  DruckTageszeile,
  DruckUebersicht,
  DruckZahl,
} from "./types";

/**
 * Seite 2 des gedruckten Reiseplans (req-103): die Reise im Ueberblick --
 * oben die Karte der ganzen Reise, darunter je Reisetag eine Zeile und drei
 * Zahlen.
 */

/** Wie viele Stationen eine Zeile der Tagesliste nennt -- nicht alle. */
const ORTE_JE_ZEILE = 3;

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
  if (gegenden < 2) return dauer;
  // Mitten im Satz klein: "drei Gegenden", nicht "Drei Gegenden".
  const [zahl, ...wort] = anzahlInWorten(gegenden, "Gegend", "Gegenden").split(
    " ",
  );
  return `${dauer}, ${zahl.toLowerCase()} ${wort.join(" ")}`;
}

/**
 * Die Zeilen der Tagesliste. Die Ueberschrift ist die gespeicherte -- sonst
 * stehen die Orte des Tages verbunden da, wie auf seiner Tagesseite.
 * Der erste und der letzte Reisetag sind An- und Abreisetag.
 */
export function tageszeilen(
  tage: DruckTag[],
  ueberschriften: TagesUeberschrift[],
): DruckTageszeile[] {
  const gespeichert = new Map(ueberschriften.map((u) => [u.datum, u.text]));
  return tage.map((tag, index) => {
    const [wochentag, tagMonat] = formatKurzesDatum(tag.datum).split(", ");
    const wichtige = [
      ...tag.stationen.filter((s) => s.layout !== "l5"),
      ...tag.stationen.filter((s) => s.layout === "l5"),
    ].slice(0, ORTE_JE_ZEILE);
    // Die Reihenfolge des Tages bleibt, auch wenn Nebenstationen hinten
    // anstehen.
    const orte = tag.stationen
      .filter((s) => wichtige.includes(s))
      .map((s) => s.name)
      .join(" · ");
    return {
      nummer: tag.nummer,
      datum: tag.datum,
      wochentag,
      tagMonat,
      ueberschrift: gespeichert.get(tag.datum) ?? tag.ueberschrift,
      orte,
      stationen: tag.stationen.length,
      reisetag:
        tage.length < 2
          ? null
          : index === 0
            ? "anreise"
            : index === tage.length - 1
              ? "abreise"
              : null,
    };
  });
}

/**
 * Die vor Ort gefahrenen Kilometer -- oder null, wenn die Zahl nicht stimmen
 * kann (req-103).
 *
 * Sie stimmt nur, wenn an jedem Tag jede Station mit der naechsten durch einen
 * Transfer mit Entfernung (req-052) verbunden ist; fehlt einer, waere die
 * Zahl zu klein -- und das ist schlimmer als keine Zahl. "Vor Ort" sind die
 * Wege, die auf der Uebersichtskarte im Ausschnitt liegen: An- und Abreise
 * zaehlen nicht mit.
 */
export function vorOrtGefahreneKm({
  tage,
  transfers,
  imAusschnitt,
}: {
  tage: DruckTag[];
  transfers: Transfer[];
  /** Die Transfers, die auf der Uebersichtskarte im Ausschnitt liegen. */
  imAusschnitt: Set<string>;
}): number | null {
  const zwischen = new Map(
    transfers.map((t) => [`${t.fromActivityId}>${t.toActivityId}`, t]),
  );
  for (const tag of tage) {
    for (let i = 1; i < tag.stationen.length; i++) {
      const weg = zwischen.get(
        `${tag.stationen[i - 1].activityId}>${tag.stationen[i].activityId}`,
      );
      if (!weg || !(weg.distanceKm > 0)) return null;
    }
  }
  const summe = transfers
    .filter((t) => imAusschnitt.has(t.id))
    .reduce((km, t) => km + t.distanceKm, 0);
  return Math.round(summe);
}

function stationenZahl(anzahl: number): DruckZahl {
  return {
    wert: String(anzahl),
    einheit: null,
    bezeichnung: anzahl === 1 ? "Station" : "Stationen",
  };
}

export function druckUebersicht({
  tage,
  activities,
  transfers,
  pois,
  ueberschriften = [],
  summen = { gesamtCent: 0, jePersonCent: null },
  teilnehmerzahl = 0,
}: {
  tage: DruckTag[];
  activities: Activity[];
  transfers: Transfer[];
  pois: Poi[];
  /** Die gespeicherten Ueberschriften der Reisetage. */
  ueberschriften?: TagesUeberschrift[];
  summen?: KostenSummen;
  teilnehmerzahl?: number;
}): DruckUebersicht {
  const gegenden = gegendenDerReise(tage, pois);
  const karte = uebersichtsKarte({ tage, activities, transfers });
  const stationen = tage.reduce(
    (summe, tag) => summe + tag.stationen.length,
    0,
  );

  const km = vorOrtGefahreneKm({
    tage,
    transfers,
    imAusschnitt: new Set(
      (karte?.linien ?? [])
        .filter((linie) => linie.strich === "durchgezogen")
        .map((linie) => linie.id),
    ),
  });
  // Stimmen die Kilometer nicht, nimmt eine andere Zahl ihren Platz.
  const mitte: DruckZahl =
    km !== null
      ? { wert: String(km), einheit: "km", bezeichnung: "vor Ort gefahren" }
      : gegenden.length > 0
        ? {
            wert: String(gegenden.length),
            einheit: null,
            bezeichnung: gegenden.length === 1 ? "Gegend" : "Gegenden",
          }
        : {
            wert: String(tage.length),
            einheit: null,
            bezeichnung: tage.length === 1 ? "Reisetag" : "Reisetage",
          };

  return {
    titel: uebersichtTitel(tage.length, gegenden.length),
    karte,
    legende: tage.map((tag) => ({
      tag: tag.nummer,
      farbe: tagesfarbe(tag.nummer),
    })),
    zeilen: tageszeilen(tage, ueberschriften),
    zahlen: [
      stationenZahl(stationen),
      mitte,
      {
        wert: druckBetrag(summen.gesamtCent).replace(" €", ""),
        einheit: "€",
        bezeichnung:
          teilnehmerzahl > 0 ? `geplant, für ${teilnehmerzahl}` : "geplant",
        warm: true,
      },
    ],
  };
}
