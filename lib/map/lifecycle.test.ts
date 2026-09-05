import { afterEach, describe, expect, it, vi } from "vitest";
import { removeMap, resizeMap } from "./lifecycle";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Lebenszyklus der Karte", () => {
  it("gleicht die Groesse an", () => {
    const resize = vi.fn();
    resizeMap({ resize });
    expect(resize).toHaveBeenCalledTimes(1);
  });

  it("baut die Karte ab", () => {
    const remove = vi.fn();
    removeMap({ remove });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  // Ohne WebGL2 entsteht eine Karte ohne Zeichenwerk; ihr Abbau wirft. Das
  // Aufraeumen eines Effekts darf davon nicht die ganze Ansicht mitreissen.
  it("laesst einen Fehler beim Abbau nicht nach aussen", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const remove = () => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'destroy')",
      );
    };

    expect(() => removeMap({ remove })).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("laesst einen Fehler beim Groessenabgleich nicht nach aussen", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const resize = () => {
      throw new TypeError(
        "Cannot read properties of undefined (reading 'resize')",
      );
    };

    expect(() => resizeMap({ resize })).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
