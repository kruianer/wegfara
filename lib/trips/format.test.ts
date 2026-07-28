// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatDateRange, formatDayChipDate } from "./format";

describe("formatDateRange", () => {
  it("formatiert einen Zeitraum innerhalb desselben Monats", () => {
    expect(
      formatDateRange({ startDate: "2026-07-18", endDate: "2026-07-23" }),
    ).toBe("18. – 23. Juli 2026");
  });

  it("formatiert einen Zeitraum ueber einen Monatswechsel hinweg", () => {
    expect(
      formatDateRange({ startDate: "2026-07-30", endDate: "2026-08-02" }),
    ).toBe("30. Juli – 2. August 2026");
  });

  it("formatiert einen Zeitraum ueber einen Jahreswechsel hinweg", () => {
    expect(
      formatDateRange({ startDate: "2026-12-30", endDate: "2027-01-02" }),
    ).toBe("30. Dezember 2026 – 2. Januar 2027");
  });
});

describe("formatDayChipDate", () => {
  it("formatiert als TT.MM.", () => {
    expect(formatDayChipDate("2026-07-20")).toBe("20.07.");
  });
});
