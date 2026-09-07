import { describe, expect, it } from "vitest";
import { googleLocalityOf } from "./locality";

describe("googleLocalityOf (req-057)", () => {
  it("nimmt die Ortschaft aus den Adressbestandteilen", () => {
    expect(
      googleLocalityOf([
        { longText: "Italien", types: ["country"] },
        { longText: "Salerno", types: ["administrative_area_level_2"] },
        { longText: "Ravello", types: ["locality", "political"] },
      ]),
    ).toBe("Ravello");
  });

  it("nimmt keine Region und kein Land, wenn keine Ortschaft dabei ist", () => {
    expect(
      googleLocalityOf([
        { longText: "Italien", types: ["country"] },
        { longText: "Kampanien", types: ["administrative_area_level_1"] },
      ]),
    ).toBe("");
  });

  it("weicht auf die naechstkleinere Ebene aus", () => {
    expect(
      googleLocalityOf([{ longText: "Trastevere", types: ["sublocality"] }]),
    ).toBe("Trastevere");
  });

  it("liefert nichts ohne Adressbestandteile", () => {
    expect(googleLocalityOf(undefined)).toBe("");
    expect(googleLocalityOf([])).toBe("");
  });
});
