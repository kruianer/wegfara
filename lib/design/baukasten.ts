/**
 * Der Baukasten (req-089): die Katalogseite, auf der jeder Baustein der
 * Oberflaeche bei allen drei Bildschirmbreiten zugleich zu sehen ist. Sie
 * ist fuer die Entwicklung, nicht fuer Reisende -- nur der Gesamt-Admin
 * sieht sie, und sie steht in keiner Leiste.
 *
 * Jeder Baustein hat eine eigene Seite unter BAUKASTEN_PATH. Der Katalog
 * zeigt sie in Rahmen der jeweiligen Breite: nur in einem eigenen Fenster
 * greift eine Media Query bei 375 px, waehrend daneben 1280 px gelten.
 */
export const BAUKASTEN_PATH = "/plan/baukasten";

export interface Baustein {
  /** Teil der Adresse und Kennung fuer Tests. */
  id: string;
  titel: string;
  /** Was der Baustein zeigt -- steht im Katalog unter dem Titel. */
  zeigt: string;
  /**
   * Hoehe des Rahmens, solange der Inhalt noch nicht gemessen ist -- und fuer
   * Bausteine, die die Hoehe selbst fuellen (die Seitenleiste), die einzige.
   */
  hoehePx: number;
  /**
   * Die Seitenleiste reicht von oben bis unten, der Dialog liegt fest ueber
   * der Seite -- beide haben keine Inhaltshoehe, die sich messen liesse.
   */
  festeHoehe?: boolean;
  /** Was der Rahmen an die Adresse haengt, z.B. den offenen Dialog. */
  zustand?: string;
  /**
   * Die Gestaltungswelt: ohne Angabe die dunkle des Planers, "begleiter" die
   * helle des Begleiters mit ihrem vorgewaehlten Thema (req-091).
   */
  welt?: "begleiter";
}

export const BAUSTEINE: readonly Baustein[] = [
  {
    id: "farben",
    titel: "Farben und Schriftstufen",
    zeigt: "Die Farbwelt des Planers und jede Schriftstufe auf der Karte.",
    hoehePx: 900,
  },
  {
    id: "knoepfe",
    titel: "Knöpfe",
    zeigt: "Gewöhnlich, betont, abgeschaltet, mit Symbol und nur als Symbol.",
    hoehePx: 420,
  },
  {
    id: "felder",
    titel: "Felder",
    zeigt: "Mit Beschriftung, mit Fehlertext, Auswahl und Textbereich.",
    hoehePx: 520,
  },
  {
    id: "umschalter",
    titel: "Umschalter und Filter",
    zeigt: "Segmente, Schalter, Filter und Ankreuzbox.",
    hoehePx: 360,
  },
  {
    id: "kacheln",
    titel: "Kacheln",
    zeigt: "Karte, ruhige Karte und auswählbare Kachel.",
    hoehePx: 460,
  },
  {
    id: "meldungen",
    titel: "Meldungen",
    zeigt: "Hinweis, Erfolg und Fehler.",
    hoehePx: 340,
  },
  {
    id: "pillen",
    titel: "Pillen und Plaketten",
    zeigt: "Zustands-Pillen, betonte Pille und Zähler-Plakette.",
    hoehePx: 200,
  },
  {
    id: "dialog",
    titel: "Dialog",
    zeigt: "Ein offener Dialog mit Rückfrage vor dem Löschen.",
    hoehePx: 420,
    // Der Dialog liegt fest ueber der Seite und hat keine Inhaltshoehe.
    festeHoehe: true,
    zustand: "offen",
  },
  {
    id: "listen",
    titel: "Listen und Tabellen",
    zeigt: "Eine Liste mit Handgriff je Zeile und eine Tabelle.",
    hoehePx: 520,
  },
  {
    id: "fortschritt",
    titel: "Fortschritt",
    zeigt: "Fortschrittsbalken und Schritte.",
    hoehePx: 240,
  },
  {
    id: "seitenleiste-eingeklappt",
    titel: "Seitenleiste eingeklappt",
    zeigt: "Die Seitenleiste des Planers, wie sie beim Laden steht.",
    hoehePx: 720,
    festeHoehe: true,
  },
  {
    id: "seitenleiste-aufgeklappt",
    titel: "Seitenleiste aufgeklappt",
    zeigt: "Dieselbe Leiste mit Beschriftungen, über der Seite liegend.",
    hoehePx: 720,
    festeHoehe: true,
  },
  // Bausteine fuer ganze Seiten (req-091): was die Seiten-Mockups unter
  // delivery/design/baukasten/ brauchten und im Katalog noch fehlte.
  {
    id: "seitenrahmen",
    titel: "Seitenrahmen des Planers",
    zeigt:
      "Leiste, Seitenkopf mit Handgriffen und Spalten -- unter 768 px statt dessen der Hinweis auf den Begleiter.",
    hoehePx: 720,
    festeHoehe: true,
  },
  {
    id: "zeitstrahl",
    titel: "Zeitstrahl eines Tages",
    zeigt:
      "Programmpunkte mit Uhrzeit und Dauer, Fahrt dazwischen, zwei Möglichkeiten zur selben Zeit.",
    hoehePx: 640,
  },
  {
    id: "karte",
    titel: "Karte",
    zeigt: "Platzhalter für die Karte mit den Punkten einer Tagesroute.",
    hoehePx: 380,
  },
  {
    id: "kennzahlen",
    titel: "Kennzahlen und Beträge",
    zeigt: "Kennzahlen in Kacheln und Beträge am Zeilenende, auch fünfstellig.",
    hoehePx: 420,
  },
  {
    id: "leer",
    titel: "Leerer Zustand",
    zeigt: "Was eine Liste zeigt, solange sie leer ist.",
    hoehePx: 260,
  },
  {
    id: "chat",
    titel: "Chat",
    zeigt: "Verlauf mit eigener und fremder Nachricht, Eingabezeile.",
    hoehePx: 420,
  },
  {
    id: "einzelseite",
    titel: "Seite mit einer Spalte",
    zeigt:
      "Schmale und mittlere Spalte in der Mitte, mit Wortmarke -- für Anmeldung, Einladung und Mein Bereich.",
    hoehePx: 520,
  },
  {
    id: "begleiter-rahmen",
    titel: "Begleiter: Rahmen",
    zeigt: "Kopf, Reisetage, rollender Inhalt und die Leiste unten -- hell.",
    hoehePx: 720,
    festeHoehe: true,
    welt: "begleiter",
  },
  {
    id: "begleiter-programm",
    titel: "Begleiter: Programmpunkte",
    zeigt:
      "Programmpunkt mit Uhrzeit, gewählte Möglichkeit, Pillen und Knöpfe.",
    hoehePx: 640,
    welt: "begleiter",
  },
  {
    id: "begleiter-listen",
    titel: "Begleiter: Listen, Beträge und Meldungen",
    zeigt: "Liste mit Betrag, Summe, Meldung, Feld und leerer Zustand.",
    hoehePx: 760,
    welt: "begleiter",
  },
  {
    id: "begleiter-karte",
    titel: "Begleiter: Karte",
    zeigt: "Platzhalter für die Karte mit Punkten und Positionen.",
    hoehePx: 380,
    welt: "begleiter",
  },
  {
    id: "begleiter-chat",
    titel: "Begleiter: Concierge",
    zeigt: "Sprechblasen und Eingabezeile.",
    hoehePx: 360,
    welt: "begleiter",
  },
  {
    id: "begleiter-blatt",
    titel: "Begleiter: Blatt von unten",
    zeigt: "Das Menü „Mehr“ als Blatt über der Seite.",
    hoehePx: 640,
    festeHoehe: true,
    zustand: "offen",
    welt: "begleiter",
  },
];

export function findeBaustein(id: string): Baustein | null {
  return BAUSTEINE.find((baustein) => baustein.id === id) ?? null;
}

/** Die Seite eines Bausteins -- mit seinem Zustand, wenn er einen hat. */
export function bausteinPfad(baustein: Baustein): string {
  const pfad = `${BAUKASTEN_PATH}/${baustein.id}`;
  return baustein.zustand ? `${pfad}?zustand=${baustein.zustand}` : pfad;
}
