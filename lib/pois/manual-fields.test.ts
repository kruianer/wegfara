import { describe, expect, it } from "vitest";
import {
  changedPoiFields,
  ohneGefuellteFelder,
  parseManualFields,
  serializeManualFields,
  vereinigteFelder,
  withManualFields,
  type PoiFieldValues,
} from "./manual-fields";

function werte(overrides: Partial<PoiFieldValues> = {}): PoiFieldValues {
  return {
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    shortText: "Gärten mit Meerblick",
    longText: "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
    lat: 40.6491,
    lng: 14.6113,
    web: "https://villarufolo.com",
    address: "Piazza Duomo, 1",
    phone: "+39 089 857621",
    openingHours: "Montag: 09:00-20:00",
    ...overrides,
  };
}

describe("parseManualFields / serializeManualFields", () => {
  it("liest eine leere Spalte als nichts von Hand geaendert", () => {
    expect(parseManualFields("")).toEqual([]);
    expect(parseManualFields(null)).toEqual([]);
  });

  it("liest und schreibt dieselben Feldnamen", () => {
    expect(parseManualFields("name,position")).toEqual(["name", "position"]);
    expect(serializeManualFields(["position", "name"])).toBe("name,position");
  });

  it("uebergeht unbekannte Feldnamen", () => {
    expect(parseManualFields("name,nummer,quatsch")).toEqual(["name"]);
  });

  it("uebergeht den Ort aus der Zeit vor req-041", () => {
    expect(parseManualFields("name,ort")).toEqual(["name"]);
    expect(serializeManualFields(["name"])).toBe("name");
  });
});

describe("changedPoiFields", () => {
  it("meldet nichts, wenn sich nichts geaendert hat", () => {
    expect(changedPoiFields(werte(), werte())).toEqual([]);
  });

  it("meldet einen geaenderten Namen", () => {
    expect(
      changedPoiFields(werte(), werte({ name: "Villa Rufolo (Garten)" })),
    ).toEqual(["name"]);
  });

  it("meldet eine verschobene Position als eine Aenderung, nicht als zwei", () => {
    expect(
      changedPoiFields(werte(), werte({ lat: 40.65, lng: 14.62 })),
    ).toEqual(["position"]);
  });

  it("meldet eine geleerte Angabe", () => {
    expect(changedPoiFields(werte(), werte({ phone: null }))).toEqual([
      "phone",
    ]);
  });
});

describe("withManualFields", () => {
  it("nimmt eine frueher vermerkte Aenderung nicht zurueck", () => {
    expect(withManualFields(["name"], ["phone"])).toEqual(["name", "phone"]);
  });

  it("vermerkt dasselbe Feld nur einmal", () => {
    expect(withManualFields(["name"], ["name"])).toEqual(["name"]);
  });
});

describe("vereinigteFelder (req-048)", () => {
  it("führt zwei Füllungen des Suchfelds zusammen", () => {
    expect(vereinigteFelder(["name", "position"], ["address"])).toEqual([
      "name",
      "position",
      "address",
    ]);
  });

  it("nennt dasselbe Feld nur einmal", () => {
    expect(vereinigteFelder(["name"], ["name"])).toEqual(["name"]);
  });
});

describe("ohneGefuellteFelder (req-048)", () => {
  it("lässt gelten, was ich selbst getippt habe", () => {
    expect(ohneGefuellteFelder(["name", "address"], ["address"])).toEqual([
      "name",
    ]);
  });

  it("vermerkt nichts, wenn allein das Suchfeld gefüllt hat", () => {
    expect(
      ohneGefuellteFelder(["name", "address"], ["name", "address"]),
    ).toEqual([]);
  });
});
