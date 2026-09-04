export type PoiType =
  | "sehenswuerdigkeit"
  | "stadt_dorf"
  | "restaurant"
  | "strand"
  | "aktivitaet"
  | "hotel"
  | "weltkulturerbe";

export type PoiStatus =
  | "gesetzt"
  | "wahrscheinlich"
  | "weiss_nicht"
  | "wenn_zeit"
  | "auf_keinen_fall";

export interface PoiPosition {
  lat: number;
  lng: number;
}

/**
 * Ein gespeichertes Foto eines POI (siehe req-026). Die Datei liegt im
 * Bildverzeichnis, dieser Datensatz in der Datenbank; angezeigt wird sie
 * ueber `/api/poi-fotos/<id>`.
 */
export interface PoiPhoto {
  id: string;
  /** Reihenfolge ab 1 — das erste Foto ersetzt die farbige Flaeche der Zeile. */
  position: number;
}

export interface Poi {
  id: string;
  tripId: string;
  /** Fortlaufend innerhalb der Reise, beginnend bei 1, dauerhaft vergeben (siehe req-013). */
  number: number;
  name: string;
  ort: string;
  type: PoiType;
  position: PoiPosition;
  status: PoiStatus;
  web?: string;
  /**
   * Die zusaetzlichen Angaben aus einem Google-Maps-Link (req-026). Sie
   * sind freiwillig — von Hand oder per KI-Suche angelegte POIs haben sie
   * nicht.
   */
  address?: string;
  phone?: string;
  openingHours?: string[];
  /** Die Kennung des Ortes bei Google — erkennt denselben Ort wieder. */
  googlePlaceId?: string;
  photos?: PoiPhoto[];
}

/** Typfilter der POI-Liste (siehe req-010): "alle" oder genau ein Typ. */
export type PoiTypeFilter = PoiType | "alle";

/**
 * Die gespeicherten Angaben eines POI ohne Nummer und Kennung (req-035) —
 * was das Formular beim Anlegen und Aendern liefert, geprueft und
 * aufgeraeumt. Die Nummer fehlt bewusst: sie bleibt nach der Vergabe fest
 * (req-013).
 */
export interface PoiValues {
  name: string;
  /**
   * Der abgeleitete Ort (req-041). null heisst: es liess sich keiner
   * ermitteln — dann bleibt der gespeicherte Ort stehen, bei einem neuen POI
   * bleibt er leer. Von Hand kommt er nie.
   */
  ort: string | null;
  type: PoiType;
  position: PoiPosition;
  status: PoiStatus;
  web: string | null;
  address: string | null;
  phone: string | null;
  /** Eine Zeile je Wochentag; null heisst "nicht hinterlegt". */
  openingHours: string[] | null;
}
