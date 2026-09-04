import { afterEach, describe, expect, it, vi } from "vitest";
import { qrMatrixFor, type QrMatrix } from "./qr-code";
import {
  QR_IMAGE_MODULE_PIXELS,
  drawQrMatrix,
  qrPngFile,
  shareQrImage,
} from "./qr-image";

/**
 * Ein winziges Raster -- gross genug, um Grund und Module auseinanderzuhalten,
 * klein genug, um jeden Aufruf zu zaehlen.
 */
const MATRIX: QrMatrix = {
  size: 2,
  dark: [
    [true, false],
    [false, true],
  ],
};

/** Eine Zeichenflaeche, die sich merkt, was auf sie gemalt wurde. */
function flaeche() {
  const rechtecke: { x: number; y: number; breite: number; farbe: string }[] =
    [];
  const context = {
    fillStyle: "",
    fillRect(x: number, y: number, breite: number) {
      rechtecke.push({ x, y, breite, farbe: context.fillStyle });
    },
  };
  return { context, rechtecke };
}

/**
 * Die Zeichenflaeche des Browsers gibt es in der Testumgebung nicht -- sie
 * wird durch eine ersetzt, die ein PNG zurueckgibt.
 */
function stubCanvas(blob: Blob | null = new Blob(["png"])) {
  const { context, rechtecke } = flaeche();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(blob),
  );
  return rechtecke;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("drawQrMatrix (req-031)", () => {
  it("malt weissen Grund und je dunklem Modul ein schwarzes Quadrat", () => {
    const { context, rechtecke } = flaeche();

    drawQrMatrix(context as unknown as CanvasRenderingContext2D, MATRIX, 10);

    expect(rechtecke[0]).toEqual({ x: 0, y: 0, breite: 20, farbe: "#ffffff" });
    expect(rechtecke.slice(1)).toEqual([
      { x: 0, y: 0, breite: 10, farbe: "#000000" },
      { x: 10, y: 10, breite: 10, farbe: "#000000" },
    ]);
  });
});

describe("qrPngFile (req-031)", () => {
  it("gibt den Code als PNG-Datei zurueck", async () => {
    stubCanvas();

    const file = await qrPngFile(MATRIX, "ueberweisungscode.png");

    expect(file?.name).toBe("ueberweisungscode.png");
    expect(file?.type).toBe("image/png");
  });

  it("macht das Bild so gross wie das Raster mal die Modulgroesse", async () => {
    const rechtecke = stubCanvas();

    await qrPngFile(qrMatrixFor("BCD"), "ueberweisungscode.png");

    const grund = rechtecke[0];
    expect(grund.breite).toBe(qrMatrixFor("BCD").size * QR_IMAGE_MODULE_PIXELS);
  });

  it("gibt null zurueck, wenn das Geraet keine Zeichenflaeche hergibt", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    expect(await qrPngFile(MATRIX, "ueberweisungscode.png")).toBeNull();
  });
});

describe("shareQrImage (req-031)", () => {
  it("reicht den Code als Bild an eine andere App weiter", async () => {
    stubCanvas();
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      share,
      canShare: () => true,
    });

    const ergebnis = await shareQrImage(MATRIX, "ueberweisungscode.png", "Uwe");

    expect(ergebnis).toBe("geteilt");
    const [{ files }] = share.mock.calls[0] as unknown as [{ files: File[] }];
    expect(files[0].type).toBe("image/png");
  });

  it("legt das Bild ab, wo das Geraet nichts zum Teilen anbietet", async () => {
    stubCanvas();
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:code",
      revokeObjectURL: () => {},
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const ergebnis = await shareQrImage(MATRIX, "ueberweisungscode.png", "Uwe");

    expect(ergebnis).toBe("gespeichert");
    expect(click).toHaveBeenCalled();
  });

  it("legt nichts ab, wenn der Nutzer das Teilen abbricht", async () => {
    stubCanvas();
    const abbruch = Object.assign(new Error("abgebrochen"), {
      name: "AbortError",
    });
    vi.stubGlobal("navigator", {
      share: vi.fn(async () => {
        throw abbruch;
      }),
      canShare: () => true,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const ergebnis = await shareQrImage(MATRIX, "ueberweisungscode.png", "Uwe");

    expect(ergebnis).toBe("abgebrochen");
    expect(click).not.toHaveBeenCalled();
  });

  it("meldet, wenn sich gar kein Bild erzeugen laesst", async () => {
    stubCanvas(null);
    vi.stubGlobal("navigator", {});

    expect(await shareQrImage(MATRIX, "ueberweisungscode.png", "Uwe")).toBe(
      "gescheitert",
    );
  });
});
