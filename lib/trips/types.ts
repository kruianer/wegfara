export interface MainPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface Trip {
  id: string;
  title: string;
  /** ISO-Datum (YYYY-MM-DD), ohne Uhrzeit. */
  startDate: string;
  /** ISO-Datum (YYYY-MM-DD), ohne Uhrzeit. */
  endDate: string;
  mainPlace: MainPlace;
}
