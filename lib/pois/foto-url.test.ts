import { describe, expect, it } from "vitest";
import { poiFotoUrl } from "./foto-url";

describe("poiFotoUrl", () => {
  it("fuehrt zur eigenen Schnittstelle der Bildablage", () => {
    expect(poiFotoUrl("foto-1")).toBe("/api/poi-fotos/foto-1");
  });
});
