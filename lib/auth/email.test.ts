// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isPlausibleEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("vereinheitlicht Gross-/Kleinschreibung und Leerzeichen", () => {
    expect(normalizeEmail("  Uwe@Kremmel.org ")).toBe("uwe@kremmel.org");
  });
});

describe("isPlausibleEmail", () => {
  it("nimmt eine gewoehnliche Adresse an", () => {
    expect(isPlausibleEmail("uwe@kremmel.org")).toBe(true);
  });

  it.each([
    "",
    "uwe",
    "uwe@",
    "@kremmel.org",
    "uwe@kremmel",
    "uwe kremmel@x.de",
  ])("weist %j ab", (value) => {
    expect(isPlausibleEmail(value)).toBe(false);
  });
});
