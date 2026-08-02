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
  name: string;
  ort: string;
  type: PoiType;
  position: PoiPosition;
  status: PoiStatus;
  web?: string;
}
