import { describe, expect, it } from "vitest";
import { lokaleZeit, uhrzeit } from "./zeit";

describe("lokaleZeit (req-051)", () => {
  it("schreibt die lokale Zeit wie an einem Programmpunkt", () => {
    expect(lokaleZeit(new Date(2026, 6, 20, 14, 10))).toBe("2026-07-20T14:10");
  });

  it("fuellt einstellige Werte auf", () => {
    expect(lokaleZeit(new Date(2026, 0, 5, 7, 3))).toBe("2026-01-05T07:03");
  });
});

describe("uhrzeit (req-051)", () => {
  it("liest die Uhrzeit aus einer lokalen Zeit", () => {
    expect(uhrzeit("2026-07-20T14:10")).toBe("14:10");
  });
});
