import { describe, expect, it } from "vitest";
import { activityTeaserFoto, poiTeaserNachId } from "./teaser";
import type { Poi } from "./types";

function poi(id: string, fotos: string[]): Poi {
  return {
    id,
    tripId: "trip-1",
    number: 1,
    name: id,
    ort: "",
    type: "sehenswuerdigkeit",
    position: { lat: 0, lng: 0 },
    status: "gesetzt",
    photos: fotos.map((fotoId, index) => ({ id: fotoId, position: index + 1 })),
  };
}

describe("poiTeaserNachId (req-111)", () => {
  it("nennt je POI sein erstes Foto", () => {
    const teaser = poiTeaserNachId([poi("a", ["foto-1", "foto-2"])]);
    expect(teaser.get("a")).toBe("foto-1");
  });

  it("fuehrt einen POI ohne Foto nicht", () => {
    const teaser = poiTeaserNachId([
      poi("a", []),
      { ...poi("b", []), photos: undefined },
    ]);
    expect(teaser.size).toBe(0);
  });
});

describe("activityTeaserFoto (req-111)", () => {
  const teaser = poiTeaserNachId([poi("a", ["foto-1"]), poi("b", [])]);

  it("gibt dem Programmpunkt das Foto seines POI", () => {
    expect(activityTeaserFoto({ poiId: "a" }, teaser)).toBe("foto-1");
  });

  it("gibt einem POI ohne Foto und einem von Hand angelegten keines", () => {
    expect(activityTeaserFoto({ poiId: "b" }, teaser)).toBeNull();
    expect(activityTeaserFoto({}, teaser)).toBeNull();
    expect(activityTeaserFoto({ poiId: "" }, teaser)).toBeNull();
  });
});
