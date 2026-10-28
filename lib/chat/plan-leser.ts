import type { Queryable } from "../db/queryable";
import { findTrip } from "../db/trips";
import { listPois } from "../db/pois";
import { listActivities } from "../db/activities";
import { listTransfers } from "../db/transfers";
import { listKostenzeilen } from "../db/kostenzeilen";
import { listTripParticipants } from "../db/trip-participants";
import type {
  AiPlanLeser,
  PlanAuskunft,
  PlanWerkzeug,
} from "../ai/chat-client";
import type { Activity } from "../activities/types";
import type { Trip } from "../trips/types";
import { tripDays } from "../trips/days";
import { TRIP_STATE_LABEL } from "../trips/state";
import { POI_TYPE_LABEL } from "../pois/type-meta";
import { POI_STATUS_LABEL } from "../pois/status-meta";
import { POI_BUCHUNG_LABEL, poiBuchung } from "../pois/buchung";
import { ACTIVITY_TYPE_LABEL } from "../activities/type-meta";
import { TRANSFER_MODE_LABEL } from "../transfers/type-meta";
import { kostenzeilen } from "../kosten/zeilen";
import { kostenSummen } from "../kosten/summen";
import { formatEuro } from "../expenses/money";

/**
 * Die lesenden Werkzeuge des Chats (req-093): was das Modell aus der
 * geoeffneten Reise erfragen kann.
 *
 * Die Reise steht beim Erzeugen fest -- sie kommt vom Server, aus der gegen
 * den Account geprueften Anfrage (`/api/chat?tripId=…`). Was das Modell in
 * einem Aufruf mitgibt, wird nur auf einen Reisetag hin gelesen; eine
 * Reisekennung darin wird weder verwendet noch geprueft (req-024: der
 * Mandant kommt aus der Anmeldung, nie aus der Anfrage -- und das Modell kann
 * durch eine gelesene Webseite beeinflusst sein, req-092).
 *
 * Gelesen wird ueber die vorhandenen Lesefunktionen, eingeschraenkt auf die
 * Reise in der Abfrage selbst. Was zurueckgeht, wird Feld fuer Feld
 * zusammengestellt: keine Langtexte, keine Kennungen, keine Fotos, keine
 * Namen oder Adressen von Teilnehmern, keine Zugangsschluessel, keine
 * Bankverbindung, keine Dokumente. Ein neues Feld in der Datenbank wandert so
 * nie ungefragt ins Modell.
 */

const WOCHENTAG: Record<string, string> = {
  Mo: "Montag",
  Di: "Dienstag",
  Mi: "Mittwoch",
  Do: "Donnerstag",
  Fr: "Freitag",
  Sa: "Samstag",
  So: "Sonntag",
};

/** Die Reisetage mit Nummer, Datum und Wochentag -- so fragt man nach ihnen. */
function reisetage(trip: Pick<Trip, "startDate" | "endDate">) {
  return tripDays(trip).map((tag, index) => ({
    tag: index + 1,
    datum: tag.date,
    wochentag: WOCHENTAG[tag.weekday] ?? tag.weekday,
  }));
}

/** Die Uhrzeit eines Zeitpunkts ohne Zeitzone (YYYY-MM-DDTHH:mm). */
function uhrzeit(dateTime: string): string {
  return dateTime.slice(11, 16);
}

/** Ein Betrag in Cent als Text -- ohne Betrag steht nichts. */
function euro(cent: number | null | undefined): string | null {
  return cent === null || cent === undefined ? null : formatEuro(cent);
}

/**
 * Der Reisetag, nach dem das Modell fragt. Gelesen wird ausschliesslich das
 * Feld `datum` -- alles andere in der Eingabe bleibt unbeachtet.
 */
function datumAus(eingabe: unknown): string | null {
  if (typeof eingabe !== "object" || eingabe === null) return null;
  const datum = (eingabe as { datum?: unknown }).datum;
  return typeof datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datum.trim())
    ? datum.trim()
    : null;
}

function keinReisetag(trip: Trip): PlanAuskunft {
  return {
    ok: false,
    hinweis: `Kein Reisetag dieser Reise. Die Reise dauert vom ${trip.startDate} bis ${trip.endDate}; gib das Datum als JJJJ-MM-TT an.`,
  };
}

/** Der Tag eines Programmpunkts ist der, an dem er beginnt (req-039). */
function amTag(activity: Activity, datum: string): boolean {
  return activity.startAt.slice(0, 10) === datum;
}

export function createPlanLeser(
  db: Queryable,
  accountId: string,
  tripId: string,
): AiPlanLeser {
  async function reise(): Promise<Trip> {
    const trip = await findTrip(db, accountId, tripId);
    // Die Reise wurde vor dem Gespraech gegen den Account geprueft. Fehlt sie
    // jetzt, ist sie inzwischen geloescht -- ein Fehlschlag, kein Hinweis.
    if (!trip) throw new Error("Reise nicht gefunden");
    return trip;
  }

  async function teilnehmerzahl(): Promise<number> {
    return (await listTripParticipants(db, accountId, tripId)).length;
  }

  async function reiseLesen(): Promise<PlanAuskunft> {
    const [trip, anzahl] = await Promise.all([reise(), teilnehmerzahl()]);
    return {
      ok: true,
      inhalt: {
        titel: trip.title,
        von: trip.startDate,
        bis: trip.endDate,
        hauptort: trip.mainPlace.name,
        zustand: TRIP_STATE_LABEL[trip.state],
        // Wie viele mitfahren -- nicht wer (req-093).
        teilnehmerzahl: anzahl,
        reisetage: reisetage(trip),
      },
    };
  }

  async function poisLesen(): Promise<PlanAuskunft> {
    const [pois, activities] = await Promise.all([
      listPois(db, accountId, tripId),
      listActivities(db, accountId, tripId),
    ]);
    // Ein POI gilt als verplant, sobald ein Programmpunkt auf ihn verweist
    // (req-011) -- an welchen Tagen, steht dabei.
    const eingeplant = new Map<string, string[]>();
    for (const activity of activities) {
      if (!activity.poiId) continue;
      const tage = eingeplant.get(activity.poiId) ?? [];
      const datum = activity.startAt.slice(0, 10);
      if (!tage.includes(datum)) tage.push(datum);
      eingeplant.set(activity.poiId, tage);
    }
    return {
      ok: true,
      inhalt: {
        pois: pois.map((poi) => ({
          nummer: poi.number,
          name: poi.name,
          ort: poi.ort,
          typ: POI_TYPE_LABEL[poi.type],
          status: POI_STATUS_LABEL[poi.status],
          // Der Kurztext genuegt; der Langtext bleibt aussen vor (req-093).
          kurztext: poi.shortText ?? null,
          dauerMinuten: poi.durationMinutes ?? null,
          kostenJePerson: euro(poi.kostenCent),
          buchung: POI_BUCHUNG_LABEL[poiBuchung(poi)],
          bewertung: poi.bewertung ?? null,
          eingeplantAm: eingeplant.get(poi.id) ?? [],
        })),
      },
    };
  }

  async function tagesplanLesen(eingabe: unknown): Promise<PlanAuskunft> {
    const [trip, activities, transfers] = await Promise.all([
      reise(),
      listActivities(db, accountId, tripId),
      listTransfers(db, accountId, tripId),
    ]);
    const datum = datumAus(eingabe);
    const tag = reisetage(trip).find((eintrag) => eintrag.datum === datum);
    if (!datum || !tag) return keinReisetag(trip);

    const amTagListe = activities
      .filter((activity) => amTag(activity, datum))
      .sort(
        (a, b) =>
          a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id),
      );
    const titelVon = new Map(amTagListe.map((a) => [a.id, a.title]));
    const weiter = new Map(
      transfers
        .filter((transfer) => titelVon.has(transfer.fromActivityId))
        .map((transfer) => [transfer.fromActivityId, transfer]),
    );

    return {
      ok: true,
      inhalt: {
        ...tag,
        // In zeitlicher Folge, je Programmpunkt der Weg zum naechsten, sofern
        // einer eingetragen ist.
        programmpunkte: amTagListe.map((activity) => {
          const transfer = weiter.get(activity.id);
          return {
            von: uhrzeit(activity.startAt),
            bis: uhrzeit(activity.endAt),
            titel: activity.title,
            typ: ACTIVITY_TYPE_LABEL[activity.type],
            kurztext: activity.shortText || null,
            gebucht: activity.booked ?? false,
            wegZumNaechsten: transfer
              ? {
                  nach: titelVon.get(transfer.toActivityId) ?? null,
                  verkehrsmittel: TRANSFER_MODE_LABEL[transfer.mode],
                  dauerMinuten: transfer.durationMin,
                }
              : null,
          };
        }),
      },
    };
  }

  async function kostenLesen(eingabe: unknown): Promise<PlanAuskunft> {
    const [trip, activities, pois, gespeicherte, anzahl] = await Promise.all([
      reise(),
      listActivities(db, accountId, tripId),
      listPois(db, accountId, tripId),
      listKostenzeilen(db, accountId, tripId),
      teilnehmerzahl(),
    ]);
    // Wer nach einem Tag fragt, bekommt dessen Zeilen; ohne Tag die ganze
    // Aufstellung. Ein Tag ausserhalb der Reise ist ein Hinweis.
    const gefragt =
      typeof eingabe === "object" &&
      eingabe !== null &&
      (eingabe as { datum?: unknown }).datum !== undefined;
    const datum = gefragt ? datumAus(eingabe) : null;
    if (gefragt && !reisetage(trip).some((tag) => tag.datum === datum)) {
      return keinReisetag(trip);
    }

    // Dieselbe Rechnung wie die Kostenplanung im Planer (req-062).
    const alle = kostenzeilen({
      trip,
      activities,
      pois,
      gespeicherte,
      teilnehmerzahl: anzahl,
    });
    const beginn = new Map(activities.map((a) => [a.id, a.startAt]));
    const tagDer = (activityId: string | null) =>
      activityId === null
        ? null
        : (beginn.get(activityId)?.slice(0, 10) ?? null);
    const zeilen =
      datum === null
        ? alle
        : alle.filter((zeile) => tagDer(zeile.activityId) === datum);
    const summen = kostenSummen(zeilen, anzahl);

    return {
      ok: true,
      inhalt: {
        datum,
        teilnehmerzahl: anzahl,
        zeilen: zeilen.map((zeile) => ({
          bezeichnung: zeile.bezeichnung,
          // Manuelle Zeilen (Maut, Sprit) liegen an keinem Tag.
          datum: tagDer(zeile.activityId),
          preisJePerson: euro(zeile.preisCent),
          anzahl: zeile.anzahl,
          gesamt: euro(zeile.gesamtCent),
          buchung: POI_BUCHUNG_LABEL[zeile.buchung],
        })),
        summeGesamt: formatEuro(summen.gesamtCent),
        summeJePerson: euro(summen.jePersonCent),
        hinweis:
          "Zeilen ohne eingetragenen Preis zählen mit 0 € — ihr Preis ist nicht eingetragen, nicht null.",
      },
    };
  }

  async function lies(
    werkzeug: PlanWerkzeug,
    eingabe: unknown,
  ): Promise<PlanAuskunft> {
    switch (werkzeug) {
      case "reise_lesen":
        return reiseLesen();
      case "pois_lesen":
        return poisLesen();
      case "tagesplan_lesen":
        return tagesplanLesen(eingabe);
      case "kosten_lesen":
        return kostenLesen(eingabe);
    }
  }

  return { lies };
}
