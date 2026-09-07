import { describe, expect, it } from "vitest";
import { zeigtLiveStatus } from "./sichtbar";

const REISE = {
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  state: "freigegeben",
} as const;

describe("zeigtLiveStatus (req-051)", () => {
  it("zeigt ihn waehrend einer freigegebenen Reise", () => {
    expect(zeigtLiveStatus(REISE, "2026-07-20")).toBe(true);
  });

  it("zeigt ihn am ersten und am letzten Reisetag", () => {
    expect(zeigtLiveStatus(REISE, "2026-07-18")).toBe(true);
    expect(zeigtLiveStatus(REISE, "2026-07-23")).toBe(true);
  });

  it("zeigt ihn nicht, solange die Reise in Planung ist", () => {
    expect(
      zeigtLiveStatus({ ...REISE, state: "in_planung" }, "2026-07-20"),
    ).toBe(false);
  });

  it("zeigt ihn nicht, wenn der Zeitraum gestern endete", () => {
    expect(zeigtLiveStatus(REISE, "2026-07-24")).toBe(false);
  });

  it("zeigt ihn nicht vor Beginn der Reise", () => {
    expect(zeigtLiveStatus(REISE, "2026-07-17")).toBe(false);
  });

  it("zeigt ihn nicht bei einer abgeschlossenen Reise", () => {
    expect(
      zeigtLiveStatus({ ...REISE, state: "abgeschlossen" }, "2026-07-20"),
    ).toBe(false);
  });
});
