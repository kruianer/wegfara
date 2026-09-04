import { describe, expect, it } from "vitest";
import {
  formatDocumentDate,
  formatDocumentMeta,
  formatFileSize,
} from "./format";

describe("formatFileSize (req-034: die Karte zeigt die Groesse)", () => {
  it("zeigt kleine Dateien in Byte", () => {
    expect(formatFileSize(820)).toBe("820 B");
  });

  it("zeigt mittlere Dateien in Kilobyte", () => {
    expect(formatFileSize(412 * 1024)).toBe("412 KB");
  });

  it("zeigt grosse Dateien in Megabyte mit Dezimalkomma", () => {
    expect(formatFileSize(Math.round(1.8 * 1024 * 1024))).toBe("1,8 MB");
  });
});

describe("formatDocumentDate (req-034: die Karte zeigt das Datum)", () => {
  it("zeigt Tag, Monat und Jahr", () => {
    const iso = new Date(2026, 8, 4, 12, 30).toISOString();

    expect(formatDocumentDate(iso)).toBe("04.09.2026");
  });
});

describe("formatDocumentMeta (Vorlage: „Größe · Datum · Uploader“)", () => {
  const iso = new Date(2026, 8, 4, 12, 30).toISOString();

  it("nennt Groesse, Datum und die Person, die abgelegt hat", () => {
    expect(formatDocumentMeta(412 * 1024, iso, "Uwe")).toBe(
      "412 KB · 04.09.2026 · Uwe",
    );
  });

  it("laesst die Person weg, wenn sie nicht mehr im Account ist", () => {
    expect(formatDocumentMeta(412 * 1024, iso, null)).toBe(
      "412 KB · 04.09.2026",
    );
  });
});
