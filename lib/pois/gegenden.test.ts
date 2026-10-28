import { describe, expect, it } from "vitest";
import {
  entsprichtGegendFilter,
  geltenderGegendFilter,
  GEGEND_MAX_LAENGE,
  gegendInDerListe,
  gegendZuLang,
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

describe("Filtern nach Gegend (req-095, seit req-098 als Menge)", () => {
  const pois = [
    poi("Guggenheim", "Bilbao"),
    poi("Concha", "San Sebastian"),
    poi("Ohne"),
  ];

  it("laesst bei leerer Menge jeden durch -- sie ersetzt „alle“", () => {
    expect(nachGegend(pois, [])).toHaveLength(3);
  });

  it("zeigt bei einem Namen nur diese Gegend", () => {
    expect(nachGegend(pois, ["Bilbao"]).map((p) => p.name)).toEqual([
      "Guggenheim",
    ]);
  });

  it('zeigt bei "ohne" nur die POIs ohne Gegend', () => {
    expect(nachGegend(pois, ["ohne"]).map((p) => p.name)).toEqual(["Ohne"]);
  });

  it("verbindet mehrere Gegenden mit „oder“ (req-098)", () => {
    expect(nachGegend(pois, ["Bilbao", "ohne"]).map((p) => p.name)).toEqual([
      "Guggenheim",
      "Ohne",
    ]);
  });

  it("trifft auch bei anderer Schreibweise", () => {
    expect(nachGegend(pois, ["bilbao"]).map((p) => p.name)).toEqual([
      "Guggenheim",
    ]);
  });

  it("laesst einen POI ohne Gegend bei einem Namen nicht durch", () => {
    expect(entsprichtGegendFilter(poi("Ohne"), ["Bilbao"])).toBe(false);
  });

  it("behaelt die Reihenfolge, in der die POIs hereinkamen", () => {
    const viele = [poi("C", "Bilbao"), poi("A", "Bilbao"), poi("B", "Bilbao")];
    expect(nachGegend(viele, ["Bilbao"]).map((p) => p.name)).toEqual([
      "C",
      "A",
      "B",
    ]);
  });
});

describe("Ein Filter auf eine entfallene Gegend (req-095)", () => {
  it("laesst die Gegend fallen, wenn kein POI sie mehr traegt", () => {
    // Der Filter wird je Reise gemerkt (bug-052). Wird die Gegend beim
    // letzten POI entfernt, zeigte er dauerhaft eine leere Liste.
    expect(geltenderGegendFilter(["Donostia"], [poi("A", "Bilbao")])).toEqual(
      [],
    );
  });

  it("behaelt die Gegenden, die noch vorkommen", () => {
    expect(
      geltenderGegendFilter(["Bilbao", "Donostia"], [poi("A", "Bilbao")]),
    ).toEqual(["Bilbao"]);
  });

  it('behaelt "ohne" immer', () => {
    expect(geltenderGegendFilter(["ohne"], [])).toEqual(["ohne"]);
  });
});

describe("gegendInDerListe (req-097, req-101)", () => {
  it("zeigt das Kürzel und beim Überfahren nichts weiter", () => {
    expect(gegendInDerListe({ gegend: "SSE" })).toEqual({
      text: "SSE",
      leer: false,
    });
  });

  it("zeigt ohne Gegend einen Strich", () => {
    expect(gegendInDerListe({})).toEqual({
      text: "—",
      titel: "Keine Gegend",
      leer: true,
    });
    expect(gegendInDerListe({ gegend: "  " }).text).toBe("—");
  });

  it("leitet kein Kürzel ab, sondern zeigt eine alte lange Gegend, wie sie ist", () => {
    // „San Sebastián“ und „Santander“ ergaeben beide „SAN“.
    expect(gegendInDerListe({ gegend: "San Sebastián" }).text).toBe(
      "San Sebastián",
    );
  });
});

describe("Gegend als Kürzel (req-101)", () => {
  it("hat höchstens sechs Zeichen", () => {
    expect(GEGEND_MAX_LAENGE).toBe(6);
    expect(gegendZuLang("BIO")).toBe(false);
    expect(gegendZuLang("ABCDEF")).toBe(false);
    expect(gegendZuLang("San Sebastián")).toBe(true);
  });

  it("zählt Ränder nicht und lässt das leere Feld zu", () => {
    expect(gegendZuLang("  BIO  ")).toBe(false);
    expect(gegendZuLang("")).toBe(false);
    expect(gegendZuLang(null)).toBe(false);
  });

  it("kürzt nicht -- normalisiereGegend lässt eine lange Gegend, wie sie ist", () => {
    expect(normalisiereGegend("Bilbao Altstadt")).toBe("Bilbao Altstadt");
  });

  it("führt „bio“ und „BIO“ als eine Gegend", () => {
    expect(gegendenAus([poi("A", "BIO"), poi("B", "bio")])).toEqual(["BIO"]);
  });

  it("filtert nach „BIO“ nur die POIs dieser Gegend", () => {
    const pois = [poi("A", "BIO"), poi("B", "SSE"), poi("C", "bio")];
    expect(nachGegend(pois, ["BIO"]).map((p) => p.name)).toEqual(["A", "C"]);
  });

  it("schlägt eine Gegend nicht mehr vor, wenn sie beim letzten POI entfernt wurde", () => {
    expect(gegendenAus([poi("A", "BIO"), poi("B")])).toEqual(["BIO"]);
    expect(gegendenAus([poi("A"), poi("B")])).toEqual([]);
  });
});
