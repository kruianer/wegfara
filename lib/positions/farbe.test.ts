import { describe, expect, it } from "vitest";
import { positionColor } from "./farbe";

describe("positionColor (req-050)", () => {
  it("gibt derselben Person immer dieselbe Farbe", () => {
    expect(positionColor("person-1")).toBe(positionColor("person-1"));
  });

  it("gibt unterschiedlichen Personen typischerweise unterschiedliche Farben", () => {
    expect(positionColor("person-1")).not.toBe(positionColor("person-2"));
  });

  it("liefert immer eine gueltige Hex-Farbe", () => {
    expect(positionColor("irgendeine-uuid-1234")).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
