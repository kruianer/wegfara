import { describe, expect, it } from "vitest";
import { poiWege } from "./wege";

const ORT = {
  name: "Puente colgante",
  ort: "Portugalete",
  position: { lat: 43.32, lng: -3.02 },
};

describe("poiWege (req-097)", () => {
  it("fuehrt mit hinterlegter Webseite zu ihr", () => {
    expect(
      poiWege({ ...ORT, web: "https://puente-colgante.com" }).webseite,
    ).toEqual({ url: "https://puente-colgante.com", istSuche: false });
  });

  it("fuehrt ohne Webseite sichtbar zur Google-Suche", () => {
    const { webseite } = poiWege(ORT);
    expect(webseite.istSuche).toBe(true);
    const ziel = new URL(webseite.url);
    expect(ziel.hostname).toBe("www.google.com");
    expect(ziel.searchParams.get("q")).toBe(
      "Puente colgante Portugalete offizielle website",
    );
  });

  it("behandelt eine leere Webseite wie keine", () => {
    expect(poiWege({ ...ORT, web: "  " }).webseite.istSuche).toBe(true);
  });

  it("sucht ohne Ort mit dem Namen allein (req-041)", () => {
    const ziel = new URL(poiWege({ ...ORT, ort: "" }).webseite.url);
    expect(ziel.searchParams.get("q")).toBe(
      "Puente colgante offizielle website",
    );
  });

  it("fuehrt den zweiten Weg auf die Karte", () => {
    expect(poiWege(ORT).karte).toContain("google.com/maps");
  });
});
