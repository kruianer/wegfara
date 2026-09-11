import { describe, expect, it } from "vitest";
import { kostenSummen } from "./summen";
import type { Kostenzeile } from "./types";

function zeile(overrides: Partial<Kostenzeile> = {}): Kostenzeile {
  return {
    id: "zeile-1",
    herkunft: "manuell",
    activityId: null,
    poiId: null,
    bezeichnung: "Maut",
    reisetag: null,
    preisCent: 1000,
    anzahl: 1,
    gesamtCent: 1000,
    buchung: "nicht_noetig",
    ...overrides,
  };
}

describe("kostenSummen (req-062)", () => {
  /**
   * Zeilen ueber zusammen 400,00 Euro und 4 Teilnehmer: 400,00 gesamt und
   * 100,00 je Person -- damit sich ein Mietauto auf alle verteilt.
   */
  it("rechnet Gesamtkosten und Kosten je Person", () => {
    const summen = kostenSummen(
      [
        zeile({ id: "a", gesamtCent: 30_000 }),
        zeile({ id: "b", gesamtCent: 10_000 }),
      ],
      4,
    );

    expect(summen.gesamtCent).toBe(40_000);
    expect(summen.jePersonCent).toBe(10_000);
  });

  it("zaehlt eine Zeile ohne eingetragenen Preis mit nichts", () => {
    const summen = kostenSummen(
      [
        zeile({ id: "a", gesamtCent: 30_000 }),
        zeile({ id: "b", gesamtCent: null }),
      ],
      4,
    );

    expect(summen.gesamtCent).toBe(30_000);
  });

  it("rundet die Kosten je Person auf Cent", () => {
    const summen = kostenSummen([zeile({ gesamtCent: 1000 })], 3);

    expect(summen.jePersonCent).toBe(333);
  });

  it("liefert ohne Zeilen null Euro", () => {
    expect(kostenSummen([], 4)).toEqual({ gesamtCent: 0, jePersonCent: 0 });
  });

  /** Ohne Teilnehmer gibt es niemanden, auf den sich etwas verteilen liesse. */
  it("laesst die Kosten je Person ohne Teilnehmer leer", () => {
    const summen = kostenSummen([zeile({ gesamtCent: 30_000 })], 0);

    expect(summen.gesamtCent).toBe(30_000);
    expect(summen.jePersonCent).toBeNull();
  });
});
