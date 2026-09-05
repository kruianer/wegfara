/**
 * "stadt_dorf" kam mit req-018 hinzu: der Ausgangspunkt einer Anreise
 * (Wohnort, Abflughafen) ist ein gewoehnlicher Programmpunkt dieses Typs.
 */
export type ActivityType =
  | "sehenswuerdigkeit"
  | "stadt_dorf"
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
  /** Ortsbezug fuer spaetere Anzeigen (Karte) und Transfer-Navigation.
   * Kann fehlen, wenn fuer den Programmpunkt keine Position hinterlegt ist. */
  position?: ActivityPosition;
  /** Buchungszustand: nicht automatisch ermittelt, sondern am Programmpunkt hinterlegt. */
  booked?: boolean;
  /** Kontaktwege zum Buchen/Anfragen eines nicht gebuchten Programmpunkts.
   * Rangfolge bei der Anzeige: Webadresse vor E-Mail vor Telefon. */
  bookingUrl?: string;
  bookingEmail?: string;
  bookingPhone?: string;
  /** Der POI, aus dem dieser Programmpunkt entstanden ist (siehe req-011).
   * Ein POI gilt als verplant, sobald ein Programmpunkt darauf verweist. */
  poiId?: string;
}

/**
 * Die Angaben eines neu entstehenden Programmpunkts (req-039) -- was beim
 * Verplanen eines POI in die Ablage geschrieben wird. Ohne Kennung: die
 * vergibt die Ablage. Kurz- und Langtext kommen seit req-044 vom POI.
 */
export interface ActivityValues {
  tripId: string;
  /** Der POI, aus dem der Programmpunkt entsteht; null, wenn er aus keinem stammt. */
  poiId: string | null;
  type: ActivityType;
  title: string;
  shortText: string;
  longText: string;
  /** ISO-Datum+Zeit ohne Zeitzone (YYYY-MM-DDTHH:mm), lokale Reisezeit. */
  startAt: string;
  endAt: string;
  position?: ActivityPosition;
}
