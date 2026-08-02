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
}

/** Typfilter der POI-Liste (siehe req-010): "alle" oder genau ein Typ. */
export type PoiTypeFilter = PoiType | "alle";
