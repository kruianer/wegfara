import { describe, expect, it } from "vitest";
import { toIsoDateTimeString } from "./sql-datetime";

describe("toIsoDateTimeString", () => {
  it("liefert dieselbe Uhrzeit unabhaengig von der Zeitzone der ausfuehrenden Umgebung (bug-004)", () => {
    // So liefert der pg-Treiber eine "timestamp without time zone"-Spalte:
    // ein Date, dessen Komponenten er als UTC interpretiert hat.
    const value = new Date(Date.UTC(2026, 6, 18, 13, 30));

    expect(toIsoDateTimeString(value)).toBe("2026-07-18T13:30");
  });

  it("verschiebt die Uhrzeit nicht ueber Mitternacht hinweg", () => {
    const value = new Date(Date.UTC(2026, 6, 18, 23, 45));

    expect(toIsoDateTimeString(value)).toBe("2026-07-18T23:45");
  });

  it("verarbeitet einen reinen String-Wert unveraendert", () => {
    expect(toIsoDateTimeString("2026-07-18 13:30:00")).toBe("2026-07-18T13:30");
  });
});
