import {
  LEERER_POI_FILTER,
  POI_SORTIERUNGEN,
  VORGEWAEHLTE_SORTIERUNG,
  type PoiSortierung,
} from "./listenansicht";
import { DEFAULT_MAP_VISIBLE_STATUSES, isPoiStatus } from "./status-meta";
import { isPoiType } from "./type-meta";
import type { PoiStatus, PoiStatusFilter, PoiTypeFilter } from "./types";

/**
 * Wie die POI-Liste gerade eingestellt ist (bug-052): Typfilter, Statusfilter
 * und Sortierung. Die drei gehoeren zusammen -- sie werden gemeinsam gemerkt
 * und gemeinsam zurueckgesetzt.
 */
export interface PoiListenEinstellungen {
  typeFilter: PoiTypeFilter;
  statusFilter: PoiStatusFilter;
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

function alsTypFilter(wert: unknown): PoiTypeFilter {
  return wert === "alle" || isPoiType(wert) ? wert : "alle";
}

function alsStatusFilter(wert: unknown): PoiStatusFilter {
  return wert === "alle" || isPoiStatus(wert) ? wert : "alle";
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
  schreibe(LISTE_SCHLUESSEL, tripId, einstellungen);
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
