import { describe, expect, it } from "vitest";
import { kostenzeilen } from "@/lib/kosten/zeilen";
import {
  DRUCK_ACTIVITIES,
  DRUCK_POIS,
  DRUCK_TRIP,
  POI_HOTEL,
  POI_NACHTWAECHTER,
  POI_ZUNFTHAUS,
  ST_HOTEL,
  ST_NACHTWAECHTER,
  ST_ZUNFTHAUS,
} from "@/tests/fixtures/druck-reise";
import { DRUCK_BUCHUNG_LABEL, druckKosten } from "./kosten";

/**
 * Die letzte Seite des gedruckten Reiseplans (req-080): je Position Betrag
 * und Buchungszustand, darunter die Summe und der Betrag je Person.
 */
function kosten(teilnehmerzahl = 4) {
  return druckKosten(
    kostenzeilen({
      trip: DRUCK_TRIP,
      activities: DRUCK_ACTIVITIES,
      pois: DRUCK_POIS,
      gespeicherte: [],
      teilnehmerzahl,
    }),
    teilnehmerzahl,
  );
}

function posten(id: string) {
  return kosten().posten.find((p) => p.id === id)!;
}

describe("druckKosten -- Kosten und Buchungen (req-080)", () => {
  it("fuehrt je Position Betrag und Buchungszustand", () => {
    const hotel = posten(ST_HOTEL.id);

    expect(hotel.name).toBe(POI_HOTEL.name);
    // 220 € je Person, vier Personen.
    expect(hotel.betrag).toBe("880 €");
    expect(hotel.buchung).toBe("gebucht");
    expect(hotel.zusatz).toContain("220 € je Person");
    expect(hotel.zusatz).toContain("4 ×");
  });

  it("nennt den Reisetag der Position", () => {
    expect(posten(ST_NACHTWAECHTER.id).zusatz).toContain("Tag 1");
  });

  it("schreibt „offen“ statt „0 €“, wenn kein Preis eingetragen ist", () => {
    // Am Zunfthaus steht kein Preis -- „nicht eingetragen" ist kein Betrag.
    expect(POI_ZUNFTHAUS.kostenCent).toBeUndefined();
    expect(posten(ST_ZUNFTHAUS.id).betrag).toBeNull();
  });

  it("zaehlt die Summe und den Betrag je Person", () => {
    const summe = kosten();

    // Hotel 220 € × 4 und Nachtwaechter 8 € × 4 -- das Zunfthaus zaehlt mit
    // null Euro, weil kein Preis eingetragen ist.
    expect(POI_NACHTWAECHTER.kostenCent).toBe(800);
    expect(summe.gesamt).toBe("912 €");
    expect(summe.jePerson).toBe("228 €");
  });

  it("bleibt ohne Zuordnung ohne Betrag je Person", () => {
    expect(kosten(0).jePerson).toBeNull();
  });

  it("nennt den Buchungszustand in halben Saetzen", () => {
    expect(DRUCK_BUCHUNG_LABEL).toEqual({
      nicht_noetig: "keine Buchung nötig",
      offen: "noch nicht gebucht",
      gebucht: "gebucht",
    });
  });

  it("fuehrt auch die Position zu einer Station, die im Heft fehlt", () => {
    // Bezahlt wird sie trotzdem -- das Kennzeichen gestaltet das Heft, es
    // streicht keine Kosten.
    const zeilen = kostenzeilen({
      trip: DRUCK_TRIP,
      activities: [{ ...ST_HOTEL, druckDarstellung: "nicht_anzeigen" }],
      pois: DRUCK_POIS,
      gespeicherte: [],
      teilnehmerzahl: 4,
    });

    expect(druckKosten(zeilen, 4).posten.map((p) => p.id)).toEqual([
      ST_HOTEL.id,
    ]);
  });
});
