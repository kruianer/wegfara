/**
 * Austauschbare Schnittstelle zum Routing-Dienst (req-051, Constraints):
 * heute OSRM auf dem oeffentlichen Server, spaeter dieselbe Software auf dem
 * Beelink. Der Wechsel darf die aufrufende Logik nicht veraendern.
 */
export interface RoutingClient {
  /**
   * Die Fahrzeit von einer Stelle zur anderen in Minuten (nicht gerundet),
   * oder null, wenn sie sich nicht ermitteln laesst -- Dienst nicht
   * erreichbar, unlesbare Antwort oder keine Route. Der Aufrufer zeigt dann
   * den Hinweis statt eines Verzugs (req-051). Gerechnet wird mit dem Auto.
   */
  fahrzeitMinuten(von: Wegpunkt, nach: Wegpunkt): Promise<number | null>;

  /**
   * Dieselbe Route, aber mit ihrer Laenge (req-052): daraus entsteht der
   * Vorschlag fuer einen Transfer -- Verkehrsmittel, Dauer und Strecke.
   * Das Profil sagt, womit gerechnet wird (req-059); ohne Angabe mit dem
   * Auto. null bedeutet dasselbe wie oben: der Nutzer traegt die Angaben
   * selbst ein.
   */
  strecke(
    von: Wegpunkt,
    nach: Wegpunkt,
    profil?: Routenprofil,
  ): Promise<Fahrstrecke | null>;

  /**
   * Der Strassenverlauf derselben Route als Punktfolge (req-059) -- daraus
   * zeichnet die Tageskarte die Linie zwischen zwei Programmpunkten. null
   * heisst wie oben: es gibt keinen; die Karte zeigt dann die Gerade.
   */
  verlauf(
    von: Wegpunkt,
    nach: Wegpunkt,
    profil?: Routenprofil,
  ): Promise<Wegpunkt[] | null>;
}

/**
 * Womit OSRM rechnet (req-059). Mehr als diese drei Profile gibt es nicht --
 * Boot, Flug, Bahn und Faehre faehrt kein Routing-Dienst aus.
 */
export type Routenprofil = "auto" | "rad" | "fuss";

/** Eine gefahrene Route: ihre Laenge und die Dauer auf der Strasse (req-052). */
export interface Fahrstrecke {
  distanzKm: number;
  dauerMinuten: number;
  /**
   * Die Abschnitte der Route in ihrer Reihenfolge (req-059) -- daraus wird
   * die Wegbeschreibung im Formular. Fehlt, wenn der Dienst keine nennt.
   */
  abschnitte?: Wegabschnitt[];
}

/** Ein Stueck einer Route: die Strasse und ihre Laenge (req-059). */
export interface Wegabschnitt {
  strasse: string;
  distanzKm: number;
}

/** Eine Stelle auf der Karte -- gleiche Form wie an POI und Programmpunkt. */
export interface Wegpunkt {
  lat: number;
  lng: number;
}
