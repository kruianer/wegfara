import { describe, expect, it } from "vitest";
import {
  KOMPASSROSE_ANTEIL,
  KOMPASSROSE_AUSSEN,
  KOMPASSROSE_INNEN,
  KOMPASSROSE_VIEWBOX,
  kompassroseIconSvg,
} from "./kompassrose";
import { ICON_FARBEN } from "./icon-farben";

describe("Kompassrose als Icon (req-065)", () => {
  it("zeichnet beide Sterne des Zeichens", () => {
    const svg = kompassroseIconSvg(32, ICON_FARBEN);

    expect(svg).toContain(KOMPASSROSE_AUSSEN);
    expect(svg).toContain(KOMPASSROSE_INNEN);
  });

  it("baut ein SVG in der angefragten Kantenlaenge", () => {
    const svg = kompassroseIconSvg(180, ICON_FARBEN);

    expect(svg).toContain('width="180"');
    expect(svg).toContain('height="180"');
    expect(svg).toContain(
      `viewBox="0 0 ${KOMPASSROSE_VIEWBOX} ${KOMPASSROSE_VIEWBOX}"`,
    );
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("laesst der Rose Rand, statt sie bis an die Kante laufen zu lassen", () => {
    expect(KOMPASSROSE_ANTEIL).toBeLessThan(1);

    const rand = (KOMPASSROSE_VIEWBOX * (1 - KOMPASSROSE_ANTEIL)) / 2;
    expect(kompassroseIconSvg(32, ICON_FARBEN)).toContain(
      `transform="translate(${rand} ${rand}) scale(${KOMPASSROSE_ANTEIL})"`,
    );
  });

  it("zeichnet die Rose in der Zeichenfarbe", () => {
    const svg = kompassroseIconSvg(32, {
      grund: "#101010",
      zeichen: "#fefefe",
    });

    expect(svg).toContain('stroke="#fefefe"');
    expect(svg).toContain('fill="#fefefe"');
  });
});
