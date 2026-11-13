/**
 * Die Werkzeuge der Lese-Schnittstelle fuer mitdenka (req-104) -- Name,
 * Beschreibung und Eingabeschema, so wie `tools/list` sie nennt. mitdenka
 * baut daraus seinen MCP-Server; wegfara braucht dafuer kein MCP-SDK.
 *
 * Jedes Werkzeug traegt `readOnlyHint: true`: keines aendert etwas. Das ist
 * eine Regel, kein Zuschnitt -- von aussen sitzt niemand in der App und
 * bestaetigt, und ein Modell, das Webseiten liest, darf von dort keine
 * Handlung in die Reise tragen.
 *
 * Eine Account-Kennung nimmt kein Werkzeug entgegen: der Account kommt aus
 * dem Schluessel, nie aus einem Argument.
 */

export const WERKZEUG_NAMEN = [
  "reisen_auflisten",
  "reise_lesen",
  "pois_lesen",
  "tagesplan_lesen",
  "kosten_lesen",
  "ort_suchen",
  "ort_nachschlagen",
  "strecke_berechnen",
] as const;

export type WerkzeugName = (typeof WERKZEUG_NAMEN)[number];

export function istWerkzeugName(name: unknown): name is WerkzeugName {
  return WERKZEUG_NAMEN.some((werkzeug) => werkzeug === name);
}

export interface WerkzeugBeschreibung {
  name: WerkzeugName;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  annotations: { readOnlyHint: true };
}

const NUR_LESEN = { readOnlyHint: true } as const;

const REISE = {
  type: "string",
  description:
    "Die Kennung der Reise, wie reisen_auflisten sie als `kennung` nennt.",
} as const;

const DATUM = {
  type: "string",
  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
  description: "Ein Reisetag als JJJJ-MM-TT.",
} as const;

const STELLE = {
  type: "object",
  properties: {
    lat: { type: "number", minimum: -90, maximum: 90 },
    lng: { type: "number", minimum: -180, maximum: 180 },
  },
  required: ["lat", "lng"],
  additionalProperties: false,
} as const;

export const WERKZEUGE: readonly WerkzeugBeschreibung[] = [
  {
    name: "reisen_auflisten",
    description:
      "Listet alle Reisen: je Reise Kennung, Titel, Zeitraum, Zustand und die Zahl der POIs und Programmpunkte. Die Kennung brauchen die Werkzeuge, die in eine Reise sehen.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
  {
    name: "reise_lesen",
    description:
      "Die Eckdaten einer Reise: Titel, Zeitraum, Hauptort, Zustand, Teilnehmerzahl und die Reisetage mit Datum und Wochentag.",
    inputSchema: {
      type: "object",
      properties: { reise: REISE },
      required: ["reise"],
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
  {
    name: "pois_lesen",
    description:
      "Die POI-Sammlung einer Reise: je Ort Nummer, Name, Ortschaft, Art, Status, Kurztext, Dauer, Kosten, Buchung, Bewertung und an welchen Tagen er eingeplant ist.",
    inputSchema: {
      type: "object",
      properties: { reise: REISE },
      required: ["reise"],
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
  {
    name: "tagesplan_lesen",
    description:
      "Die Programmpunkte eines Reisetags in zeitlicher Folge, je Punkt mit Uhrzeit, Titel, Art und dem Weg zum nächsten.",
    inputSchema: {
      type: "object",
      properties: { reise: REISE, datum: DATUM },
      required: ["reise", "datum"],
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
  {
    name: "kosten_lesen",
    description:
      "Die Kostenaufstellung einer Reise mit Summe gesamt und je Person. Mit `datum` nur die Zeilen dieses Tags.",
    inputSchema: {
      type: "object",
      properties: { reise: REISE, datum: DATUM },
      required: ["reise"],
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
  {
    name: "ort_suchen",
    description:
      "Sucht Orte zu einem Suchbegriff bei Google: je Treffer Name, Anschrift, Position und die Kennung für ort_nachschlagen. Jede Suche zählt gegen eine Tagesgrenze.",
    inputSchema: {
      type: "object",
      properties: {
        suchbegriff: {
          type: "string",
          minLength: 1,
          description: "Wonach gesucht wird, z.B. „Guggenheim Bilbao“.",
        },
      },
      required: ["suchbegriff"],
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
  {
    name: "ort_nachschlagen",
    description:
      "Schlägt einen mit ort_suchen gefundenen Ort bei Google nach: Öffnungszeiten, Bewertung, Webseite und Telefon. Zählt gegen dieselbe Tagesgrenze.",
    inputSchema: {
      type: "object",
      properties: {
        kennung: {
          type: "string",
          minLength: 1,
          description: "Die Kennung des Orts aus ort_suchen.",
        },
      },
      required: ["kennung"],
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
  {
    name: "strecke_berechnen",
    description:
      "Dauer und Entfernung zwischen zwei Stellen, je Verkehrsmittel (Auto, Fahrrad, zu Fuß). Die Stellen als Breite/Länge, z.B. aus ort_suchen.",
    inputSchema: {
      type: "object",
      properties: { von: STELLE, nach: STELLE },
      required: ["von", "nach"],
      additionalProperties: false,
    },
    annotations: NUR_LESEN,
  },
];
