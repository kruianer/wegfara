import { describe, expect, it } from "vitest";
import { documentExtensionLabel, isPdf, storedFileName } from "./file-name";

describe("storedFileName (req-034, Constraints)", () => {
  it("baut den Namen aus Kennung und Art", () => {
    expect(storedFileName("abc-123", "application/pdf")).toBe("abc-123.pdf");
    expect(storedFileName("abc-123", "image/jpeg")).toBe("abc-123.jpg");
  });

  it("uebernimmt nichts aus dem hochgeladenen Namen", () => {
    // Ein hochgeladener Name wie "../boese.pdf" darf den Ablageort nicht
    // bestimmen -- er kommt hier gar nicht erst vor.
    const name = storedFileName(
      "11111111-2222-3333-4444-555555555555",
      "image/png",
    );

    expect(name).toBe("11111111-2222-3333-4444-555555555555.png");
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
  });
});

describe("documentExtensionLabel (Vorlage, Abschnitt 5)", () => {
  it("nimmt die Endung des Namens", () => {
    expect(documentExtensionLabel("Flugticket.pdf", "application/pdf")).toBe(
      "PDF",
    );
  });

  it("faellt auf die Art zurueck, wenn der Name keine Endung hat", () => {
    expect(documentExtensionLabel("Flugticket", "image/jpeg")).toBe("JPEG");
  });
});

describe("isPdf", () => {
  it("unterscheidet PDF von Bild", () => {
    expect(isPdf("application/pdf")).toBe(true);
    expect(isPdf("image/jpeg")).toBe(false);
  });
});
