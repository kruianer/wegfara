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
];

export function findeBaustein(id: string): Baustein | null {
  return BAUSTEINE.find((baustein) => baustein.id === id) ?? null;
}

/** Die Seite eines Bausteins -- mit seinem Zustand, wenn er einen hat. */
export function bausteinPfad(baustein: Baustein): string {
  const pfad = `${BAUKASTEN_PATH}/${baustein.id}`;
  return baustein.zustand ? `${pfad}?zustand=${baustein.zustand}` : pfad;
}
