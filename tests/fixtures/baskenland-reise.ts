import type { Activity, ActivityPosition } from "@/lib/activities/types";
import type { Transfer, TransferMode } from "@/lib/transfers/types";
import type { Trip } from "@/lib/trips/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

/**
 * Die Reise aus dem Entwurf zu req-103
 * (delivery/design/reiseplan-druck/deckblatt-und-summary.mockup.html):
 * sechs Tage Baskenland, mit An- und Abreise von Zuerich.
 *
 * Wie die Anreise gemacht wird, laesst sich waehlen -- 800 km mit dem Auto
 * oder mit dem Flugzeug: der Ausschnitt der Karten darf daran nichts
 * aendern (req-103, req-018).
 */

export const ORTE = {
  zuerich: { lat: 47.3769, lng: 8.5417 },
  bilbaoHotel: { lat: 43.2627, lng: -2.9253 },
  mercado: { lat: 43.2556, lng: -2.9234 },
  guggenheim: { lat: 43.2687, lng: -2.934 },
  cascoViejo: { lat: 43.2586, lng: -2.9234 },
  puente: { lat: 43.3233, lng: -3.0167 },
  getxo: { lat: 43.356, lng: -3.011 },
  concha: { lat: 43.3183, lng: -1.9812 },
  igueldo: { lat: 43.3218, lng: -2.0052 },
  sanTelmo: { lat: 43.3238, lng: -1.9856 },
  laguardia: { lat: 42.5536, lng: -2.5847 },
  ysios: { lat: 42.5605, lng: -2.5917 },
  elciego: { lat: 42.5153, lng: -2.6188 },
} satisfies Record<string, ActivityPosition>;

export function baskenlandTrip(tage = 6): Trip {
  const ende = new Date(Date.UTC(2027, 4, 18 + tage - 1))
    .toISOString()
    .slice(0, 10);
  return {
    id: "trip-baskenland",
    title: "Pintxos & Atlantik",
    startDate: "2027-05-18",
    endDate: ende,
    mainPlace: { name: "Bilbao", lat: 43.263, lng: -2.935 },
    description: "Sechs Tage Baskenland.",
    state: "in_planung",
    tempo: "ausgewogen",
    praeferenzen: LEERE_PRAEFERENZEN,
  };
}

function datum(tag: number): string {
  return new Date(Date.UTC(2027, 4, 17 + tag)).toISOString().slice(0, 10);
}

export function programmpunkt(
  id: string,
  tag: number,
  zeit: string,
  position: ActivityPosition,
  type: Activity["type"] = "sehenswuerdigkeit",
): Activity {
  return {
    id,
    tripId: "trip-baskenland",
    type,
    title: id,
    shortText: "",
    longText: "",
    startAt: `${datum(tag)}T${zeit}`,
    endAt: `${datum(tag)}T${zeit}`,
    position,
  };
}

export function weg(
  id: string,
  von: Activity,
  nach: Activity,
  mode: TransferMode,
  distanceKm: number,
): Transfer {
  return {
    id,
    tripId: "trip-baskenland",
    fromActivityId: von.id,
    toActivityId: nach.id,
    mode,
    title: id,
    durationMin: 30,
    distanceKm,
  };
}

/**
 * Die sechs Tage, je Tag ein paar Stationen und die Wege dazwischen. Am
 * ersten Tag beginnt die Reise in Zuerich, am letzten endet sie dort.
 */
export function baskenland(anreise: TransferMode = "auto") {
  const p = {
    zuerich: programmpunkt("zuerich", 1, "07:00", ORTE.zuerich, "stadt_dorf"),
    hotel: programmpunkt("hotel", 1, "16:00", ORTE.bilbaoHotel, "hotel"),
    mercado: programmpunkt("mercado", 1, "19:00", ORTE.mercado, "restaurant"),
    guggenheim: programmpunkt("guggenheim", 2, "10:00", ORTE.guggenheim),
    cascoViejo: programmpunkt("casco", 2, "14:00", ORTE.cascoViejo),
    puente: programmpunkt("puente", 2, "17:00", ORTE.puente),
    getxo: programmpunkt("getxo", 3, "10:00", ORTE.getxo, "stadt_dorf"),
    concha: programmpunkt("concha", 3, "17:00", ORTE.concha),
    igueldo: programmpunkt("igueldo", 4, "09:30", ORTE.igueldo),
    sanTelmo: programmpunkt(
      "santelmo",
      4,
      "13:15",
      ORTE.sanTelmo,
      "restaurant",
    ),
    laguardia: programmpunkt(
      "laguardia",
      5,
      "10:00",
      ORTE.laguardia,
      "stadt_dorf",
    ),
    ysios: programmpunkt("ysios", 5, "14:00", ORTE.ysios),
    elciego: programmpunkt("elciego", 5, "17:00", ORTE.elciego, "stadt_dorf"),
    markt: programmpunkt("markt", 6, "10:00", ORTE.mercado, "restaurant"),
    heim: programmpunkt("heim", 6, "18:00", ORTE.zuerich, "stadt_dorf"),
  };
  const transfers: Transfer[] = [
    weg("anreise", p.zuerich, p.hotel, anreise, 800),
    weg("t1", p.hotel, p.mercado, "fuss", 1),
    weg("t2", p.guggenheim, p.cascoViejo, "fuss", 2),
    weg("t3", p.cascoViejo, p.puente, "bahn", 14),
    weg("t4", p.getxo, p.concha, "auto", 105),
    weg("t5", p.igueldo, p.sanTelmo, "bus", 3),
    weg("t6", p.laguardia, p.ysios, "auto", 2),
    weg("t7", p.ysios, p.elciego, "rad", 6),
    weg("abreise", p.markt, p.heim, anreise, 800),
  ];
  return { activities: Object.values(p), transfers, p };
}
