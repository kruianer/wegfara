import { describe, expect, it } from "vitest";
import {
  entsprichtGegendFilter,
  gegendFilterNochGueltig,
  gegendInDerListe,
  gegendenAus,
  gleicheGegend,
  hatGegenden,
  nachGegend,
  normalisiereGegend,
} from "./gegenden";
import type { Poi } from "./types";

function poi(name: string, gegend?: string): Poi {
  return {
    id: name,
    tripId: "t1",
    number: 1,
    name,
    ort: "Irgendwo",
    gegend,
    type: "sehenswuerdigkeit",
    position: { lat: 43.26, lng: -2.93 },
    status: "weiss_nicht",
    buchung: "nicht_noetig",
  };
}

describe("Gegend eines POI -- Aufraeumen der Eingabe (req-095)", () => {
  it("nimmt die Raender weg", () => {
    expect(normalisiereGegend("  Bilbao  ")).toBe("Bilbao");
  });

  it("macht aus dem leeren Text keine Gegend", () => {
    expect(normalisiereGegend("")).toBeNull();
    expect(normalisiereGegend("   ")).toBeNull();
  });

  it("laesst null null", () => {
    expect(normalisiereGegend(null)).toBeNull();
  });

  it("zieht mehrfache Leerzeichen innen zusammen", () => {
    // Sonst stuenden "Rioja Alavesa" und "Rioja  Alavesa" als zwei Gegenden da.
    expect(normalisiereGegend("Rioja  Alavesa")).toBe("Rioja Alavesa");
  });
});

describe("Zwei Namen derselben Gegend (req-095)", () => {
  it("uebersieht Gross- und Kleinschreibung", () => {
    expect(gleicheGegend("Bilbao", "bilbao")).toBe(true);
  });

  it("unterscheidet verschiedene Namen", () => {
    expect(gleicheGegend("Bilbao", "San Sebastian")).toBe(false);
  });
});

describe("Die Gegenden einer Reise (req-095)", () => {
  it("sammelt sie aus den POIs, alphabetisch und ohne Wiederholung", () => {
    const pois = [
      poi("Guggenheim", "Bilbao"),
      poi("Concha", "San Sebastian"),
      poi("Altstadt", "Bilbao"),
    ];
    expect(gegendenAus(pois)).toEqual(["Bilbao", "San Sebastian"]);
  });

  it("laesst POIs ohne Gegend aussen vor", () => {
    expect(gegendenAus([poi("Ohne"), poi("Mit", "Bilbao")])).toEqual([
      "Bilbao",
    ]);
  });

  it("zaehlt zwei Schreibweisen als eine Gegend", () => {
    expect(gegendenAus([poi("A", "Bilbao"), poi("B", "bilbao")])).toEqual([
      "Bilbao",
    ]);
  });

  it("gibt die leere Liste zurueck, wenn keiner eine Gegend traegt", () => {
    expect(gegendenAus([poi("A"), poi("B")])).toEqual([]);
    expect(hatGegenden([poi("A"), poi("B")])).toBe(false);
  });

  // Der Kern von req-095: Eine Gegend existiert nur, solange ein POI sie
  // traegt. Wird sie beim letzten entfernt, verschwindet sie -- ohne
  // Aufraeumen, weil es nichts aufzuraeumen gibt.
  it("kennt eine Gegend nicht mehr, sobald kein POI sie mehr traegt", () => {
    const vorher = [poi("Guggenheim", "Bilbao"), poi("Concha", "Donostia")];
    expect(gegendenAus(vorher)).toEqual(["Bilbao", "Donostia"]);

    const nachher = [poi("Guggenheim", "Bilbao"), poi("Concha")];
    expect(gegendenAus(nachher)).toEqual(["Bilbao"]);
  });
});

describe("Filtern nach Gegend (req-095)", () => {
  const pois = [
    poi("Guggenheim", "Bilbao"),
    poi("Concha", "San Sebastian"),
    poi("Ohne"),
  ];

  it('laesst bei "alle" jeden durch', () => {
    expect(nachGegend(pois, "alle")).toHaveLength(3);
  });

  it("zeigt bei einem Namen nur diese Gegend", () => {
    expect(nachGegend(pois, "Bilbao").map((p) => p.name)).toEqual([
      "Guggenheim",
    ]);
  });

  it('zeigt bei "ohne" nur die POIs ohne Gegend', () => {
    expect(nachGegend(pois, "ohne").map((p) => p.name)).toEqual(["Ohne"]);
  });

  it("trifft auch bei anderer Schreibweise", () => {
    expect(nachGegend(pois, "bilbao").map((p) => p.name)).toEqual([
      "Guggenheim",
    ]);
  });

  it("laesst einen POI ohne Gegend bei einem Namen nicht durch", () => {
    expect(entsprichtGegendFilter(poi("Ohne"), "Bilbao")).toBe(false);
  });

  it("behaelt die Reihenfolge, in der die POIs hereinkamen", () => {
    const viele = [poi("C", "Bilbao"), poi("A", "Bilbao"), poi("B", "Bilbao")];
    expect(nachGegend(viele, "Bilbao").map((p) => p.name)).toEqual([
      "C",
      "A",
      "B",
    ]);
  });
});

describe("Ein Filter auf eine entfallene Gegend (req-095)", () => {
  it("gilt nicht mehr, wenn kein POI die Gegend mehr traegt", () => {
    // Der Filter wird je Reise gemerkt (bug-052). Wird die Gegend beim
    // letzten POI entfernt, zeigte er dauerhaft eine leere Liste.
    expect(gegendFilterNochGueltig("Donostia", [poi("A", "Bilbao")])).toBe(
      false,
    );
  });

  it("gilt weiter, solange die Gegend vorkommt", () => {
    expect(gegendFilterNochGueltig("Bilbao", [poi("A", "Bilbao")])).toBe(true);
  });

  it('gilt fuer "alle" und "ohne" immer', () => {
    expect(gegendFilterNochGueltig("alle", [])).toBe(true);
    expect(gegendFilterNochGueltig("ohne", [])).toBe(true);
  });
});

describe("gegendInDerListe (req-097)", () => {
  it("zeigt das Kürzel und den vollen Namen beim Überfahren", () => {
    expect(
      gegendInDerListe({ gegend: "San Sebastián", gegendKuerzel: "SSE" }),
    ).toEqual({ text: "SSE", titel: "San Sebastián", leer: false });
  });

  it("zeigt ohne Gegend einen Strich", () => {
    expect(gegendInDerListe({})).toEqual({
      text: "—",
      titel: "Keine Gegend",
      leer: true,
    });
    expect(gegendInDerListe({ gegend: "  ", gegendKuerzel: "SSE" }).text).toBe(
      "—",
    );
  });

  it("leitet kein Kürzel ab, sondern zeigt ohne Kürzel den Namen", () => {
    // „San Sebastián“ und „Santander“ ergaeben beide „SAN“.
    expect(gegendInDerListe({ gegend: "San Sebastián" }).text).toBe(
      "San Sebastián",
    );
    expect(
      gegendInDerListe({ gegend: "Santander", gegendKuerzel: " " }).text,
    ).toBe("Santander");
  });
});
