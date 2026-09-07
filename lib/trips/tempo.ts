/**
 * Das Reisetempo einer Reise (req-056): wie voll ein Tag geplant wird und
 * wie viel Gleichartiges an einem Tag erlaubt ist.
 *
 * Es wirkt ausschliesslich auf die KI-Planung (req-056, Out of Scope) -- von
 * Hand verplant der Reiseleiter POIs weiterhin, wie er will. Das Tempo steht
 * deshalb bei den Eckdaten der Reise und nicht am Zeitstrahl.
 */

/** Genau drei Tempi, in der Reihenfolge, in der sie zur Auswahl stehen. */
export const REISETEMPI = ["entspannt", "ausgewogen", "dicht"] as const;

export type Reisetempo = (typeof REISETEMPI)[number];

/** Wie die Tempi in der Oberflaeche heissen (req-056, Funktion). */
export const REISETEMPO_LABEL: Record<Reisetempo, string> = {
  entspannt: "Entspannt",
  ausgewogen: "Ausgewogen",
  dicht: "Dicht",
};

/** Das Tempo einer neu angelegten Reise (req-056). */
export const DEFAULT_REISETEMPO: Reisetempo = "ausgewogen";

/** Was ein Tempo fuer einen geplanten Tag bedeutet (req-056, Tabelle). */
export interface TempoRegeln {
  /** Wie lange ein geplanter Tag hoechstens dauert, in Stunden. */
  tageslaengeStunden: number;
  /**
   * Hoechstens so viele POIs desselben Typs an einem Tag. Restaurant und
   * Hotel zaehlen nicht mit -- sie gehoeren zum Tagesablauf.
   */
  maxGleicheTypen: number;
}

export const REISETEMPO_REGELN: Record<Reisetempo, TempoRegeln> = {
  entspannt: { tageslaengeStunden: 6, maxGleicheTypen: 2 },
  ausgewogen: { tageslaengeStunden: 10, maxGleicheTypen: 3 },
  dicht: { tageslaengeStunden: 12, maxGleicheTypen: 4 },
};

/** Ob der Wert eines der drei Tempi ist -- die Pruefung an der Grenze. */
export function isReisetempo(value: unknown): value is Reisetempo {
  return typeof value === "string" && REISETEMPI.includes(value as Reisetempo);
}

/** Was in der Auswahlliste steht: Name und die beiden Zahlen dahinter. */
export function reisetempoOptionLabel(tempo: Reisetempo): string {
  const { tageslaengeStunden, maxGleicheTypen } = REISETEMPO_REGELN[tempo];
  return `${REISETEMPO_LABEL[tempo]} — ${tageslaengeStunden} Stunden am Tag, höchstens ${maxGleicheTypen} gleiche POI-Typen`;
}
