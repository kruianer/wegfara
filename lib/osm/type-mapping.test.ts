import { describe, expect, it } from "vitest";
import { mapOsmTagsToType } from "./type-mapping";

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
