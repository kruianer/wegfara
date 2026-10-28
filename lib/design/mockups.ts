/**
 * Die Seiten-Mockups (req-091): je Seite der App eine HTML-Datei unter
 * MOCKUP_ORDNER, neben dem Stylesheet und der Pruefung des Baukastens. Sie
 * zeigen die Seite mit echten Inhalten und ohne eigenes CSS -- alles kommt
 * aus baukasten.css, das scripts/baukasten-export.mjs aus dem Katalog
 * (app/plan/baukasten/) erzeugt.
 *
 * Die Mockups sind Entwurf, nicht Anwendung: reines HTML, nie ausgeliefert.
 * Diese Liste ist der Massstab, gegen den die Tests sie pruefen
 * (app/plan/baukasten/mockups.test.tsx, tests/e2e/mockups.e2e.ts).
 */

export const MOCKUP_ORDNER = "delivery/design/baukasten";

/** Das Stylesheet -- das einzige, das ein Mockup einbindet. */
export const MOCKUP_STIL = "baukasten.css";

/** Die Layout-Pruefung -- das einzige Skript eines Mockups. */
export const MOCKUP_PRUEFUNG = "pruef.js";

/**
 * Die Gestaltungswelt: der Planer ist dunkel, der Begleiter hell. Die
 * gemeinsamen Seiten (Anmeldung, Mein Bereich, ...) tragen in der App die
 * Farbwelt des Planers.
 */
export type Welt = "planer" | "begleiter" | "gemeinsam";

export interface Mockup {
  datei: string;
  titel: string;
  welt: Welt;
  /**
   * Welche Ansicht der App es zeigt: im Planer die Kennung des Bereichs
   * (lib/plan/areas.ts), "accounts" oder "keine-reise"; im Begleiter und bei
   * den gemeinsamen Seiten ein sprechender Name.
   */
  ansicht: string;
  /** Zustaende ohne eigene Datei, herzustellen mit `#zustand=…`. */
  zustaende?: readonly string[];
  /** Gefuellt mit der Reise „30 Johr zämma – Rothenburg“ (req-080). */
  reiseRothenburg?: boolean;
}

export const MOCKUPS: readonly Mockup[] = [
  {
    datei: "planer-planung.html",
    titel: "Planer · Planung",
    welt: "planer",
    ansicht: "planung",
    zustaende: ["entfernen"],
    reiseRothenburg: true,
  },
  {
    datei: "begleiter-plan.html",
    titel: "Begleiter · Plan",
    welt: "begleiter",
    ansicht: "plan",
    reiseRothenburg: true,
  },
  {
    datei: "planer-pois.html",
    titel: "Planer · POIs",
    welt: "planer",
    ansicht: "pois",
    zustaende: ["loeschen"],
  },
  {
    datei: "planer-bewertungen.html",
    titel: "Planer · Bewertungen",
    welt: "planer",
    ansicht: "bewertungen",
  },
  {
    datei: "planer-kosten.html",
    titel: "Planer · Kosten",
    welt: "planer",
    ansicht: "kosten",
    zustaende: ["ausgabe"],
  },
  {
    datei: "planer-dokumente.html",
    titel: "Planer · Dokumente",
    welt: "planer",
    ansicht: "dokumente",
    zustaende: ["loeschen"],
  },
  {
    datei: "planer-reisedetails.html",
    titel: "Planer · Reisedetails",
    welt: "planer",
    ansicht: "reisedetails",
  },
  {
    datei: "planer-chat.html",
    titel: "Planer · Chat",
    welt: "planer",
    ansicht: "chat",
  },
  {
    datei: "planer-drucken.html",
    titel: "Planer · Drucken",
    welt: "planer",
    ansicht: "drucken",
  },
  {
    datei: "planer-accounts.html",
    titel: "Planer · Verwaltung",
    welt: "planer",
    ansicht: "accounts",
  },
  {
    datei: "planer-keine-reise.html",
    titel: "Planer · Keine Reise",
    welt: "planer",
    ansicht: "keine-reise",
  },
  {
    datei: "begleiter-karte.html",
    titel: "Begleiter · Karte",
    welt: "begleiter",
    ansicht: "karte",
  },
  {
    datei: "begleiter-kosten.html",
    titel: "Begleiter · Kosten",
    welt: "begleiter",
    ansicht: "kosten",
    zustaende: ["ausgabe"],
  },
  {
    datei: "begleiter-dokumente.html",
    titel: "Begleiter · Dokumente",
    welt: "begleiter",
    ansicht: "dokumente",
  },
  {
    datei: "begleiter-meldungen.html",
    titel: "Begleiter · Meldungen",
    welt: "begleiter",
    ansicht: "meldungen",
  },
  {
    datei: "begleiter-concierge.html",
    titel: "Begleiter · Concierge",
    welt: "begleiter",
    ansicht: "concierge",
  },
  {
    datei: "begleiter-wer-faehrt-mit.html",
    titel: "Begleiter · Wer fährt mit",
    welt: "begleiter",
    ansicht: "wer-faehrt-mit",
  },
  {
    datei: "begleiter-mehr.html",
    titel: "Begleiter · Menü „Mehr“",
    welt: "begleiter",
    ansicht: "mehr",
  },
  {
    datei: "anmeldung.html",
    titel: "Anmeldung",
    welt: "gemeinsam",
    ansicht: "anmeldung",
    zustaende: ["verloren"],
  },
  {
    datei: "einladung.html",
    titel: "Einladung",
    welt: "gemeinsam",
    ansicht: "einladung",
  },
  {
    datei: "passkey-einrichten.html",
    titel: "Passkey einrichten",
    welt: "gemeinsam",
    ansicht: "passkey-einrichten",
    zustaende: ["fehler"],
  },
  {
    datei: "ersteinrichtung.html",
    titel: "Ersteinrichtung",
    welt: "gemeinsam",
    ansicht: "ersteinrichtung",
  },
  {
    datei: "mein-bereich.html",
    titel: "Mein Bereich",
    welt: "gemeinsam",
    ansicht: "mein-bereich",
  },
];

/**
 * Was es ausser den Bereichen aus lib/plan/areas.ts als Mockup geben muss
 * (req-091, „Welche Seiten“): im Planer die Verwaltung und den leeren
 * Anfang, im Begleiter seine Ansichten samt Menue „Mehr“, dazu die
 * gemeinsamen Seiten.
 */
export const GEFORDERTE_ANSICHTEN: Record<Welt, readonly string[]> = {
  planer: ["accounts", "keine-reise"],
  begleiter: [
    "plan",
    "karte",
    "kosten",
    "dokumente",
    "meldungen",
    "concierge",
    "wer-faehrt-mit",
    "mehr",
  ],
  gemeinsam: [
    "anmeldung",
    "einladung",
    "passkey-einrichten",
    "ersteinrichtung",
    "mein-bereich",
  ],
};

/**
 * Bausteine, die eine Liste tragen. Ein Mockup mit einer davon zeigt einen
 * sehr langen Namen UND einen leeren Zustand -- beides bricht eine
 * Gestaltung, die nur mit kurzen, vollen Listen erprobt ist.
 */
export const LISTEN_SELEKTOR =
  ".liste, .tabelle, .stationen, .goListe:not(nav), .goPunkte";

/** Bausteine, die einen Namen tragen -- dort steht der sehr lange. */
export const NAMEN_SELEKTOR =
  ".zeilenName, .stationName, .kartenTitel, .tabelle td, .goZeilenName, .goKartenTitel";

/** Ab so vielen Zeichen gilt ein Name als sehr lang. */
export const SEHR_LANG_ZEICHEN = 50;

/** Der leere Zustand, in beiden Welten. */
export const LEER_SELEKTOR = ".leer, .goLeer";
