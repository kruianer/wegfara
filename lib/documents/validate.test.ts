import { describe, expect, it } from "vitest";
import {
  DOCUMENT_ERRORS,
  DOCUMENT_NAME_MAX_LENGTH,
  MAX_DOCUMENT_BYTES,
  documentContentType,
  documentName,
  documentNameProblem,
  documentUploadProblem,
  fileExtension,
  isAllowedDocumentType,
} from "./validate";

describe("documentUploadProblem (req-034)", () => {
  it("laesst eine PDF-Datei durch", () => {
    expect(
      documentUploadProblem({
        name: "Flugticket.pdf",
        type: "application/pdf",
        size: 240_000,
      }),
    ).toBeNull();
  });

  it("laesst ein Foto durch", () => {
    expect(
      documentUploadProblem({
        name: "ticket.jpg",
        type: "image/jpeg",
        size: 1_200_000,
      }),
    ).toBeNull();
  });

  it("weist eine Datei mit 25 MB ab und nennt den Grund", () => {
    expect(
      documentUploadProblem({
        name: "video.pdf",
        type: "application/pdf",
        size: 25 * 1024 * 1024,
      }),
    ).toBe(DOCUMENT_ERRORS.size);
  });

  it("laesst genau 20 MB noch durch", () => {
    expect(
      documentUploadProblem({
        name: "gross.pdf",
        type: "application/pdf",
        size: MAX_DOCUMENT_BYTES,
      }),
    ).toBeNull();
  });

  it('weist eine Datei mit der Endung ".zip" ab und nennt den Grund', () => {
    expect(
      documentUploadProblem({
        name: "unterlagen.zip",
        type: "application/zip",
        size: 4_000,
      }),
    ).toBe(DOCUMENT_ERRORS.type);
  });

  it("weist auch eine .zip-Datei ab, die sich als PDF ausgibt", () => {
    // Die Art meldet der Browser; sie zaehlt, wenn sie erlaubt ist. Hier ist
    // sie es nicht -- und die Endung ebenso wenig.
    expect(
      documentUploadProblem({
        name: "unterlagen.zip",
        type: "application/x-zip-compressed",
        size: 4_000,
      }),
    ).toBe(DOCUMENT_ERRORS.type);
  });

  it("weist eine leere Datei ab", () => {
    expect(documentUploadProblem({ name: "leer.pdf", type: "", size: 0 })).toBe(
      DOCUMENT_ERRORS.empty,
    );
  });
});

describe("documentContentType", () => {
  it("nimmt die gemeldete Art, wenn sie erlaubt ist", () => {
    expect(documentContentType("image/png", "bild.png")).toBe("image/png");
  });

  it("faellt auf die Endung zurueck, wenn der Browser nichts meldet", () => {
    expect(documentContentType("", "Flugticket.PDF")).toBe("application/pdf");
    expect(documentContentType(undefined, "ticket.jpeg")).toBe("image/jpeg");
  });

  it("liefert null fuer alles andere", () => {
    expect(documentContentType("application/zip", "a.zip")).toBeNull();
    expect(documentContentType("", "ohne-endung")).toBeNull();
  });
});

describe("isAllowedDocumentType", () => {
  it("kennt Bilder und PDF", () => {
    expect(isAllowedDocumentType("application/pdf")).toBe(true);
    expect(isAllowedDocumentType("image/heic")).toBe(true);
    expect(isAllowedDocumentType("text/plain")).toBe(false);
    expect(isAllowedDocumentType(null)).toBe(false);
  });
});

describe("fileExtension", () => {
  it("liefert die Endung klein geschrieben", () => {
    expect(fileExtension("Flugticket.PDF")).toBe("pdf");
  });

  it("liefert nichts, wenn es keine gibt", () => {
    expect(fileExtension("Flugticket")).toBe("");
    expect(fileExtension(".versteckt")).toBe("");
  });
});

describe("documentName", () => {
  it("nimmt den Namen der hochgeladenen Datei", () => {
    expect(documentName("Flugticket.pdf")).toBe("Flugticket.pdf");
  });

  it("schneidet einen Pfadanteil ab -- der Name benennt nur, er legt nicht ab", () => {
    expect(documentName("../../etc/passwd")).toBe("passwd");
  });

  it("faellt auf einen Ersatznamen zurueck", () => {
    expect(documentName("   ")).toBe("Dokument");
  });

  it("kuerzt einen ueberlangen Namen", () => {
    expect(documentName("a".repeat(300))).toHaveLength(
      DOCUMENT_NAME_MAX_LENGTH,
    );
  });
});

describe("documentNameProblem", () => {
  it("verlangt einen Namen", () => {
    expect(documentNameProblem("  ")).not.toBeNull();
  });

  it("begrenzt die Laenge", () => {
    expect(documentNameProblem("a".repeat(DOCUMENT_NAME_MAX_LENGTH + 1))).toBe(
      DOCUMENT_ERRORS.name,
    );
  });

  it("laesst einen gewoehnlichen Namen durch", () => {
    expect(documentNameProblem("Mietwagen Neapel")).toBeNull();
  });
});
