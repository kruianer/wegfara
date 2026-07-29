// Test-Double fuer maplibre-gl (siehe req-008): die echte Bibliothek
// braucht WebGL, das jsdom nicht bereitstellt. Bildet nur das nach, was
// MapView tatsaechlich verwendet, mit echten DOM-Knoten, damit Marker und
// Popups in Tests wie in der Anwendung angeklickt werden koennen.

type LngLatTuple = [number, number];

export class LngLatBounds {
  private minLng = Infinity;
  private minLat = Infinity;
  private maxLng = -Infinity;
  private maxLat = -Infinity;

  extend(lngLat: LngLatTuple) {
    const [lng, lat] = lngLat;
    this.minLng = Math.min(this.minLng, lng);
    this.maxLng = Math.max(this.maxLng, lng);
    this.minLat = Math.min(this.minLat, lat);
    this.maxLat = Math.max(this.maxLat, lat);
    return this;
  }

  toArray() {
    return [
      [this.minLng, this.minLat],
      [this.maxLng, this.maxLat],
    ];
  }
}

export class GeoJSONSource {
  data: GeoJSON.FeatureCollection;

  constructor(data: GeoJSON.FeatureCollection) {
    this.data = data;
  }

  setData(data: GeoJSON.FeatureCollection) {
    this.data = data;
    return this;
  }
}

export class Marker {
  element: HTMLElement;

  constructor(options: { element?: HTMLElement } = {}) {
    this.element = options.element ?? document.createElement("div");
  }

  setLngLat() {
    return this;
  }

  addTo(map: MapLibreMap) {
    map.getContainer().appendChild(this.element);
    return this;
  }

  remove() {
    this.element.remove();
    return this;
  }

  getElement() {
    return this.element;
  }
}

export class Popup {
  element: HTMLElement;

  constructor() {
    this.element = document.createElement("div");
    this.element.setAttribute("role", "tooltip");
  }

  setLngLat() {
    return this;
  }

  setDOMContent(node: Node) {
    this.element.appendChild(node);
    return this;
  }

  addTo(map: MapLibreMap) {
    map.getContainer().appendChild(this.element);
    return this;
  }

  remove() {
    this.element.remove();
    return this;
  }
}

export class MapLibreMap {
  static instances: MapLibreMap[] = [];

  private container: HTMLElement;
  center: LngLatTuple;
  fitBoundsCalls: Array<{ bounds: LngLatBounds; options?: unknown }> = [];
  sources = new Map<string, GeoJSONSource>();
  layers = new Set<string>();

  constructor(options: { container: HTMLElement; center: LngLatTuple }) {
    this.container = options.container;
    this.center = options.center;
    MapLibreMap.instances.push(this);
  }

  getContainer() {
    return this.container;
  }

  setCenter(center: LngLatTuple) {
    this.center = center;
    return this;
  }

  fitBounds(bounds: LngLatBounds, options?: unknown) {
    this.fitBoundsCalls.push({ bounds, options });
    return this;
  }

  addSource(id: string, source: { data: GeoJSON.FeatureCollection }) {
    this.sources.set(id, new GeoJSONSource(source.data));
  }

  getSource(id: string) {
    return this.sources.get(id);
  }

  addLayer(layer: { id: string }) {
    this.layers.add(layer.id);
  }

  removeLayer(id: string) {
    this.layers.delete(id);
  }

  getLayer(id: string) {
    return this.layers.has(id) ? { id } : undefined;
  }

  on() {}
  off() {}

  remove() {}
}
