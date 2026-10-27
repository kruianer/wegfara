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
];

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
