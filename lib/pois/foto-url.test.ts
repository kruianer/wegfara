import { describe, expect, it } from "vitest";
import { poiFotoUrl, poiMiniaturUrl, willMiniatur } from "./foto-url";

describe("poiFotoUrl", () => {
  it("fuehrt zur eigenen Schnittstelle der Bildablage", () => {
    expect(poiFotoUrl("foto-1")).toBe("/api/poi-fotos/foto-1");
  });
});

describe("poiMiniaturUrl (req-105)", () => {
  it("fuehrt zur selben Schnittstelle und verlangt die Miniatur", () => {
    expect(poiMiniaturUrl("foto-1")).toBe(
      "/api/poi-fotos/foto-1?groesse=miniatur",
    );
  });

  it("wird von der Route als Wunsch nach der Miniatur erkannt", () => {
    const basis = "https://dev.wegfara.com";
    expect(willMiniatur(new Request(basis + poiMiniaturUrl("foto-1")))).toBe(
      true,
    );
    expect(willMiniatur(new Request(basis + poiFotoUrl("foto-1")))).toBe(false);
  });
});
