import { describe, expect, it } from "vitest";
import { poiTextsFromGoogle } from "./description";
import { POI_SHORT_TEXT_MAX_LENGTH } from "@/lib/pois/validate";

describe("poiTextsFromGoogle (req-044)", () => {
  it("macht aus der Beschreibung Kurz- und Langtext", () => {
    expect(
      poiTextsFromGoogle("Historische Villa über der Amalfiküste."),
    ).toEqual({
      shortText: "Historische Villa über der Amalfiküste.",
      longText: "Historische Villa über der Amalfiküste.",
    });
  });

  it("laesst beide leer, wenn Google keine Beschreibung fuehrt", () => {
    expect(poiTextsFromGoogle(undefined)).toEqual({});
    expect(poiTextsFromGoogle("   ")).toEqual({});
  });

  it("kuerzt den Kurztext auf die Grenze, der Langtext bleibt vollstaendig", () => {
    const lang = `${"Wort ".repeat(80)}Ende.`;

    const { shortText, longText } = poiTextsFromGoogle(lang);

    expect(shortText?.length).toBeLessThanOrEqual(POI_SHORT_TEXT_MAX_LENGTH);
    expect(shortText?.endsWith("…")).toBe(true);
    // Gekuerzt wird am letzten ganzen Wort davor.
    expect(shortText).not.toMatch(/Wor…$/);
    expect(longText).toBe(lang.trim());
  });
});
