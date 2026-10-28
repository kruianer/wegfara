import { entsprichtGegendFilter, normalisiereGegend } from "./gegenden";
import { entsprichtPlanFilter } from "./plannable";
import { poiDurationMinutes } from "./estimated-duration";
import { POI_STATUSES, POI_STATUS_LABEL } from "./status-meta";
import { POI_TYPES, POI_TYPE_LABEL } from "./type-meta";
import {
  GEGEND_FILTER_OHNE,
  type Poi,
  type PoiGegendFilter,
  type PoiPlanFilter,
  type PoiStatus,
  type PoiStatusFilter,
  type PoiType,
  type PoiTypeFilter,
  type PoiVerplanung,
} from "./types";

/**
 * Was der Filter der POI-Liste gerade zeigt (req-060). Er wirkt allein auf
 * die Liste: die Karte daneben hat ihre eigene Statusauswahl (req-013), und
 * die KI-Suche in der Anlegezeile darueber nimmt ihn nicht mit.
 *
 * Seit req-098 traegt jedes Feld eine Menge: innerhalb eines Feldes gilt
 * "oder", zwischen den Feldern "und". Ein leeres Feld filtert nicht.
 */
export interface PoiFilter {
  typeFilter: PoiTypeFilter;
  statusFilter: PoiStatusFilter;
  /** Der Filter nach Gegend (req-095) -- leer zeigt jeden POI. */
  gegendFilter: PoiGegendFilter;
  /**
   * Der Filter nach Verplanungsstand (req-083) -- ihn gibt es nur in der
   * POI-Auswahl der Planung (req-099), die POI-Liste hat ihn nicht.
   */
  planFilter?: PoiPlanFilter;
}

/** Die Werte des Feldes „Verplanung", wie sie im Blatt stehen (req-099). */
export const POI_VERPLANUNGEN: PoiVerplanung[] = ["unverplant", "verplant"];

export const POI_VERPLANUNG_LABEL: Record<PoiVerplanung, string> = {
  unverplant: "Noch unverplant",
  verplant: "Mindestens einmal",
};

/** Die Vorwahl beim Oeffnen: gefiltert wird zunaechst nichts. */
export const LEERER_POI_FILTER: PoiFilter = {
  typeFilter: [],
  statusFilter: [],
  gegendFilter: [],
};

/**
 * Ein Text zum Vergleichen: klein, ohne Akzente -- wer "san sebastian"
 * tippt, soll "San Sebastián" finden.
 */
function zumVergleich(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de");
}

/**
 * Ob ein POI zum Suchbegriff passt (req-098): gesucht wird in Name und Ort.
 * Ein leerer Begriff laesst jeden durch.
 */
export function passtZurSuche(poi: Poi, suche: string): boolean {
  const begriff = zumVergleich(suche.trim());
  if (begriff.length === 0) return true;
  return [poi.name, poi.ort ?? ""].some((text) =>
    zumVergleich(text).includes(begriff),
  );
}

/**
 * Die POIs, die unter diesem Filter in der Liste stehen — in der Reihenfolge,
 * in der sie hereinkommen. Sortiert wird danach (siehe sortierePois).
 *
 * Der Suchbegriff (req-098) wirkt zusaetzlich zu den Filtern, nicht statt
 * ihrer. Gefiltert wird nur hier -- es gibt keine zweite Filterlogik. Die
 * POI-Auswahl der Planung (req-099) nutzt dieselbe und reicht dafuer mit,
 * wie oft jeder POI verplant ist.
 */
export function gefiltertePois(
  pois: Poi[],
  filter: PoiFilter,
  suche = "",
  planCounts: Map<string, number> = new Map(),
): Poi[] {
  return pois.filter(
    (poi) =>
      entsprichtPlanFilter(poi, planCounts, filter.planFilter ?? []) &&
      (filter.typeFilter.length === 0 ||
        filter.typeFilter.includes(poi.type)) &&
      (filter.statusFilter.length === 0 ||
        filter.statusFilter.includes(poi.status)) &&
      entsprichtGegendFilter(poi, filter.gegendFilter) &&
      passtZurSuche(poi, suche),
  );
}

/**
 * Wie viele Filter gesetzt sind (req-098) -- gezaehlt werden die Felder, in
 * denen etwas gewaehlt ist, nicht die Werte: "Fix oder Alternative" ist ein
 * Filter. Diese Zahl steht am Filter-Knopf.
 */
export function anzahlGesetzterFilter(filter: PoiFilter): number {
  return [
    filter.planFilter ?? [],
    filter.statusFilter,
    filter.gegendFilter,
    filter.typeFilter,
  ].filter((feld) => feld.length > 0).length;
}

/**
 * Die Felder des Filters (req-098) -- "verplanung" gibt es nur in der
 * POI-Auswahl der Planung (req-099).
 */
export type PoiFilterFeld = "verplanung" | "status" | "gegend" | "typ";

/** Ein gesetzter Wert, wie er als Chip im Kopf der Liste steht (req-098). */
export interface PoiFilterChip {
  feld: PoiFilterFeld;
  wert: string;
  label: string;
}

/** Wie ein Eintrag des Gegend-Filters heisst -- "ohne" ausgeschrieben. */
export function gegendFilterLabel(eintrag: string): string {
  return eintrag === GEGEND_FILTER_OHNE ? "ohne" : eintrag;
}

/**
 * Die gesetzten Werte als Chips, in der Reihenfolge der Felder im Blatt
 * (Verplanung, Status, Gegend, Typ) und innerhalb eines Feldes in der
 * Reihenfolge seiner Auswahl -- so steht ein Chip immer an derselben Stelle.
 */
export function filterChips(filter: PoiFilter): PoiFilterChip[] {
  return [
    ...POI_VERPLANUNGEN.filter((stand) =>
      (filter.planFilter ?? []).includes(stand),
    ).map(
      (stand): PoiFilterChip => ({
        feld: "verplanung",
        wert: stand,
        label: POI_VERPLANUNG_LABEL[stand],
      }),
    ),
    ...POI_STATUSES.filter((status) =>
      filter.statusFilter.includes(status),
    ).map(
      (status): PoiFilterChip => ({
        feld: "status",
        wert: status,
        label: POI_STATUS_LABEL[status],
      }),
    ),
    ...filter.gegendFilter.map(
      (gegend): PoiFilterChip => ({
        feld: "gegend",
        wert: gegend,
        label: gegendFilterLabel(gegend),
      }),
    ),
    ...POI_TYPES.filter((typ) => filter.typeFilter.includes(typ)).map(
      (typ): PoiFilterChip => ({
        feld: "typ",
        wert: typ,
        label: POI_TYPE_LABEL[typ],
      }),
    ),
  ];
}

/** Fuegt einen Wert hinzu oder nimmt ihn heraus -- die Pille im Blatt. */
function umschalten<T>(menge: T[], wert: T): T[] {
  return menge.includes(wert)
    ? menge.filter((vorhanden) => vorhanden !== wert)
    : [...menge, wert];
}

/**
 * Der Filter mit einem Wert mehr oder weniger in einem Feld (req-098) -- ein
 * Tipp auf die Pille im Blatt. Die uebrigen Felder bleiben, wie sie sind.
 */
export function filterUmschalten(
  filter: PoiFilter,
  feld: PoiFilterFeld,
  wert: string,
): PoiFilter {
  switch (feld) {
    case "verplanung":
      return {
        ...filter,
        planFilter: umschalten(filter.planFilter ?? [], wert as PoiVerplanung),
      };
    case "status":
      return {
        ...filter,
        statusFilter: umschalten(filter.statusFilter, wert as PoiStatus),
      };
    case "typ":
      return {
        ...filter,
        typeFilter: umschalten(filter.typeFilter, wert as PoiType),
      };
    case "gegend": {
      // Gross- und Kleinschreibung entscheiden bei der Gegend nicht.
      const sauber = normalisiereGegend(wert) ?? wert;
      const ohne = filter.gegendFilter.filter(
        (eintrag) =>
          eintrag.localeCompare(sauber, "de", { sensitivity: "accent" }) !== 0,
      );
      return {
        ...filter,
        gegendFilter:
          ohne.length < filter.gegendFilter.length
            ? ohne
            : [...filter.gegendFilter, sauber],
      };
    }
  }
}

/** Der Filter ohne diesen einen Wert -- das Kreuz am Chip (req-098). */
export function ohneFilterwert(
  filter: PoiFilter,
  chip: Pick<PoiFilterChip, "feld" | "wert">,
): PoiFilter {
  const gewaehlt =
    chip.feld === "verplanung"
      ? (filter.planFilter ?? [])
      : chip.feld === "status"
        ? filter.statusFilter
        : chip.feld === "typ"
          ? filter.typeFilter
          : filter.gegendFilter;
  if (!(gewaehlt as string[]).includes(chip.wert)) return filter;
  return filterUmschalten(filter, chip.feld, chip.wert);
}

/** „„a“ oder „b“" -- die Werte eines Feldes in der Leermeldung. */
function oderListe(werte: string[]): string {
  return werte.map((wert) => `„${wert}“`).join(" oder ");
}

/**
 * Warum die Liste leer ist, obwohl die Reise POIs hat (req-098): die
 * gesetzten Filter und der Suchbegriff, in einem Satz -- etwa „Status „Nein“
 * und Gegend „RIO“ kommen zusammen nicht vor." Mit Mehrfachwahl widersprechen
 * sich Filter leichter; dann soll man sehen, welche es sind.
 */
export function leereListeGrund(filter: PoiFilter, suche = ""): string {
  const chips = filterChips(filter);
  const teile: string[] = [];
  const begriff = suche.trim();
  if (begriff.length > 0) teile.push(`Die Suche „${begriff}“`);
  const felder: [PoiFilterFeld, string][] = [
    ["verplanung", "Verplanung"],
    ["status", "Status"],
    ["gegend", "Gegend"],
    ["typ", "Typ"],
  ];
  let werte = 0;
  for (const [feld, name] of felder) {
    const labels = chips
      .filter((chip) => chip.feld === feld)
      .map((chip) => chip.label);
    if (labels.length === 0) continue;
    werte += labels.length;
    teile.push(`${name} ${oderListe(labels)}`);
  }

  if (teile.length === 0) return "Kein POI passt.";
  const satz = teile.join(" und ");
  if (teile.length > 1) return `${satz} kommen zusammen nicht vor.`;
  if (begriff.length > 0) return `${satz} findet nichts in Name und Ort.`;
  return `${satz} ${werte > 1 ? "kommen" : "kommt"} nicht vor.`;
}

/**
 * Wonach sich die POI-Liste ordnen laesst (req-060). "dauer" gibt es nur in
 * der POI-Auswahl der Planung (req-099) -- in der Liste steht die Dauer
 * nicht.
 */
export type PoiSortierung =
  | "nummer"
  | "name"
  | "status"
  | "bewertung"
  | "dauer";

/** Die Reihenfolge, in der die Sortierungen zur Wahl stehen. */
export const POI_SORTIERUNGEN: PoiSortierung[] = [
  "nummer",
  "name",
  "status",
  "bewertung",
];

/**
 * Die Ordnungen der POI-Auswahl in der Planung (req-099): dieselben vier und
 * als fuenfte die Dauer -- wer eine Luecke von 45 Minuten fuellen will, sucht
 * den kurzen POI.
 */
export const POI_AUSWAHL_SORTIERUNGEN: PoiSortierung[] = [
  ...POI_SORTIERUNGEN,
  "dauer",
];

/**
 * Die Vorwahl: nach Nummer. Sie ist die Ordnung, in der die POIs entstanden
 * sind, und die Nummer bleibt fest -- ueber sie wird in der Gruppe und auf
 * der Karte gesprochen (req-013).
 */
export const VORGEWAEHLTE_SORTIERUNG: PoiSortierung = "nummer";

export const POI_SORTIERUNG_LABEL: Record<PoiSortierung, string> = {
  nummer: "Nummer",
  name: "Name",
  status: "Status",
  bewertung: "Bewertung",
  dauer: "Dauer",
};

/**
 * In welche Richtung eine Ordnung sortiert (req-098) -- das stand bis dahin
 * nirgends. Umschalten laesst sie sich nicht: jede Ordnung hat die Richtung,
 * die man meint, wenn man sie waehlt. Bei der Nummer nennt sie die hoechste
 * vergebene, wie „1 → 32".
 */
export function sortierRichtung(
  sortierung: PoiSortierung,
  pois: Pick<Poi, "number">[],
): string {
  switch (sortierung) {
    case "name":
      return "A → Z";
    case "status":
      return `${POI_STATUS_LABEL[POI_STATUSES[0]]} zuerst`;
    case "bewertung":
      return "beste zuerst";
    case "dauer":
      return "kürzeste zuerst";
    default: {
      const hoechste = Math.max(1, ...pois.map((poi) => poi.number));
      return `1 → ${hoechste}`;
    }
  }
}

/** Wie weit vorn ein Status steht: Fix zuerst, Nein zuletzt. */
function statusRang(poi: Poi): number {
  return POI_STATUSES.indexOf(poi.status);
}

/**
 * Die POIs in der gewaehlten Reihenfolge (req-060) -- als neue Liste; die
 * hereingereichte bleibt unberuehrt.
 *
 * Bei gleichem Wert entscheidet die Nummer: so steht die Liste bei jedem
 * Rendern gleich da, und die Ordnung ist die, die alle kennen. Bei
 * „Bewertung" stehen POIs ohne Bewertung am Ende -- keine Bewertung ist
 * etwas anderes als eine schlechte.
 */
export function sortiertePois(pois: Poi[], sortierung: PoiSortierung): Poi[] {
  const nachNummer = (a: Poi, b: Poi) => a.number - b.number;

  return [...pois].sort((a, b) => {
    switch (sortierung) {
      case "name":
        return a.name.localeCompare(b.name, "de") || nachNummer(a, b);
      case "status":
        return statusRang(a) - statusRang(b) || nachNummer(a, b);
      case "bewertung": {
        const noteA = typeof a.bewertung === "number" ? a.bewertung : null;
        const noteB = typeof b.bewertung === "number" ? b.bewertung : null;
        // Ohne Bewertung ans Ende, untereinander wieder nach Nummer.
        if (noteA === null || noteB === null) {
          if (noteA === noteB) return nachNummer(a, b);
          return noteA === null ? 1 : -1;
        }
        // Die beste zuerst -- danach sucht, wer nach Bewertung sortiert.
        return noteB - noteA || nachNummer(a, b);
      }
      case "dauer":
        // Die kuerzeste zuerst -- mit derselben Dauer, die auf der Karte
        // steht und den Block auf dem Zeitstrahl bemisst (req-099).
        return (
          poiDurationMinutes(a) - poiDurationMinutes(b) || nachNummer(a, b)
        );
      default:
        return nachNummer(a, b);
    }
  });
}
