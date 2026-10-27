import { describe, expect, it } from "vitest";
import { gesehenText, siehtInText } from "./plan-einblick";

describe("Vermerk eines Blicks in den Plan (req-093)", () => {
  it("sagt waehrend des Blicks, wohin der Chat sieht", () => {
    expect(siehtInText("tagesplan_lesen")).toBe("sieht in den Tagesplan …");
    expect(siehtInText("kosten_lesen")).toBe("sieht in die Kosten …");
  });

  it("nennt an der Antwort jeden Teil einmal, in der Reihenfolge des ersten Blicks", () => {
    expect(
      gesehenText(["reise_lesen", "tagesplan_lesen", "tagesplan_lesen"]),
    ).toBe("hat in die Reisedaten und den Tagesplan gesehen");
    expect(gesehenText(["pois_lesen", "tagesplan_lesen", "kosten_lesen"])).toBe(
      "hat in die POI-Sammlung, den Tagesplan und die Kosten gesehen",
    );
  });

  it("vermerkt ohne Blick nichts", () => {
    expect(gesehenText([])).toBeNull();
  });
});
