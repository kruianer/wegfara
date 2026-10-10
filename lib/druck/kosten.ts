import type { PoiBuchung } from "../pois/types";
import type { Kostenzeile } from "../kosten/types";
import { kostenSummen } from "../kosten/summen";
import { druckBetrag } from "./geld";
import type { DruckKosten, DruckPosten } from "./types";

/**
 * Die letzte Seite des gedruckten Reiseplans (req-080): Kosten und Buchungen.
 *
 * Hier stehen die Angaben, die im Tagesteil fehlen -- Betrag **und**
 * Buchungszustand je Position, darunter die Summe und der Betrag je Person.
 * Offene Positionen stehen als „offen" statt als 0 €: „nicht eingetragen" ist
 * kein Betrag, den man raten koennte.
 *
 * Gefuehrt werden alle Positionen der Kostenplanung (req-062) -- auch die zu
 * einem Programmpunkt, der im Heft nicht erscheint: bezahlt wird er trotzdem.
 */

/**
 * Wie der Buchungszustand im Heft heisst. Die Woerter des Planers („Nicht
 * nötig", „Offen", „Gebucht") sind Beschriftungen einer Auswahlliste; auf
 * Papier steht ein halber Satz.
 */
export const DRUCK_BUCHUNG_LABEL: Record<PoiBuchung, string> = {
  nicht_noetig: "keine Buchung nötig",
  offen: "noch nicht gebucht",
  gebucht: "gebucht",
};

/** Woher die Position kommt: Reisetag, Preis je Person und Anzahl. */
function zusatz(zeile: Kostenzeile): string {
  return [
    zeile.reisetag,
    zeile.preisCent === null
      ? null
      : `${druckBetrag(zeile.preisCent)} je Person`,
    zeile.anzahl === 1 ? null : `${zeile.anzahl} ×`,
  ]
    .filter((teil): teil is string => Boolean(teil))
    .join(" · ");
}

export function druckKosten(
  zeilen: Kostenzeile[],
  teilnehmerzahl: number,
): DruckKosten {
  const summen = kostenSummen(zeilen, teilnehmerzahl);
  const posten: DruckPosten[] = zeilen.map((zeile) => ({
    id: zeile.id,
    name: zeile.bezeichnung,
    zusatz: zusatz(zeile),
    buchung: zeile.buchung,
    // Ohne eingetragenen Preis gibt es keinen Betrag -- im Heft steht dann
    // „offen" und nicht „0 €".
    betrag: zeile.gesamtCent === null ? null : druckBetrag(zeile.gesamtCent),
  }));

  return {
    posten,
    gesamt: druckBetrag(summen.gesamtCent),
    jePerson:
      summen.jePersonCent === null ? null : druckBetrag(summen.jePersonCent),
  };
}
