import {
  LEERER_POI_FILTER,
  POI_SORTIERUNGEN,
  VORGEWAEHLTE_SORTIERUNG,
  type PoiSortierung,
} from "./listenansicht";
import { DEFAULT_MAP_VISIBLE_STATUSES, isPoiStatus } from "./status-meta";
import { isPoiType } from "./type-meta";
import type {
  PoiGegendFilter,
  PoiPlanFilter,
  PoiStatus,
  PoiStatusFilter,
  PoiTypeFilter,
} from "./types";

/**
 * Wie die POI-Liste gerade eingestellt ist (bug-052): Typfilter, Statusfilter
 * und Sortierung. Die drei gehoeren zusammen -- sie werden gemeinsam gemerkt
 * und gemeinsam zurueckgesetzt.
 *
 * Der Suchbegriff (req-098) gehoert bewusst nicht dazu: kaeme man nach einer
 * Woche zurueck und die Liste zeigte 7 von 32 wegen eines vergessenen
 * Suchworts, saehe man nicht, warum -- gesetzte Filter sagen es die Chips.
 */
export interface PoiListenEinstellungen {
  typeFilter: PoiTypeFilter;
  statusFilter: PoiStatusFilter;
  /** Der Filter nach Gegend (req-095). */
  gegendFilter: PoiGegendFilter;
  sortierung: PoiSortierung;
}

/** Die unbefangene Liste: nichts gefiltert, nach Nummer geordnet (req-060). */
export const VORGEWAEHLTE_LISTEN_EINSTELLUNGEN: PoiListenEinstellungen = {
  ...LEERER_POI_FILTER,
  sortierung: VORGEWAEHLTE_SORTIERUNG,
};

/**
 * Die Ablage haengt an der Sitzung, nicht am Geraet (bug-052): Filter und
 * Sortierung sind Arbeitsstand, keine Einstellung. So ueberdauern sie den
 * Wechsel des Planer-Bereichs und den kurzen Sprung in eine andere App, bei
 * dem die Ansicht neu aufgebaut wird -- beim Neustart der App faengt die
 * Liste wieder unbefangen an.
 *
 * Je Reise ein eigener Schluessel: damit setzt ein Reisewechsel sie zurueck,
 * und wer zur vorigen Reise zurueckkehrt, findet seine Liste wieder so vor,
 * wie er sie verlassen hat.
 */
const LISTE_SCHLUESSEL = "wegfara.plan.poi-liste";

/**
 * Die Statusauswahl der Karte (req-013) liegt aus demselben Grund in
 * derselben Ablage: sie verschwand beim Sprung in eine andere App ebenso
 * (bug-052, Notes). Sie ist von den Filtern der Liste getrennt -- die Karte
 * behaelt ihre eigene Auswahl.
 */
const KARTE_SCHLUESSEL = "wegfara.plan.poi-karte";

/**
 * Der Filter der POI-Auswahl in der Planung (req-083) liegt aus demselben
 * Grund in derselben Ablage: er soll den Wechsel des Reisetages und des
 * Planer-Bereichs ueberdauern, faellt aber beim Reisewechsel und beim
 * Neustart der App auf "Alle" zurueck (wie der Filter der POI-Liste,
 * bug-052).
 */
const PLANUNG_SCHLUESSEL = "wegfara.plan.planung-filter";

/**
 * Die Sitzungsablage, sofern es sie gibt. Serverseitig gibt es kein `window`,
 * und ein Browser darf sie verweigern -- dann bleibt es beim Vorgabewert,
 * statt dass der Planer stehenbleibt.
 */
function ablage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function lies(schluessel: string, tripId: string): unknown {
  const store = ablage();
  if (!store) return null;
  const roh = store.getItem(`${schluessel}.${tripId}`);
  if (roh === null) return null;
  try {
    return JSON.parse(roh);
  } catch {
    // Ein beschaedigter Eintrag ist kein Grund fuer einen Fehler: die Liste
    // faengt dann eben unbefangen an.
    return null;
  }
}

function schreibe(schluessel: string, tripId: string, wert: unknown): void {
  const store = ablage();
  if (!store) return;
  try {
    store.setItem(`${schluessel}.${tripId}`, JSON.stringify(wert));
  } catch {
    // Volle oder gesperrte Ablage: gemerkt wird dann nichts, bedienbar
    // bleibt der Planer trotzdem.
  }
}

/**
 * Ein gemerkter Filter als Menge (req-098). Bis dahin trug die Ablage einen
 * einzelnen Wert oder "alle": der einzelne wird zur Menge mit einem Element,
 * "alle" zur leeren Menge -- niemand verliert seine Ansicht. Was nicht
 * (mehr) gilt, faellt heraus, doppelte Eintraege auch.
 */
function alsMenge<T extends string>(
  wert: unknown,
  gueltig: (eintrag: unknown) => eintrag is T,
): T[] {
  const eintraege = Array.isArray(wert) ? wert : [wert];
  return eintraege.filter(
    (eintrag, i): eintrag is T =>
      eintrag !== "alle" &&
      gueltig(eintrag) &&
      eintraege.indexOf(eintrag) === i,
  );
}

function alsTypFilter(wert: unknown): PoiTypeFilter {
  return alsMenge(wert, isPoiType);
}

function alsStatusFilter(wert: unknown): PoiStatusFilter {
  return alsMenge(wert, isPoiStatus);
}

/**
 * Die Gegend ist ein freier Name, kein Wert aus einer Liste: geprueft wird
 * nur, dass es Text ist. Ob es die Gegend noch gibt, entscheidet der
 * Aufrufer (geltenderGegendFilter) -- sie kann entfallen sein, seit die
 * Einstellung gespeichert wurde (req-095).
 */
function alsGegendFilter(wert: unknown): PoiGegendFilter {
  return alsMenge(
    wert,
    (eintrag): eintrag is string =>
      typeof eintrag === "string" && eintrag.length > 0,
  );
}

function alsSortierung(wert: unknown): PoiSortierung {
  return POI_SORTIERUNGEN.includes(wert as PoiSortierung)
    ? (wert as PoiSortierung)
    : VORGEWAEHLTE_SORTIERUNG;
}

/**
 * Was in der Ablage steht, Feld fuer Feld geprueft: ein unbekannter Typ, ein
 * unbekannter Status oder eine unbekannte Sortierung faellt auf den
 * Vorgabewert zurueck -- aus einem alten Eintrag darf keine Liste entstehen,
 * die nichts mehr zeigt.
 */
export function listenEinstellungenAus(roh: unknown): PoiListenEinstellungen {
  if (typeof roh !== "object" || roh === null) {
    return VORGEWAEHLTE_LISTEN_EINSTELLUNGEN;
  }
  const wert = roh as Record<string, unknown>;
  return {
    typeFilter: alsTypFilter(wert.typeFilter),
    statusFilter: alsStatusFilter(wert.statusFilter),
    gegendFilter: alsGegendFilter(wert.gegendFilter),
    sortierung: alsSortierung(wert.sortierung),
  };
}

/** Wie die Liste dieser Reise zuletzt in dieser Sitzung stand (bug-052). */
export function ladeListenEinstellungen(
  tripId: string,
): PoiListenEinstellungen {
  return listenEinstellungenAus(lies(LISTE_SCHLUESSEL, tripId));
}

export function speichereListenEinstellungen(
  tripId: string,
  einstellungen: PoiListenEinstellungen,
): void {
  // Feld fuer Feld: was sonst noch am Objekt haengt, etwa ein Suchbegriff,
  // wird nicht gemerkt (req-098).
  const { typeFilter, statusFilter, gegendFilter, sortierung } = einstellungen;
  schreibe(LISTE_SCHLUESSEL, tripId, {
    typeFilter,
    statusFilter,
    gegendFilter,
    sortierung,
  });
}

/**
 * Die gemerkte Statusauswahl der Karte. Eine leere Auswahl bleibt leer -- wer
 * alle Haken entfernt, will eine leere Karte sehen; nur ein fehlender oder
 * unbrauchbarer Eintrag faellt auf die Vorauswahl zurueck.
 */
export function kartenStatusAus(roh: unknown): PoiStatus[] {
  if (!Array.isArray(roh)) return DEFAULT_MAP_VISIBLE_STATUSES;
  return roh.filter(isPoiStatus);
}

export function ladeKartenStatus(tripId: string): PoiStatus[] {
  return kartenStatusAus(lies(KARTE_SCHLUESSEL, tripId));
}

export function speichereKartenStatus(
  tripId: string,
  statuses: PoiStatus[],
): void {
  schreibe(KARTE_SCHLUESSEL, tripId, statuses);
}

function alsPlanFilter(wert: unknown): PoiPlanFilter {
  return wert === "unverplant" || wert === "verplant" ? wert : "alle";
}

/** Der gemerkte Filter der POI-Auswahl dieser Reise (req-083). */
export function ladePlanFilter(tripId: string): PoiPlanFilter {
  return alsPlanFilter(lies(PLANUNG_SCHLUESSEL, tripId));
}

export function speicherePlanFilter(
  tripId: string,
  filter: PoiPlanFilter,
): void {
  schreibe(PLANUNG_SCHLUESSEL, tripId, filter);
}

/**
 * Der gemerkte Gegend-Filter der POI-Auswahl in der Planung (req-095). Er
 * liegt neben dem Verplanungs-Filter und aus demselben Grund (bug-052):
 * Arbeitsstand, der den Wechsel des Bereichs ueberdauert.
 *
 * Geprueft wird nur, dass es Text ist -- eine Gegend ist ein freier Name.
 * Ob sie noch vorkommt, entscheidet der Aufrufer
 * (geltenderGegendFilter): sie kann entfallen sein, seit der Filter
 * gespeichert wurde. Ein Eintrag von vor req-098 (ein Name oder "alle") wird
 * zur Menge.
 */
const PLANUNG_GEGEND_SCHLUESSEL = "wegfara.plan.poi-auswahl-gegend";

export function ladeGegendFilter(tripId: string): PoiGegendFilter {
  return alsGegendFilter(lies(PLANUNG_GEGEND_SCHLUESSEL, tripId));
}

export function speichereGegendFilter(
  tripId: string,
  filter: PoiGegendFilter,
): void {
  schreibe(PLANUNG_GEGEND_SCHLUESSEL, tripId, filter);
}

/**
 * Ob die POI-Auswahl der Planung zugeklappt ist (req-099) -- je Reise
 * gemerkt wie die Filter (bug-052): der Wechsel des Reisetages und des
 * Bereichs laesst sie, wie man sie verlassen hat; eine andere Reise und ein
 * Neustart der App beginnen offen.
 */
const PLANUNG_ZU_SCHLUESSEL = "wegfara.plan.poi-auswahl-zu";

export function ladeAuswahlZugeklappt(tripId: string): boolean {
  // Nur ein ausdrueckliches "zu" klappt zu -- ein beschaedigter Eintrag
  // laesst die Auswahl offen, aus ihr wird geplant.
  return lies(PLANUNG_ZU_SCHLUESSEL, tripId) === true;
}

export function speichereAuswahlZugeklappt(
  tripId: string,
  zugeklappt: boolean,
): void {
  schreibe(PLANUNG_ZU_SCHLUESSEL, tripId, zugeklappt);
}
