import type { Activity, DruckDarstellung } from "@/lib/activities/types";
import type { Poi, PoiPhoto } from "@/lib/pois/types";
import type { Transfer } from "@/lib/transfers/types";
import type { Trip } from "@/lib/trips/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

/**
 * Die Reise, mit der das Mockup des gedruckten Reiseplans gefuellt ist
 * (req-080, delivery/design/reiseplan-druck/): „30 Johr zämma" in Rothenburg,
 * 25.–26. Oktober 2026, fuenf Programmpunkte an Tag 1 und ein offener Tag 2.
 *
 * Absichtlich dieselben Daten wie im Mockup: an erfundenen Kurztexten laesst
 * sich nicht sehen, ob die Gestaltung mit wirklichen Laengen zurechtkommt --
 * und was die Tests pruefen, laesst sich im Mockup nachsehen.
 */

export const DRUCK_TAG_1 = "2026-10-25";
export const DRUCK_TAG_2 = "2026-10-26";

export const DRUCK_TRIP: Trip = {
  id: "trip-rothenburg",
  title: "30 Johr zämma",
  startDate: DRUCK_TAG_1,
  endDate: DRUCK_TAG_2,
  mainPlace: { name: "Rothenburg ob der Tauber", lat: 49.3777, lng: 10.1793 },
  description:
    "30 Jahre, und wieder zu viert unterwegs. Ein Wochenende mit unseren Trauzeugen anlässlich des 30-jährigen Hochzeitstages.",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

/** `anzahl` Fotos eines POI, durchnummeriert -- hoechstens sieben (req-068). */
function fotos(poiId: string, anzahl: number): PoiPhoto[] {
  return Array.from({ length: anzahl }, (_, index) => ({
    id: `${poiId}-foto-${index + 1}`,
    position: index + 1,
  }));
}

function poi(
  id: string,
  name: string,
  type: Poi["type"],
  fotoAnzahl: number,
  weitere: Partial<Poi> = {},
): Poi {
  return {
    id,
    tripId: DRUCK_TRIP.id,
    number: 1,
    name,
    ort: "Rothenburg",
    type,
    position: { lat: 49.3777, lng: 10.1793 },
    status: "gesetzt",
    photos: fotos(id, fotoAnzahl),
    ...weitere,
  };
}

/** Sieben Fotos -- der Fall aus den Akzeptanzkriterien. */
export const POI_DORNBIRN = poi("poi-dornbirn", "Dornbirn", "stadt_dorf", 7);
/** Genau ein Foto -- die Bildreihe faellt darauf zusammen. */
export const POI_CAFFE = poi("poi-caffe", "Caffè Vittoria", "restaurant", 1);
export const POI_HOTEL = poi(
  "poi-hotel",
  "Romantik Hotel & Restaurant Markusturm",
  "hotel",
  4,
  { kostenCent: 22000, buchung: "gebucht" },
);
export const POI_ZUNFTHAUS = poi(
  "poi-zunfthaus",
  "Gaststuben im Zunfthaus der Schiffleute",
  "restaurant",
  4,
  { buchung: "offen" },
);
export const POI_HERR = poi("poi-herr", "HerR Restaurant", "restaurant", 2, {
  buchung: "offen",
});
/** Ein Foto, ein Preis je Person -- die Nachtwaechter-Tour des Mockups. */
export const POI_NACHTWAECHTER = poi(
  "poi-nachtwaechter",
  "Nachtwächter Tour",
  "aktivitaet",
  1,
  { kostenCent: 800, buchung: "nicht_noetig" },
);

export const DRUCK_POIS: Poi[] = [
  POI_DORNBIRN,
  POI_CAFFE,
  POI_HOTEL,
  POI_ZUNFTHAUS,
  POI_HERR,
  POI_NACHTWAECHTER,
];

function activity(
  id: string,
  poiRef: Poi,
  type: Activity["type"],
  startAt: string,
  endAt: string,
  langtext: string,
  druckDarstellung?: DruckDarstellung,
): Activity {
  return {
    id,
    tripId: DRUCK_TRIP.id,
    type,
    title: poiRef.name,
    shortText: `Kurztext zu ${poiRef.name}`,
    longText: langtext,
    startAt,
    endAt,
    poiId: poiRef.id,
    position: poiRef.position,
    druckDarstellung,
  };
}

export const ST_DORNBIRN = activity(
  "activity-dornbirn",
  POI_DORNBIRN,
  "stadt_dorf",
  `${DRUCK_TAG_1}T09:00`,
  `${DRUCK_TAG_1}T10:00`,
  "Unser Treffpunkt zur Abfahrt. Die Stadt am Fuß des Karren ist für uns vor allem der Ort, an dem die Reise beginnt.",
);

export const ST_CAFFE = activity(
  "activity-caffe",
  POI_CAFFE,
  "restaurant",
  `${DRUCK_TAG_1}T10:15`,
  `${DRUCK_TAG_1}T10:45`,
  "Eine halbe Stunde Kaffee auf dem Weg, damit die Fahrt nicht in einem Stück durchgezogen wird.",
  "nebenstation",
);

export const ST_HOTEL = activity(
  "activity-hotel",
  POI_HOTEL,
  "hotel",
  `${DRUCK_TAG_1}T15:00`,
  `${DRUCK_TAG_1}T16:00`,
  "Zollhaus aus dem 13. Jahrhundert mit antiken Möbeln und holzgetäfeltem Restaurant.",
);

/** Hauptoption einer Options-Gruppe (req-004) -- gleiche Zeit wie ST_HERR. */
export const ST_ZUNFTHAUS = activity(
  "activity-zunfthaus",
  POI_ZUNFTHAUS,
  "restaurant",
  `${DRUCK_TAG_1}T19:00`,
  `${DRUCK_TAG_1}T21:00`,
  "Klassische schwäbische Küche und lokale Biere im Fachwerkhaus mit Straßenterrasse.",
);

export const ST_HERR = activity(
  "activity-herr",
  POI_HERR,
  "restaurant",
  `${DRUCK_TAG_1}T19:00`,
  `${DRUCK_TAG_1}T21:00`,
  "Die Alternative zum Zunfthaus, zwei Gassen weiter.",
);

export const ST_NACHTWAECHTER = activity(
  "activity-nachtwaechter",
  POI_NACHTWAECHTER,
  "aktivitaet",
  `${DRUCK_TAG_1}T21:30`,
  `${DRUCK_TAG_1}T22:30`,
  "Geführter Abendrundgang mit einer als Nachtwächter auftretenden Person. Eine Stunde Gassen, Geschichten und Laternenlicht.",
);

export const DRUCK_ACTIVITIES: Activity[] = [
  ST_DORNBIRN,
  ST_CAFFE,
  ST_HOTEL,
  ST_ZUNFTHAUS,
  ST_HERR,
  ST_NACHTWAECHTER,
];

/**
 * Die Wege dazwischen. Im Heft erscheint keiner von ihnen -- sie gehoeren zum
 * Fahrplan, nicht zum Magazin (req-080).
 */
export const DRUCK_TRANSFERS: Transfer[] = [
  {
    id: "transfer-1",
    tripId: DRUCK_TRIP.id,
    fromActivityId: ST_DORNBIRN.id,
    toActivityId: ST_CAFFE.id,
    mode: "auto",
    title: "Fahrt nach Lindau",
    durationMin: 15,
    distanceKm: 20,
  },
  {
    id: "transfer-2",
    tripId: DRUCK_TRIP.id,
    fromActivityId: ST_CAFFE.id,
    toActivityId: ST_HOTEL.id,
    mode: "auto",
    title: "Fahrt nach Rothenburg",
    durationMin: 240,
    distanceKm: 320,
  },
];
