import { describe, expect, it } from "vitest";
import type { Poi } from "./types";
import {
  POI_NAME_MAX_LENGTH,
  emptyPoiInput,
  normalizeWeb,
  poiInputIsValid,
  poiInputToValues,
  poiToInput,
  validatePoiInput,
  type PoiInput,
} from "./validate";

function eingabe(overrides: Partial<PoiInput> = {}): PoiInput {
  return {
    ...emptyPoiInput(),
    name: "Bucht bei Praiano",
    ort: "Praiano",
    type: "strand",
    position: { lat: 40.6117, lng: 14.5289 },
    ...overrides,
  };
}

describe("emptyPoiInput (req-035)", () => {
  it("beginnt ohne Angaben und mit dem Status 'Weiß noch nicht'", () => {
    expect(emptyPoiInput()).toMatchObject({
      name: "",
      ort: "",
      position: null,
      status: "weiss_nicht",
    });
  });
});

describe("validatePoiInput (req-035)", () => {
  it("nimmt Name, Ort, Typ und Position an; alles Weitere darf leer bleiben", () => {
    expect(validatePoiInput(eingabe())).toEqual({});
    expect(poiInputIsValid(eingabe())).toBe(true);
  });

  it("verlangt einen Namen", () => {
    expect(validatePoiInput(eingabe({ name: "  " })).name).toBeDefined();
  });

  it("verlangt einen Ort", () => {
    expect(validatePoiInput(eingabe({ ort: "" })).ort).toBeDefined();
  });

  it("verlangt eine Position", () => {
    expect(
      validatePoiInput(eingabe({ position: null })).position,
    ).toBeDefined();
  });

  it("weist einen zu langen Namen ab", () => {
    const zuLang = "a".repeat(POI_NAME_MAX_LENGTH + 1);

    expect(validatePoiInput(eingabe({ name: zuLang })).name).toBeDefined();
  });
});

describe("normalizeWeb", () => {
  it("ergaenzt das fehlende Schema", () => {
    expect(normalizeWeb("villarufolo.com")).toBe("https://villarufolo.com");
  });

  it("laesst eine vollstaendige Adresse unangetastet", () => {
    expect(normalizeWeb("http://villarufolo.com")).toBe(
      "http://villarufolo.com",
    );
  });

  it("laesst Leeres leer", () => {
    expect(normalizeWeb("   ")).toBe("");
  });
});

describe("poiInputToValues (req-035)", () => {
  it("liefert nichts, wenn die Eingabe unvollstaendig ist", () => {
    expect(poiInputToValues(eingabe({ name: "" }))).toBeNull();
    expect(poiInputToValues(eingabe({ position: null }))).toBeNull();
  });

  it("raeumt die Eingaben auf", () => {
    const values = poiInputToValues(
      eingabe({
        name: "  Bucht bei Praiano ",
        ort: " Praiano ",
        web: "villarufolo.com",
        address: "  ",
        openingHours: "Montag: 09:00\n\n  Dienstag: 09:00 ",
      }),
    );

    expect(values).toMatchObject({
      name: "Bucht bei Praiano",
      ort: "Praiano",
      web: "https://villarufolo.com",
      address: null,
      openingHours: ["Montag: 09:00", "Dienstag: 09:00"],
    });
  });
});

describe("poiToInput (req-035)", () => {
  it("uebernimmt die Angaben eines vorhandenen POI", () => {
    const poi: Poi = {
      id: "poi-1",
      tripId: "trip-1",
      number: 13,
      name: "Villa Rufolo",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      status: "gesetzt",
      openingHours: ["Montag: 09:00", "Dienstag: 09:00"],
    };

    expect(poiToInput(poi)).toEqual({
      name: "Villa Rufolo",
      ort: "Ravello",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      status: "gesetzt",
      address: "",
      web: "",
      phone: "",
      openingHours: "Montag: 09:00\nDienstag: 09:00",
    });
  });
});
