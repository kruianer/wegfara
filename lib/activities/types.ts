export type ActivityType =
  | "sehenswuerdigkeit"
  | "restaurant"
  | "hotel"
  | "aktivitaet"
  | "weltkulturerbe";

export interface ActivityPosition {
  lat: number;
  lng: number;
}

export interface Activity {
  id: string;
  tripId: string;
  type: ActivityType;
  title: string;
  shortText: string;
  longText: string;
  /** ISO-Datum+Zeit ohne Zeitzone (YYYY-MM-DDTHH:mm), lokale Reisezeit. */
  startAt: string;
  /** ISO-Datum+Zeit ohne Zeitzone (YYYY-MM-DDTHH:mm), lokale Reisezeit. */
  endAt: string;
  /** Ortsbezug fuer spaetere Anzeigen (Karte); in dieser Ansicht nicht dargestellt. */
  position: ActivityPosition;
}
