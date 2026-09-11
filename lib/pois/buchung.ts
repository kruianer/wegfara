import type { Poi, PoiBuchung } from "./types";

/**
 * Der Buchungsstatus eines POI (req-061): ob der Ort noch gebucht werden
 * muss. Er beschreibt den Ort, nicht den Termin — der Buchungsstatus des
 * Programmpunkts (req-005) ist etwas anderes.
 */

/** Reihenfolge, in der die Zustaende in der Auswahlliste erscheinen. */
export const POI_BUCHUNGEN: PoiBuchung[] = ["nicht_noetig", "offen", "gebucht"];

/** Der Zustand, mit dem jeder POI beginnt — die meisten Orte bucht niemand. */
export const VORGEGEBENE_BUCHUNG: PoiBuchung = "nicht_noetig";

export const POI_BUCHUNG_LABEL: Record<PoiBuchung, string> = {
  nicht_noetig: "Nicht nötig",
  offen: "Offen",
  gebucht: "Gebucht",
};

/** Ob ein Wert aus einer Anfrage ein bekannter Buchungsstatus ist. */
export function isPoiBuchung(value: unknown): value is PoiBuchung {
  return (
    typeof value === "string" && POI_BUCHUNGEN.includes(value as PoiBuchung)
  );
}

/**
 * Der Buchungsstatus eines POI. Diese Funktion ist die einzige Stelle, die
 * entscheidet, was ein POI ohne eigene Angabe traegt: „Nicht nötig" — genau
 * die Vorgabe, die auch in der Datenbank steht.
 */
export function poiBuchung(poi: Pick<Poi, "buchung">): PoiBuchung {
  return poi.buchung ?? VORGEGEBENE_BUCHUNG;
}

/**
 * Das Kennzeichen, das die POI-Box traegt (req-061). „Nicht nötig" bekommt
 * keines: sonst truege jeder Strand eines, und das Kennzeichen sagte nichts
 * mehr.
 */
export function buchungKennzeichen(poi: Pick<Poi, "buchung">): string | null {
  const buchung = poiBuchung(poi);
  return buchung === "nicht_noetig" ? null : POI_BUCHUNG_LABEL[buchung];
}
