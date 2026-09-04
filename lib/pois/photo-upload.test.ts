import { describe, expect, it } from "vitest";
import {
  MAX_POI_PHOTO_BYTES,
  POI_PHOTO_ERRORS,
  poiPhotoContentType,
  poiPhotoContentTypeOfFileName,
  poiPhotoUploadProblem,
  storedPhotoFileName,
} from "./photo-upload";

describe("poiPhotoContentType (req-035)", () => {
  it("nimmt die Art, die der Browser meldet", () => {
    expect(poiPhotoContentType("image/png", "bucht.png")).toBe("image/png");
  });

  it("faellt auf die Endung zurueck", () => {
    expect(poiPhotoContentType("", "bucht.JPEG")).toBe("image/jpeg");
  });

  it("weist eine PDF-Datei ab -- sie ist kein Foto eines Ortes", () => {
    expect(poiPhotoContentType("application/pdf", "ticket.pdf")).toBeNull();
  });
});

describe("poiPhotoUploadProblem (req-035)", () => {
  it("nimmt ein Bild bis 20 MB an", () => {
    expect(
      poiPhotoUploadProblem({
        name: "bucht.jpg",
        type: "image/jpeg",
        size: MAX_POI_PHOTO_BYTES,
      }),
    ).toBeNull();
  });

  it("weist ein Bild ueber 20 MB ab", () => {
    expect(
      poiPhotoUploadProblem({
        name: "bucht.jpg",
        type: "image/jpeg",
        size: MAX_POI_PHOTO_BYTES + 1,
      }),
    ).toBe(POI_PHOTO_ERRORS.size);
  });

  it("weist eine leere Datei ab", () => {
    expect(
      poiPhotoUploadProblem({ name: "bucht.jpg", type: "image/jpeg", size: 0 }),
    ).toBe(POI_PHOTO_ERRORS.empty);
  });

  it("weist an, was kein Bild ist", () => {
    expect(
      poiPhotoUploadProblem({
        name: "ticket.pdf",
        type: "application/pdf",
        size: 10,
      }),
    ).toBe(POI_PHOTO_ERRORS.type);
  });
});

describe("storedPhotoFileName (req-035, Constraints)", () => {
  it("laesst vom hochgeladenen Namen nichts uebrig", () => {
    expect(storedPhotoFileName("abc-123", "image/png")).toBe("abc-123.png");
  });
});

describe("poiPhotoContentTypeOfFileName", () => {
  it("liest die Art aus der Endung", () => {
    expect(poiPhotoContentTypeOfFileName("abc.png")).toBe("image/png");
  });

  it("liefert fuer Unbekanntes die Art der Google-Fotos", () => {
    expect(poiPhotoContentTypeOfFileName("abc")).toBe("image/jpeg");
  });
});
