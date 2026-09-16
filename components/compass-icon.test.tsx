import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CompassIcon } from "./compass-icon";
import {
  KOMPASSROSE_AUSSEN,
  KOMPASSROSE_INNEN,
  kompassroseIconSvg,
} from "@/lib/icon/kompassrose";
import { ICON_FARBEN } from "@/lib/icon/icon-farben";

describe("Kompassrose der Marke (req-065)", () => {
  it("ist dasselbe Zeichen wie das Icon fuer Tab und Homescreen", () => {
    // Ein zweites Zeichen darf es nicht geben: was die Anmeldeseite zeigt,
    // liegt auch auf dem Homescreen. Beide holen ihre Pfade aus derselben
    // Quelle -- und genau das prueft dieser Vergleich.
    const { container } = render(<CompassIcon />);
    const gezeichnet = [...container.querySelectorAll("path")].map((pfad) =>
      pfad.getAttribute("d"),
    );

    expect(gezeichnet).toEqual([KOMPASSROSE_AUSSEN, KOMPASSROSE_INNEN]);

    const icon = kompassroseIconSvg(180, ICON_FARBEN);
    for (const pfad of gezeichnet) {
      expect(icon).toContain(pfad);
    }
  });
});
