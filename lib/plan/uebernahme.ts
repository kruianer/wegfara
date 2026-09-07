import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";

/**
 * Was beim Uebernehmen eines Planvorschlags geschieht (req-056): erst dann
 * wird gespeichert -- vorher stand der Vorschlag nur zur Ansicht.
 *
 * Aus der Anfrage kommt nur, welcher POI wann beginnt; alles Uebrige rechnet
 * der Server aus den gespeicherten POIs und Programmpunkten (req-024) --
 * Titel, Typ und Dauer nimmt er nie aus der Anfrage entgegen.
 */

/** Ein Programmpunkt des Vorschlags, wie ihn die Anfrage nennt. */
export interface UebernahmePunkt {
  /** Der bestehende Programmpunkt, der verschoben wird; null bei einem neuen. */
  activityId: string | null;
  /** Der POI, aus dem ein neuer Programmpunkt entsteht; null sonst. */
  poiId: string | null;
  startAt: string;
}

function textOderNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Liest die zu speichernden Programmpunkte aus der Anfrage. Unveraenderte
 * bleiben aussen vor -- an ihnen ist nichts zu tun. Liefert null, wenn die
 * Anfrage keine Liste enthaelt.
 */
export function parseUebernahmePunkte(
  value: unknown,
): UebernahmePunkt[] | null {
  if (!Array.isArray(value)) return null;

  const punkte: UebernahmePunkt[] = [];
  for (const eintrag of value) {
    if (typeof eintrag !== "object" || eintrag === null) continue;
    const roh = eintrag as Record<string, unknown>;
    if (roh.unveraendert === true) continue;

    const startAt = textOderNull(roh.startAt);
    const activityId = textOderNull(roh.activityId);
    const poiId = textOderNull(roh.poiId);
    if (!startAt || (!activityId && !poiId)) continue;

    punkte.push({ activityId, poiId, startAt });
  }
  return punkte;
}

/**
 * Die Paare aufeinanderfolgender Programmpunkte eines Reisetages, zwischen
 * denen noch ein Transfer fehlt (req-056: beim Uebernehmen entstehen auch
 * die Transfers, req-052). Nur wo eine Luecke bleibt und beide eine Position
 * haben, laesst sich einer anlegen.
 */
export function transferLuecken(
  activities: Activity[],
  transfers: Transfer[],
): [Activity, Activity][] {
  const vorhanden = new Set(
    transfers.map(
      (transfer) => `${transfer.fromActivityId}->${transfer.toActivityId}`,
    ),
  );

  const jeTag = new Map<string, Activity[]>();
  for (const activity of activities) {
    const date = activity.startAt.slice(0, 10);
    jeTag.set(date, [...(jeTag.get(date) ?? []), activity]);
  }

  const paare: [Activity, Activity][] = [];
  for (const tagesPunkte of jeTag.values()) {
    const sortiert = [...tagesPunkte].sort((a, b) =>
      a.startAt.localeCompare(b.startAt),
    );
    for (let index = 0; index + 1 < sortiert.length; index += 1) {
      const von = sortiert[index];
      const nach = sortiert[index + 1];
      if (nach.startAt <= von.endAt) continue;
      if (!von.position || !nach.position) continue;
      if (vorhanden.has(`${von.id}->${nach.id}`)) continue;
      paare.push([von, nach]);
    }
  }
  return paare;
}
