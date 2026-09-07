/**
 * Die Praeferenzen einer Reise (req-057): worauf die Gruppe Wert legt. Sie
 * wirken ausschliesslich auf die KI-Suche nach POIs -- was von Hand oder aus
 * einem Google-Link entsteht, beruehren sie nicht.
 *
 * Alle vier sind freiwillig. Eine Reise ohne Praeferenzen sucht wie vor
 * req-057, nur eben ohne Wissen darueber, was der Gruppe gefaellt.
 */

/** Die acht Interessen zum Ankreuzen, in der Reihenfolge der Anzeige. */
export const INTERESSEN = [
  "kunst_museen",
  "natur_wandern",
  "essen_trinken",
  "strand_baden",
  "geschichte",
  "nachtleben",
  "shopping",
  "mit_kindern",
] as const;

export type Interesse = (typeof INTERESSEN)[number];

/** Wie die Interessen in der Oberflaeche und im Prompt heissen (req-057). */
export const INTERESSE_LABEL: Record<Interesse, string> = {
  kunst_museen: "Kunst & Museen",
  natur_wandern: "Natur & Wandern",
  essen_trinken: "Essen & Trinken",
  strand_baden: "Strand & Baden",
  geschichte: "Geschichte",
  nachtleben: "Nachtleben",
  shopping: "Shopping",
  mit_kindern: "Mit Kindern",
};

/** Hoechstlaenge der beiden Saetze in eigenen Worten (req-057, Funktion). */
export const PRAEFERENZ_TEXT_MAX_LENGTH = 500;

/** Die groesste waehlbare Mindestbewertung -- Google bewertet bis 5. */
export const MAX_MINDESTBEWERTUNG = 5;

/** Die Mindestbewertung einer neuen Reise: keine Einschraenkung (req-057). */
export const DEFAULT_MINDESTBEWERTUNG = 0;

/** Die waehlbaren Mindestbewertungen: 0 bis 5 in Halbschritten. */
export const MINDESTBEWERTUNGEN: number[] = Array.from(
  { length: MAX_MINDESTBEWERTUNG * 2 + 1 },
  (_, i) => i / 2,
);

export interface ReisePraeferenzen {
  /** Die angekreuzten Interessen; leer heisst "keines angekreuzt". */
  interessen: Interesse[];
  /** Worauf die Gruppe Wert legt, in eigenen Worten. Leer ist zulaessig. */
  wertAuf: string;
  /** Was die Gruppe nicht will, in eigenen Worten. Leer ist zulaessig. */
  nichtWollen: string;
  /** 0 bis 5 in Halbschritten; 0 heisst "keine Einschraenkung". */
  mindestbewertung: number;
}

/** Die Praeferenzen einer neu angelegten Reise: keine (req-057). */
export const LEERE_PRAEFERENZEN: ReisePraeferenzen = {
  interessen: [],
  wertAuf: "",
  nichtWollen: "",
  mindestbewertung: DEFAULT_MINDESTBEWERTUNG,
};

export function isInteresse(value: unknown): value is Interesse {
  return typeof value === "string" && INTERESSEN.includes(value as Interesse);
}

/**
 * Liest die angekreuzten Interessen aus der gespeicherten Zeichenkette.
 * Unbekannte Eintraege werden uebergangen -- so faellt ein spaeter
 * entfernter Wert einfach weg, statt die Reise unlesbar zu machen.
 */
export function parseInteressen(raw: string | null | undefined): Interesse[] {
  const teile = (raw ?? "").split(",").map((t) => t.trim());
  return INTERESSEN.filter((interesse) => teile.includes(interesse));
}

/** Die angekreuzten Interessen als Zeichenkette, immer in fester Reihenfolge. */
export function serializeInteressen(interessen: Interesse[]): string {
  return INTERESSEN.filter((i) => interessen.includes(i)).join(",");
}

/**
 * Die Mindestbewertung, wie sie gespeichert wird: auf den naechsten
 * Halbschritt gerundet und in die Grenzen 0 bis 5 gezwungen. Was sich nicht
 * als Zahl lesen laesst, gilt als "keine Einschraenkung".
 */
export function normalisiereMindestbewertung(value: unknown): number {
  const zahl = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(zahl) || zahl <= 0) return DEFAULT_MINDESTBEWERTUNG;
  if (zahl >= MAX_MINDESTBEWERTUNG) return MAX_MINDESTBEWERTUNG;
  return Math.round(zahl * 2) / 2;
}

/** Wie eine Bewertung geschrieben wird: "4,5" -- und "0" ohne Nachkomma. */
export function formatBewertung(wert: number): string {
  return wert === 0 ? "0" : wert.toFixed(1).replace(".", ",");
}

/** Ob ueberhaupt eine Praeferenz gesetzt ist -- sonst sucht die KI wie bisher. */
export function hatPraeferenzen(praeferenzen: ReisePraeferenzen): boolean {
  return (
    praeferenzen.interessen.length > 0 ||
    praeferenzen.wertAuf.trim().length > 0 ||
    praeferenzen.nichtWollen.trim().length > 0 ||
    praeferenzen.mindestbewertung > 0
  );
}
