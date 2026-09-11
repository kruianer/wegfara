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
   * Die Beschreibung, die beim Sammeln notiert wird (req-044). Beide sind
   * freiwillig: der Kurztext fasst hoechstens 200 Zeichen und erscheint in
   * der POI-Liste, der Langtext ist unbegrenzt.
   */
  shortText?: string;
  longText?: string;
  /**
   * Wie lange man an diesem Ort bleiben will, in Minuten (req-058).
   * Freiwillig: fehlt sie, gilt die geschaetzte Dauer des Typs (req-011).
   * Immer ein Vielfaches von 15 -- dem Raster des Zeitstrahls (req-039).
   */
  durationMinutes?: number;
  /**
   * Was der Ort je Person kostet, in Cent (req-061). Freiwillig: fehlt der
   * Betrag, ist er nicht eingetragen — das ist etwas anderes als "kostet
   * nichts" (0). Gefuehrt wird ausschliesslich in Euro.
   */
  kostenCent?: number;
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
  /**
   * Die Bewertung bei Google und die Zahl der Bewertungen dahinter
   * (req-057). Beide sind freiwillig: von Hand angelegte POIs tragen sie
   * nicht, und ein noch nicht bewerteter Ort hat keine — das ist etwas
   * anderes als die Bewertung 0.
   */
  bewertung?: number;
  bewertungAnzahl?: number;
  /**
   * Ein Satz, warum die KI diesen Ort vorgeschlagen hat (req-057), mit
   * Bezug auf die Praeferenzen der Reise. Nur POIs aus der KI-Suche haben
   * ihn.
   */
  kiBegruendung?: string;
  photos?: PoiPhoto[];
}

/** Typfilter der POI-Liste (siehe req-010): "alle" oder genau ein Typ. */
export type PoiTypeFilter = PoiType | "alle";

/**
 * Statusfilter der POI-Liste (req-060): "alle" oder genau ein Status.
 * Mehrere Status gleichzeitig gibt es bewusst nicht — dafuer ist die
 * Statusauswahl der Karte da (req-013).
 */
export type PoiStatusFilter = PoiStatus | "alle";

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
  /** Die Beschreibung des POI (req-044); null heisst "nicht hinterlegt". */
  shortText: string | null;
  longText: string | null;
  /** Die Dauer in Minuten (req-058); null heisst "nicht eingetragen". */
  durationMinutes: number | null;
  /** Die Kosten je Person in Cent (req-061); null heisst "nicht eingetragen". */
  kostenCent: number | null;
  address: string | null;
  phone: string | null;
  /** Eine Zeile je Wochentag; null heisst "nicht hinterlegt". */
  openingHours: string[] | null;
}
