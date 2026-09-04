import { describe, expect, it } from "vitest";
import type { TripDocument } from "./types";
import { DOCUMENT_FILTERS, filterDocuments } from "./filter";

function dokument(
  id: string,
  link: Partial<Pick<TripDocument, "poiId" | "transferId">> = {},
): TripDocument {
  return {
    id,
    tripId: "reise-1",
    name: `${id}.pdf`,
    contentType: "application/pdf",
    sizeBytes: 1000,
    pageCount: 1,
    poiId: link.poiId ?? null,
    transferId: link.transferId ?? null,
    uploadedById: "person-1",
    createdAt: "2026-09-04T10:00:00.000Z",
  };
}

const MIT_POI = dokument("mit-poi", { poiId: "poi-1" });
const MIT_TRANSFER = dokument("mit-transfer", { transferId: "transfer-1" });
const OHNE = dokument("ohne");
const ALLE = [MIT_POI, MIT_TRANSFER, OHNE];

describe("DOCUMENT_FILTERS (Vorlage, Abschnitt 5)", () => {
  it("bietet Alle, Mit POI, Mit Transfer und Ohne Verknuepfung", () => {
    expect(DOCUMENT_FILTERS.map((filter) => filter.label)).toEqual([
      "Alle",
      "Mit POI verknüpft",
      "Mit Transfer verknüpft",
      "Ohne Verknüpfung",
    ]);
  });
});

describe("filterDocuments (req-034)", () => {
  it('laesst bei "Alle" alles stehen', () => {
    expect(filterDocuments(ALLE, "alle")).toEqual(ALLE);
  });

  it("zeigt nur die mit einem POI verknuepften", () => {
    expect(filterDocuments(ALLE, "poi")).toEqual([MIT_POI]);
  });

  it("zeigt nur die mit einem Transfer verknuepften", () => {
    expect(filterDocuments(ALLE, "transfer")).toEqual([MIT_TRANSFER]);
  });

  it("zeigt nur die unverknuepften", () => {
    expect(filterDocuments(ALLE, "ohne")).toEqual([OHNE]);
  });
});
