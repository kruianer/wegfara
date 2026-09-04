import { describe, expect, it } from "vitest";
import { pdfPageCount } from "./pdf-pages";

function pdf(text: string): Uint8Array {
  return new Uint8Array(Array.from(text, (zeichen) => zeichen.charCodeAt(0)));
}

/** Ein sehr kleines, aber echtes PDF-Geruest mit `seiten` Seitenobjekten. */
function pdfMitSeiten(seiten: number): Uint8Array {
  const objekte = Array.from(
    { length: seiten },
    (_, index) =>
      `${index + 3} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`,
  ).join("");
  return pdf(
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n` +
      `2 0 obj\n<< /Type /Pages /Count ${seiten} >>\nendobj\n` +
      objekte +
      `trailer\n<< /Root 1 0 R >>\n%%EOF\n`,
  );
}

describe("pdfPageCount (req-034: bei mehrseitigen PDF-Dateien laesst sich blaettern)", () => {
  it("zaehlt eine Seite", () => {
    expect(pdfPageCount(pdfMitSeiten(1))).toBe(1);
  });

  it("zaehlt mehrere Seiten", () => {
    expect(pdfPageCount(pdfMitSeiten(3))).toBe(3);
  });

  it("verwechselt den Seitenbaum nicht mit einer Seite", () => {
    const nurBaum = pdf(
      "%PDF-1.4\n2 0 obj\n<< /Type /Pages /Kids [] /Count 7 >>\nendobj\n",
    );

    expect(pdfPageCount(nurBaum)).toBe(7);
  });

  it("liefert null, wenn sich nichts erkennen laesst", () => {
    expect(pdfPageCount(pdf("kein pdf"))).toBeNull();
  });

  it("kommt mit einer grossen Datei zurecht", () => {
    const gross = new Uint8Array(300_000);
    gross.set(pdfMitSeiten(2), 0);

    expect(pdfPageCount(gross)).toBe(2);
  });
});
