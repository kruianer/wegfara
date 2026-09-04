import { describe, expect, it } from "vitest";
import { NO_LINK_LABEL, documentLinkLabel, linkNames } from "./link";

const NAMEN = linkNames(
  [{ id: "poi-1", name: "Villa Rufolo" }],
  [{ id: "transfer-1", title: "Mietwagen" }],
);

describe("documentLinkLabel (req-034, Vorlage Abschnitt 5)", () => {
  it("nennt den verknuepften POI", () => {
    expect(
      documentLinkLabel({ poiId: "poi-1", transferId: null }, NAMEN),
    ).toEqual({ kind: "poi", text: "POI · Villa Rufolo" });
  });

  it("nennt den verknuepften Transfer", () => {
    expect(
      documentLinkLabel({ poiId: null, transferId: "transfer-1" }, NAMEN),
    ).toEqual({ kind: "transfer", text: "Transfer · Mietwagen" });
  });

  it("kennzeichnet ein unverknuepftes Dokument", () => {
    expect(documentLinkLabel({ poiId: null, transferId: null }, NAMEN)).toEqual(
      { kind: "keine", text: NO_LINK_LABEL },
    );
  });

  it("zeigt ein Dokument als unverknuepft, dessen POI es nicht mehr gibt", () => {
    expect(
      documentLinkLabel({ poiId: "weg", transferId: null }, NAMEN).kind,
    ).toBe("keine");
  });
});
