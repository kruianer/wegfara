import { describe, expect, it } from "vitest";
import { poiOrtUndTyp } from "./meta-line";

describe("poiOrtUndTyp (req-041)", () => {
  it("nennt Ort und Typ", () => {
    expect(poiOrtUndTyp({ ort: "Ravello", type: "sehenswuerdigkeit" })).toBe(
      "Ravello · Sehenswürdigkeit",
    );
  });

  it("nennt ohne Ort allein den Typ — ohne Platzhalter und ohne Trenner", () => {
    expect(poiOrtUndTyp({ ort: "", type: "strand" })).toBe("Strand");
    expect(poiOrtUndTyp({ ort: "   ", type: "strand" })).toBe("Strand");
  });
});
