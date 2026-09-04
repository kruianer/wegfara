import { describe, expect, it } from "vitest";
import {
  changedPoiFields,
  mergeGooglePoiUpdate,
  parseManualFields,
  serializeManualFields,
  withManualFields,
  type PoiFieldValues,
} from "./manual-fields";

function werte(overrides: Partial<PoiFieldValues> = {}): PoiFieldValues {
  return {
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
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

describe("mergeGooglePoiUpdate (req-035)", () => {
  const ausGoogle = werte({
    name: "Villa Rufolo",
    phone: "+39 089 000000",
    address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    lat: 40.6,
    lng: 14.6,
  });

  it("uebernimmt alles, solange nichts von Hand geaendert wurde", () => {
    const vorhanden = werte({ name: "Villa Rufolo (Garten)" });

    expect(mergeGooglePoiUpdate(vorhanden, ausGoogle, [])).toEqual(ausGoogle);
  });

  it("laesst einen von Hand geaenderten Namen stehen", () => {
    const vorhanden = werte({ name: "Villa Rufolo (Garten)" });

    const merged = mergeGooglePoiUpdate(vorhanden, ausGoogle, ["name"]);

    expect(merged.name).toBe("Villa Rufolo (Garten)");
    // Alles Uebrige bleibt der Stand von Google.
    expect(merged.phone).toBe("+39 089 000000");
  });

  it("laesst eine von Hand gesetzte Position stehen", () => {
    const vorhanden = werte({ lat: 40.9, lng: 14.9 });

    const merged = mergeGooglePoiUpdate(vorhanden, ausGoogle, ["position"]);

    expect(merged).toMatchObject({ lat: 40.9, lng: 14.9 });
  });

  it("laesst eine von Hand geleerte Angabe leer", () => {
    const vorhanden = werte({ phone: null });

    expect(mergeGooglePoiUpdate(vorhanden, ausGoogle, ["phone"]).phone).toBe(
      null,
    );
  });
});
