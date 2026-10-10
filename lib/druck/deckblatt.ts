import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import type { Trip } from "../trips/types";
import type { KostenSummen } from "../kosten/summen";
import { poiBuchung } from "../pois/buchung";
import {
  formatDateRange,
  formatKurzesDatum,
  formatVollesDatum,
} from "../trips/format";
import { druckBetrag } from "./geld";
import { DRUCK_BUCHUNG_LABEL } from "./kosten";
import type {
  DruckDeckblatt,
  DruckEckdatum,
  DruckTag,
  DruckZahl,
} from "./types";

/**
 * Seite 1 des gedruckten Reiseplans (req-080): ein Foto ueber den oberen zwei
 * Dritteln mit Titel und Ort darauf, darunter eine Flaeche in
 * Mitternachtsblau mit der Beschreibung der Reise, vier Zahlen und den
 * Eckdaten.
 */

/**
 * Der handschriftliche Satz ueber dem Titel ist der Anlass; er kommt aus der
 * Beschreibung der Reise (req-080, Design-Referenz). Hat sie mehr als einen
 * Satz, steht ihr erster oben und der Rest im Dashboard -- so wird nichts
 * zweimal gedruckt. Ein einzelner Satz bleibt im Dashboard: oben allein
 * stuende er statt der Beschreibung, nicht neben ihr.
 */
export function anlassUndBeschreibung(description: string): {
  vorspann: string;
  beschreibung: string;
} {
  const text = description.trim();
  const geteilt = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(text);
  return geteilt
    ? { vorspann: geteilt[1], beschreibung: geteilt[2] }
    : { vorspann: "", beschreibung: text };
}

/** Das Foto des Deckblatts: das erste Foto der ersten Station, die eines hat. */
function titelFoto(tage: DruckTag[]) {
  for (const tag of tage) {
    for (const station of tag.stationen) {
      if (station.grossesFoto) return station.grossesFoto;
    }
  }
  return null;
}

/** Die Unterkunft: der erste Programmpunkt vom Typ Hotel, samt Buchungszustand. */
function unterkunft(activities: Activity[], pois: Poi[]): DruckEckdatum | null {
  const hotel = [...activities]
    .filter((activity) => activity.type === "hotel")
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  if (!hotel) return null;

  const poi = pois.find((p) => p.id === hotel.poiId);
  const zustand = poi ? DRUCK_BUCHUNG_LABEL[poiBuchung(poi)] : null;
  return {
    label: "Unterkunft",
    wert: zustand ? `${hotel.title} · ${zustand}` : hotel.title,
    warm: true,
  };
}

function zahlwort(anzahl: number, einzahl: string, mehrzahl: string): string {
  return anzahl === 1 ? einzahl : mehrzahl;
}

export function druckDeckblatt({
  trip,
  tage,
  activities,
  pois,
  teilnehmerzahl,
  summen,
  reiseleitung,
  stand,
}: {
  trip: Trip;
  /** Die Tage des Heftes -- aus ihnen kommt die Zahl der Stationen. */
  tage: DruckTag[];
  activities: Activity[];
  pois: Poi[];
  teilnehmerzahl: number;
  summen: KostenSummen;
  /** Die Namen der Reiseleiter dieser Reise (req-021); leer ist moeglich. */
  reiseleitung: string[];
  /** Der Tag, an dem das Heft entsteht (ISO-Datum) -- der "Stand". */
  stand: string;
}): DruckDeckblatt {
  const { vorspann, beschreibung } = anlassUndBeschreibung(trip.description);
  const stationen = tage.reduce(
    (summe, tag) => summe + tag.stationen.length,
    0,
  );

  const zahlen: DruckZahl[] = [
    {
      wert: String(tage.length),
      einheit: zahlwort(tage.length, "Tag", "Tage"),
      bezeichnung: "Reisedauer",
    },
    { wert: String(stationen), einheit: null, bezeichnung: "Stationen" },
    { wert: String(teilnehmerzahl), einheit: null, bezeichnung: "Reisende" },
    {
      wert: druckBetrag(summen.gesamtCent).replace(" €", ""),
      einheit: "€",
      // Der Betrag je Person steht unter der Zahl, nicht als fuenfte Zahl --
      // er ist dieselbe Summe, nur geteilt.
      bezeichnung:
        summen.jePersonCent === null
          ? "geplant"
          : `geplant · ${druckBetrag(summen.jePersonCent)} je Person`,
      warm: true,
    },
  ];

  const eckdaten: DruckEckdatum[] = [
    { label: "Hauptort", wert: trip.mainPlace.name },
    unterkunft(activities, pois),
    { label: "Anreise", wert: formatKurzesDatum(trip.startDate) },
    { label: "Abreise", wert: formatKurzesDatum(trip.endDate) },
    reiseleitung.length > 0
      ? { label: "Reiseleitung", wert: reiseleitung.join(", ") }
      : null,
    { label: "Stand", wert: formatVollesDatum(stand) },
  ].filter((zeile): zeile is DruckEckdatum => zeile !== null);

  return {
    titel: trip.title,
    ort: `${trip.mainPlace.name} · ${formatDateRange(trip)}`,
    vorspann,
    beschreibung,
    zahlen,
    eckdaten,
    titelFoto: titelFoto(tage),
  };
}
