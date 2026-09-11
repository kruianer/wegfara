import type { GoogleAbfrage } from "@/lib/google/places-client";
import type { GooglePlace } from "@/lib/google/types";
import type { Poi, PoiPosition } from "./types";
import type { VervollstaendigenFehler } from "./vervollstaendigen";

/**
 * Den Ort eines gespeicherten POI bei Google nachschlagen (req-061) — die
 * Quelle, aus der „Aus Google vervollstaendigen" seine Angaben nimmt.
 */

export type PoiGoogleTreffer =
  | { ok: true; place: GooglePlace }
  | { ok: false; reason: VervollstaendigenFehler };

/** Die zwei austauschbaren Aussenanbindungen des Nachschlagens. */
export interface PoiGoogleDeps {
  /** Holt die Angaben zu einer Kennung. */
  placeDetails: (placeId: string) => Promise<GoogleAbfrage<GooglePlace>>;
  /** Sucht einen Ort ueber seinen Namen, eingegrenzt auf seine Umgebung. */
  findPlace: (
    query: string,
    position?: PoiPosition,
  ) => Promise<GoogleAbfrage<GooglePlace>>;
}

/** Aus der Antwort von Google wird der Ort -- oder der Grund dagegen. */
function ausAbfrage(abfrage: GoogleAbfrage<GooglePlace>): PoiGoogleTreffer {
  if (!abfrage.ok) return { ok: false, reason: abfrage.fehler };
  return abfrage.treffer
    ? { ok: true, place: abfrage.treffer }
    : { ok: false, reason: "ort_nicht_gefunden" };
}

/** Der Suchbegriff zu einem POI: sein Name, dazu wo er liegt. */
export function suchbegriffZuPoi(
  poi: Pick<Poi, "name" | "ort" | "address">,
): string {
  // Die Anschrift grenzt besser ein als die Ortschaft; ohne beide bleibt der
  // Name allein -- die Position schraenkt die Suche ohnehin ein.
  return [poi.name.trim(), (poi.address ?? poi.ort).trim()]
    .filter((teil) => teil.length > 0)
    .join(" ");
}

/**
 * Schlaegt den Ort eines POI bei Google nach (req-061): ueber seine
 * gespeicherte Kennung, sonst ueber Name und Position. Der zweite Weg gilt
 * jedem POI, gleich woher er stammt — von Hand angelegte tragen keine
 * Kennung.
 *
 * Liefert nie eine Ausnahme, sondern immer entweder den Ort oder den Grund
 * des Fehlschlags; das Formular nennt ihn. Ohne Namen wird gar nicht erst
 * gefragt: eine Suche nach "" faende irgendetwas und kostete den Account
 * Geld dafuer.
 */
export async function ortZuPoi(
  poi: Pick<Poi, "name" | "ort" | "address" | "position" | "googlePlaceId">,
  deps: PoiGoogleDeps,
): Promise<PoiGoogleTreffer> {
  if (poi.googlePlaceId) {
    return ausAbfrage(await deps.placeDetails(poi.googlePlaceId));
  }

  const query = suchbegriffZuPoi(poi);
  if (query.length === 0) return { ok: false, reason: "ort_nicht_gefunden" };
  return ausAbfrage(await deps.findPlace(query, poi.position));
}
