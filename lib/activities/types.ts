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
}
