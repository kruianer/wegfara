import { describe, expect, it } from "vitest";
import { formatBackupEntry, formatBackupTime, formatBytes } from "./format";
import type { BackupEntry } from "./types";

describe("formatBytes (req-053)", () => {
  it("nennt kleine Groessen in Bytes", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
    expect(formatBytes(512)).toBe("512 Bytes");
  });

  it("steigt in die naechste Einheit", () => {
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 GB");
  });

  it("rundet auf eine Nachkommastelle", () => {
    expect(formatBytes(1536)).toBe("1,5 KB");
  });

  it("bleibt bei einer unsinnigen Angabe stumm", () => {
    expect(formatBytes(Number.NaN)).toBe("–");
    expect(formatBytes(-1)).toBe("–");
  });
});

describe("formatBackupTime (req-053)", () => {
  it("zeigt Datum und Uhrzeit", () => {
    expect(formatBackupTime("2026-09-07T10:15:00.000Z")).toMatch(
      /07\.09\.2026/,
    );
  });

  it("gibt eine unlesbare Angabe unveraendert zurueck", () => {
    expect(formatBackupTime("kein Zeitpunkt")).toBe("kein Zeitpunkt");
  });
});

describe("formatBackupEntry (req-053)", () => {
  it("nennt Zeitpunkt, Herkunft und Groesse", () => {
    const entry: BackupEntry = {
      id: "20260907_101500_vor_deploy",
      version: 1,
      createdAt: "2026-09-07T10:15:00.000Z",
      source: "vor_deploy",
      environment: "prod",
      rowCount: 120,
      imageCount: 3,
      sizeBytes: 5 * 1024 * 1024,
    };

    const text = formatBackupEntry(entry);

    expect(text).toContain("vor Deploy");
    expect(text).toContain("5 MB");
    expect(text).toContain("07.09.2026");
  });
});
