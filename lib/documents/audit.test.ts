import { describe, expect, it, vi } from "vitest";
import type { DocumentFileRef } from "../db/documents";
import { compareDocuments, runDocumentAudit } from "./audit";

const FLUGTICKET: DocumentFileRef = {
  id: "dok-1",
  name: "Flugticket.pdf",
  fileName: "aaaa.pdf",
};

function pruefung(files: string[], refs: DocumentFileRef[]) {
  const removeFile = vi.fn(async () => {});
  const report = vi.fn();
  return {
    removeFile,
    report,
    lauf: runDocumentAudit({
      listFiles: async () => files,
      listRefs: async () => refs,
      removeFile,
      report,
    }),
  };
}

describe("compareDocuments (req-034)", () => {
  it("findet Dateien ohne Datensatz und Datensaetze ohne Datei", () => {
    expect(
      compareDocuments(["aaaa.pdf", "verwaist.jpg"], [FLUGTICKET]),
    ).toEqual({
      orphanFiles: ["verwaist.jpg"],
      missingFiles: [],
    });
    expect(compareDocuments([], [FLUGTICKET])).toEqual({
      orphanFiles: [],
      missingFiles: [FLUGTICKET],
    });
  });

  it("meldet nichts, wenn beide Seiten zueinander passen", () => {
    expect(compareDocuments(["aaaa.pdf"], [FLUGTICKET])).toEqual({
      orphanFiles: [],
      missingFiles: [],
    });
  });
});

describe("runDocumentAudit (req-034, taegliche Pruefung)", () => {
  it("entfernt eine Datei ohne Datensatz -- sie ist wertlos", async () => {
    const { removeFile, lauf } = pruefung(
      ["aaaa.pdf", "verwaist.jpg"],
      [FLUGTICKET],
    );

    const ergebnis = await lauf;

    expect(removeFile).toHaveBeenCalledTimes(1);
    expect(removeFile).toHaveBeenCalledWith("verwaist.jpg");
    expect(ergebnis.removedFiles).toEqual(["verwaist.jpg"]);
  });

  it("entfernt einen Datensatz ohne Datei NICHT, sondern meldet ihn", async () => {
    const { removeFile, report, lauf } = pruefung([], [FLUGTICKET]);

    const ergebnis = await lauf;

    expect(removeFile).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith([FLUGTICKET]);
    expect(ergebnis.missingFiles).toEqual([FLUGTICKET]);
  });

  it("meldet nichts, wenn nichts fehlt", async () => {
    const { removeFile, report, lauf } = pruefung(["aaaa.pdf"], [FLUGTICKET]);

    const ergebnis = await lauf;

    expect(removeFile).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
    expect(ergebnis).toEqual({ removedFiles: [], missingFiles: [] });
  });
});
