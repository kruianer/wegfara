import { describe, expect, it } from "vitest";
import { positionsAlterText } from "./alter";

const JETZT = new Date("2026-07-20T14:10:00.000Z");

describe("positionsAlterText (req-050)", () => {
  it("nennt zwei Minuten Alter", () => {
    expect(positionsAlterText("2026-07-20T14:08:00.000Z", JETZT)).toBe(
      "vor 2 Min",
    );
  });

  it("rundet auf ganze Minuten", () => {
    expect(positionsAlterText("2026-07-20T14:08:35.000Z", JETZT)).toBe(
      "vor 1 Min",
    );
  });

  it("sagt unter einer Minute 'gerade eben'", () => {
    expect(positionsAlterText("2026-07-20T14:09:40.000Z", JETZT)).toBe(
      "gerade eben",
    );
  });

  it("bleibt bei einer Zeit in der Zukunft bei 'gerade eben'", () => {
    expect(positionsAlterText("2026-07-20T14:10:30.000Z", JETZT)).toBe(
      "gerade eben",
    );
  });
});
