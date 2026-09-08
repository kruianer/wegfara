import { describe, expect, it } from "vitest";
import { mapOsmArtToPoiType, mapOsmTagsToType } from "./type-mapping";

describe("mapOsmTagsToType", () => {
  it("erkennt ein Restaurant am amenity-Tag", () => {
    expect(mapOsmTagsToType({ amenity: "restaurant" })).toBe("restaurant");
  });

  it("erkennt einen Strand am natural-Tag", () => {
    expect(mapOsmTagsToType({ natural: "beach" })).toBe("strand");
  });

  it("erkennt ein Hotel am tourism-Tag", () => {
    expect(mapOsmTagsToType({ tourism: "hotel" })).toBe("hotel");
  });

  it("liefert null ohne passendes Tag", () => {
    expect(mapOsmTagsToType({ shop: "bakery" })).toBeNull();
  });
});

describe("mapOsmArtToPoiType (req-048)", () => {
  it("erkennt eine Sehenswürdigkeit an der Einordnung der Ortssuche", () => {
    expect(mapOsmArtToPoiType("tourism/attraction")).toBe("sehenswuerdigkeit");
  });

  it("erkennt eine Stadt", () => {
    expect(mapOsmArtToPoiType("place/city")).toBe("stadt_dorf");
  });

  it("liest die Einordnung unabhängig von der Schreibweise", () => {
    expect(mapOsmArtToPoiType("Amenity/Restaurant")).toBe("restaurant");
  });

  it("liefert null, wenn sich die Einordnung nicht zuordnen lässt", () => {
    // Der eingestellte Typ bleibt dann stehen: was die Quelle nicht kennt,
    // kann sie nicht füllen.
    expect(mapOsmArtToPoiType("shop/supermarket")).toBeNull();
  });

  it("liefert null ohne Einordnung", () => {
    expect(mapOsmArtToPoiType("")).toBeNull();
    expect(mapOsmArtToPoiType("tourism")).toBeNull();
  });
});
