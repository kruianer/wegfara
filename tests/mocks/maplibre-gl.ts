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
  static instances: Marker[] = [];

  element: HTMLElement;
  draggable: boolean;
  private lngLat: { lng: number; lat: number } = { lng: 0, lat: 0 };
  private listeners = new Map<string, Set<Listener>>();

  constructor(options: { element?: HTMLElement; draggable?: boolean } = {}) {
    this.element = options.element ?? document.createElement("div");
    this.draggable = options.draggable ?? false;
    Marker.instances.push(this);
  }

  setLngLat(lngLat: LngLatTuple) {
    this.lngLat = { lng: lngLat[0], lat: lngLat[1] };
    return this;
  }

  getLngLat() {
    return this.lngLat;
  }

  on(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
    return this;
  }

  off(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
    return this;
  }

  addTo(map: MapLibreMap) {
    map.attach(this.element);
    return this;
  }

  remove() {
    this.element.remove();
    return this;
  }

  getElement() {
    return this.element;
  }

  // Test-Helfer: simuliert das Ziehen dieses Markers an eine neue Position
  // (siehe req-012). Ohne zweiten Parameter wird sowohl "drag" als auch
  // "dragend" gefeuert -- fuer Tests, die nur den Endzustand pruefen.
  simulateDragTo(lngLat: LngLatTuple, phase?: "drag" | "dragend") {
    this.lngLat = { lng: lngLat[0], lat: lngLat[1] };
    const phases = phase ? [phase] : (["drag", "dragend"] as const);
    for (const p of phases) {
      this.listeners.get(p)?.forEach((listener) => listener());
    }
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
    map.attach(this.element);
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
  // once()-Listener werden gekapselt registriert; die Zuordnung merkt sich,
  // welche Kapsel zu welchem uebergebenen Listener gehoert, damit off() den
  // Listener auch dann entfernt, wenn er per once() registriert wurde --
  // genau wie in maplibre-gl selbst.
  private onceWrappers = new Map<string, Map<Listener, Listener>>();
  // Eine per remove() abgeraeumte Karte ist tot: sie haelt keine Listener
  // mehr und liefert keine Ereignisse. Tests koennen daran erkennen, ob die
  // Anwendung noch auf einer alten Instanz arbeitet (siehe bug-007).
  removed = false;
  private attachedElements: HTMLElement[] = [];

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

  // Haengt ein Element (Marker, Popup) an die Kartenflaeche. Wie in
  // maplibre-gl gehoert es damit zu DIESER Instanz und verschwindet mit
  // ihr, wenn sie abgeraeumt wird.
  attach(element: HTMLElement) {
    this.attachedElements.push(element);
    this.container.appendChild(element);
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
  // "load" feuert -- wie in maplibre-gl -- nur ein einziges Mal.
  simulateStyleLoad() {
    this.styleLoaded = true;
    const loadListeners = this.listeners.get("load");
    this.listeners.delete("load");
    loadListeners?.forEach((listener) => listener());
  }

  // Simuliert das Nachladen von Kacheln (siehe bug-007): isStyleLoaded()
  // meldet in maplibre-gl auch nach dem einmaligen "load"-Ereignis wieder
  // false, solange eine Quelle noch Kacheln laedt -- etwa nach jedem
  // Verschieben oder Zoomen der Karte. Ein "load"-Ereignis folgt darauf
  // NICHT mehr; wer darauf wartet, wartet ewig.
  simulateTileLoading() {
    this.styleLoaded = false;
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
      this.off(type, listener);
      listener(...args);
    };
    if (!this.onceWrappers.has(type)) this.onceWrappers.set(type, new Map());
    this.onceWrappers.get(type)!.set(listener, wrapped);
    this.on(type, wrapped);
    return this;
  }

  off(type: string, listener: Listener) {
    const wrapped = this.onceWrappers.get(type)?.get(listener);
    if (wrapped) {
      this.onceWrappers.get(type)!.delete(listener);
      this.listeners.get(type)?.delete(wrapped);
    }
    this.listeners.get(type)?.delete(listener);
    return this;
  }

  // Test-Helfer: simuliert einen Klick auf die Karte an einer Koordinate
  // (siehe req-012) -- ein echter DOM-Klick auf das Container-Element wuerde
  // anders als in maplibre-gl selbst keine Koordinate ermitteln koennen.
  simulateClick(lngLat: LngLatTuple) {
    const [lng, lat] = lngLat;
    if (this.removed) return;
    this.listeners
      .get("click")
      ?.forEach((listener) => listener({ lngLat: { lng, lat } }));
  }

  // Test-Helfer: simuliert ein Tippen mit dem Finger auf die Karte an einer
  // Koordinate (siehe bug-005) -- "touchstart" und "touchend" ohne
  // nennenswerte Bewegung dazwischen, wie bei einem kurzen Tipp.
  simulateTouchTap(lngLat: LngLatTuple, point = { x: 0, y: 0 }) {
    const [lng, lat] = lngLat;
    if (this.removed) return;
    this.listeners
      .get("touchstart")
      ?.forEach((listener) => listener({ point }));
    this.listeners
      .get("touchend")
      ?.forEach((listener) => listener({ lngLat: { lng, lat }, point }));
  }

  // Test-Helfer: simuliert eine Wischgeste (Verschieben der Karte) an einer
  // Koordinate (siehe bug-005) -- "touchstart" und "touchend" mit
  // nennenswerter Bewegung dazwischen, damit Tests pruefen koennen, dass
  // daraus kein Eckpunkt entsteht.
  simulateTouchPan(
    lngLat: LngLatTuple,
    from = { x: 0, y: 0 },
    to = { x: 40, y: 40 },
  ) {
    const [lng, lat] = lngLat;
    if (this.removed) return;
    this.listeners
      .get("touchstart")
      ?.forEach((listener) => listener({ point: from }));
    this.listeners
      .get("touchend")
      ?.forEach((listener) => listener({ lngLat: { lng, lat }, point: to }));
  }

  // Wie in maplibre-gl: die Karte ist danach unbrauchbar -- alle Listener
  // sind abgeraeumt, Ereignisse erreichen niemanden mehr.
  remove() {
    this.removed = true;
    this.listeners.clear();
    this.onceWrappers.clear();
    this.attachedElements.forEach((element) => element.remove());
    this.attachedElements = [];
  }

  // Test-Helfer: die Karteninstanz, die der Nutzer gerade bedient -- also
  // die zuletzt erzeugte, die noch nicht abgeraeumt wurde (siehe bug-007).
  static live() {
    return MapLibreMap.instances.filter((map) => !map.removed).at(-1)!;
  }
}
