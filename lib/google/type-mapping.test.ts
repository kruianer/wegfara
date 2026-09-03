import { describe, expect, it } from "vitest";
import { mapGoogleTypesToPoiType } from "./type-mapping";

describe("mapGoogleTypesToPoiType (req-026)", () => {
  it("bildet ein Restaurant ab", () => {
    expect(
      mapGoogleTypesToPoiType(["restaurant", "food", "point_of_interest"]),
    ).toBe("restaurant");
  });

  it("bildet eine Unterkunft auf Hotel ab", () => {
    expect(mapGoogleTypesToPoiType(["lodging", "point_of_interest"])).toBe(
      "hotel",
    );
  });

  it("bildet einen Ort auf Stadt & Dorf ab", () => {
    expect(mapGoogleTypesToPoiType(["locality", "political"])).toBe(
      "stadt_dorf",
    );
  });

  it("bildet einen Strand ab", () => {
    expect(mapGoogleTypesToPoiType(["beach", "natural_feature"])).toBe(
      "strand",
    );
  });

  it("bildet einen Freizeitpark auf Aktivitaet ab", () => {
    expect(
      mapGoogleTypesToPoiType(["amusement_park", "point_of_interest"]),
    ).toBe("aktivitaet");
  });

  it("bildet eine Touristenattraktion auf Sehenswuerdigkeit ab", () => {
    expect(
      mapGoogleTypesToPoiType(["tourist_attraction", "point_of_interest"]),
    ).toBe("sehenswuerdigkeit");
  });

  it("waehlt den engeren Typ, wenn mehrere Arten passen", () => {
    expect(
      mapGoogleTypesToPoiType([
        "point_of_interest",
        "restaurant",
        "establishment",
      ]),
    ).toBe("restaurant");
  });

  it("gilt als Sehenswuerdigkeit, wenn sich nichts zuordnen laesst", () => {
    expect(mapGoogleTypesToPoiType(["establishment", "geocode"])).toBe(
      "sehenswuerdigkeit",
    );
  });

  it("gilt als Sehenswuerdigkeit, wenn Google gar keine Art nennt", () => {
    expect(mapGoogleTypesToPoiType([])).toBe("sehenswuerdigkeit");
  });
});
