import { describe, expect, it } from "vitest";
import {
  leseZustand,
  meldeZeilen,
  stelleZustandHer,
  zusammenfassung,
} from "./mockup-pruefung";

describe("Layout-Pruefung der Mockups -- Zustand aus dem Hash (req-091)", () => {
  it("liest Zustaende und Klicks, auch mehrere durch Komma", () => {
    expect(leseZustand("#zustand=entfernen")).toEqual({
      zustaende: ["entfernen"],
      klicks: [],
    });
    expect(leseZustand("#zustand=a,b&klick=knopf")).toEqual({
      zustaende: ["a", "b"],
      klicks: ["knopf"],
    });
    expect(leseZustand("")).toEqual({ zustaende: [], klicks: [] });
  });

  it("zeigt genau die Elemente des Zustands und verbirgt die uebrigen", () => {
    document.body.innerHTML = `
      <div data-zustand="entfernen" hidden>Dialog</div>
      <div data-zustand="ausgabe">Blatt</div>
      <p>bleibt</p>`;
    stelleZustandHer(document, leseZustand("#zustand=entfernen"));
    const [dialog, blatt] = Array.from(
      document.querySelectorAll<HTMLElement>("[data-zustand]"),
    );
    expect(dialog.hidden).toBe(false);
    expect(blatt.hidden).toBe(true);

    stelleZustandHer(document, leseZustand("#"));
    expect(dialog.hidden).toBe(true);
  });

  it("klickt das genannte Element", () => {
    document.body.innerHTML = `<details><summary id="auf">Mehr</summary>x</details>`;
    stelleZustandHer(document, leseZustand("#klick=auf"));
    expect(document.querySelector("details")!.open).toBe(true);
  });
});

describe("Layout-Pruefung der Mockups -- die Meldung (req-091)", () => {
  it("meldet OK mit den geprueften Breiten, wenn nichts verletzt ist", () => {
    expect(
      zusammenfassung([
        { breite: 375, verstoesse: [] },
        { breite: 768, verstoesse: [] },
        { breite: 1280, verstoesse: [] },
      ]),
    ).toBe("OK — geprüft bei 375, 768, 1280 px");
  });

  it("nennt jeden Verstoss mit Regel und Breite", () => {
    const ergebnisse = [
      {
        breite: 375,
        verstoesse: [
          {
            regel: "tippziel" as const,
            element: 'button "×"',
            beschreibung: "20×20px",
          },
        ],
      },
      {
        breite: 768,
        verstoesse: [
          {
            regel: "rand" as const,
            element: "div",
            beschreibung: "Seite ist 900px breit bei 768px Sichtfenster",
          },
        ],
      },
    ];
    expect(zusammenfassung(ergebnisse)).toBe("2 Verstöße");
    expect(meldeZeilen(ergebnisse)).toEqual([
      'Tippziele sind mindestens 44×44 px groß — bei 375 px: button "×" (20×20px)',
      "Nichts steht über den Rand — bei 768 px: div (Seite ist 900px breit bei 768px Sichtfenster)",
    ]);
  });
});
