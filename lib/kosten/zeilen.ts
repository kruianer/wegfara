import type { Activity } from "../activities/types";
import type { Poi } from "../pois/types";
import type { Trip } from "../trips/types";
import { tripDays } from "../trips/days";
import { formatDayChipDate } from "../trips/format";
import { poiBuchung, VORGEGEBENE_BUCHUNG } from "../pois/buchung";
import type { GespeicherteKostenzeile, Kostenzeile } from "./types";

/**
 * Die Zeilen der Kostenplanung (req-062). Sie werden bei jeder Anzeige neu
 * aus dem Zeitstrahl gebildet: je Programmpunkt eine Zeile. Liegt derselbe
 * POI an zwei Tagen, entstehen zwei Zeilen -- zweimal essen kostet zweimal.
 *
 * Preis und Buchungsstatz stehen am POI (req-061) und werden von dort
 * gelesen, nicht kopiert: ein am POI geaenderter Preis steht sofort auch
 * hier, und ein aus dem Plan entfernter und erneut verplanter POI bringt
 * seinen Preis wieder mit.
 */

/** Der Reisetag eines Programmpunkts, z.B. "Tag 2 · Mi 22.07.". */
export function reisetagText(
  trip: Pick<Trip, "startDate" | "endDate">,
  startAt: string,
): string {
  const datum = startAt.slice(0, 10);
  const tage = tripDays(trip);
  const index = tage.findIndex((tag) => tag.date === datum);
  const gezeigt =
    `${tage[index]?.weekday ?? ""} ${formatDayChipDate(datum)}`.trim();
  // Ein Programmpunkt ausserhalb des Reisezeitraums traegt keine Tagesnummer
  // -- geraten wird sie nicht.
  return index < 0 ? gezeigt : `Tag ${index + 1} · ${gezeigt}`;
}

/** Preis mal Anzahl; ohne Preis gibt es keine Gesamtsumme. */
export function gesamtCent(
  preisCent: number | null,
  anzahl: number,
): number | null {
  return preisCent === null ? null : preisCent * anzahl;
}

export function kostenzeilen({
  trip,
  activities,
  pois,
  gespeicherte,
  teilnehmerzahl,
}: {
  trip: Pick<Trip, "id" | "startDate" | "endDate">;
  /** Die Programmpunkte dieser Reise -- in beliebiger Reihenfolge. */
  activities: Activity[];
  /** Die POIs dieser Reise; an ihnen stehen Preis und Buchungsstatus. */
  pois: Poi[];
  /** Was zu den Zeilen dieser Reise gespeichert ist (siehe types.ts). */
  gespeicherte: GespeicherteKostenzeile[];
  /** Womit die Anzahl vorbelegt ist, solange sie niemand geaendert hat. */
  teilnehmerzahl: number;
}): Kostenzeile[] {
  const poiById = new Map(pois.map((poi) => [poi.id, poi]));
  const zuActivity = new Map(
    gespeicherte
      .filter((zeile) => zeile.activityId !== null)
      .map((zeile) => [zeile.activityId as string, zeile]),
  );

  const ausDemPlan = [...activities]
    .sort(
      (a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id),
    )
    .map((activity) => {
      const poi = activity.poiId ? poiById.get(activity.poiId) : undefined;
      const gespeichert = zuActivity.get(activity.id) ?? null;
      // Steht ein POI dahinter, ist er die Wahrheit fuer Preis und
      // Buchungsstatus (req-061). Ein Programmpunkt ohne POI (etwa der
      // Ausgangspunkt der Anreise, req-018) hat nichts, woran beides stehen
      // koennte -- fuer ihn gilt, was an der Zeile gespeichert ist.
      const preisCent = poi
        ? (poi.kostenCent ?? null)
        : (gespeichert?.preisCent ?? null);
      // Solange niemand sie von Hand gesetzt hat, zieht die Anzahl mit der
      // Teilnehmerzahl nach (req-062).
      const anzahl = gespeichert?.anzahl ?? teilnehmerzahl;
      return {
        id: activity.id,
        herkunft: "programmpunkt" as const,
        activityId: activity.id,
        poiId: poi?.id ?? null,
        // Ohne POI traegt die Zeile den Titel des Programmpunkts -- einen
        // POI, von dem der Name kommen koennte, hat er nicht.
        bezeichnung: poi?.name ?? activity.title,
        reisetag: reisetagText(trip, activity.startAt),
        preisCent,
        anzahl,
        gesamtCent: gesamtCent(preisCent, anzahl),
        buchung: poi
          ? poiBuchung(poi)
          : (gespeichert?.buchung ?? VORGEGEBENE_BUCHUNG),
      };
    });

  // Die manuellen Zeilen stehen unter denen aus dem Plan -- alles ohne
  // Programmpunkt: Maut, Parkgebuehren, Sprit (req-062). Sie tragen keinen
  // Reisetag: sie liegen an keinem.
  const manuelle = gespeicherte
    .filter((zeile) => zeile.activityId === null)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    )
    .map((zeile) => {
      const preisCent = zeile.preisCent;
      const anzahl = zeile.anzahl ?? teilnehmerzahl;
      return {
        id: zeile.id,
        herkunft: "manuell" as const,
        activityId: null,
        poiId: null,
        bezeichnung: zeile.bezeichnung ?? "",
        reisetag: null,
        preisCent,
        anzahl,
        gesamtCent: gesamtCent(preisCent, anzahl),
        buchung: zeile.buchung ?? VORGEGEBENE_BUCHUNG,
      };
    });

  return [...ausDemPlan, ...manuelle];
}
