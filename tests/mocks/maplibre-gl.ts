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

type Listener = (...args: unknown[]) => void;

export class MapLibreMap {
  static instances: MapLibreMap[] = [];
  // Steuert, ob eine neu erzeugte Karte den Stil sofort als geladen
  // meldet. Tests, die den Zustand "Stil noch nicht geladen" (bug-002)
  // nachbilden wollen, setzen dies vor dem Rendern auf false und rufen
  // anschliessend simulateStyleLoad() auf der Instanz auf.
  static startStyleLoaded = true;

  private container: HTMLElement;
  center: LngLatTuple;
  style: unknown;
  fitBoundsCalls: Array<{ bounds: LngLatBounds; options?: unknown }> = [];
  resizeCalls = 0;
  sources = new Map<string, GeoJSONSource>();
  layers = new Map<string, { id: string } & Record<string, unknown>>();
  private styleLoaded: boolean;
  private listeners = new Map<string, Set<Listener>>();

  constructor(options: {
    container: HTMLElement;
    center: LngLatTuple;
    style?: unknown;
  }) {
    this.container = options.container;
    this.center = options.center;
    this.style = options.style;
    this.styleLoaded = MapLibreMap.startStyleLoaded;
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

  resize() {
    this.resizeCalls += 1;
    return this;
  }

  isStyleLoaded() {
    return this.styleLoaded;
  }

  // Simuliert das "load"-Ereignis der echten Bibliothek: der Stil gilt ab
  // hier als geladen und alle darauf wartenden "load"-Listener feuern.
  simulateStyleLoad() {
    this.styleLoaded = true;
    const loadListeners = this.listeners.get("load");
    loadListeners?.forEach((listener) => listener());
  }

  addSource(id: string, source: { data: GeoJSON.FeatureCollection }) {
    if (!this.styleLoaded) {
      throw new Error("Style is not done loading");
    }
    this.sources.set(id, new GeoJSONSource(source.data));
  }

  getSource(id: string) {
    return this.sources.get(id);
  }

  addLayer(layer: { id: string } & Record<string, unknown>) {
    if (!this.styleLoaded) {
      throw new Error("Style is not done loading");
    }
    this.layers.set(layer.id, layer);
  }

  removeLayer(id: string) {
    this.layers.delete(id);
  }

  getLayer(id: string) {
    return this.layers.get(id);
  }

  on(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return this;
  }

  once(type: string, listener: Listener) {
    const wrapped: Listener = (...args) => {
      this.off(type, wrapped);
      listener(...args);
    };
    this.on(type, wrapped);
    return this;
  }

  off(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
    return this;
  }

  remove() {}
}
