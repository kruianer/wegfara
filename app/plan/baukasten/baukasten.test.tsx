import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BAUKASTEN_PATH,
  BAUSTEINE,
  bausteinPfad,
} from "@/lib/design/baukasten";
import {
  kontrastVerhaeltnis,
  MINDESTKONTRAST_FLIESSTEXT,
} from "@/lib/design/kontrast";
import { FARBWELT_PLANER, SCREEN_WIDTHS_PX } from "@/lib/design/stil";
import { KatalogView, rahmenMassstab } from "./katalog-view";
import { BausteinSeite } from "./bausteine";

function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Alle Regeln zu genau diesem Selektor -- am Zeilenanfang. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (css.match(new RegExp(`^${escaped}\\s*{[^}]*}`, "gm")) ?? []).join(
    "\n",
  );
}

describe("Baukasten -- der Katalog (req-089)", () => {
  it("zeigt jeden Baustein in drei Rahmen: 375, 768 und 1280 px", () => {
    render(<KatalogView />);

    for (const baustein of BAUSTEINE) {
      const abschnitt = screen.getByTestId(`baustein-${baustein.id}`);
      expect(
        within(abschnitt).getByRole("heading", { name: baustein.titel }),
      ).toBeInTheDocument();
      for (const breite of SCREEN_WIDTHS_PX) {
        const rahmen = within(abschnitt).getByTitle(
          `${baustein.titel} bei ${breite} px`,
        );
        // Der Rahmen hat die volle Breite -- verkleinert wird nur das Bild.
        expect(rahmen).toHaveAttribute("width", String(breite));
        expect(rahmen).toHaveAttribute("src", bausteinPfad(baustein));
      }
    }
  });

  it("zeigt Knöpfe und die Seitenleiste in beiden Zuständen", () => {
    const ids = BAUSTEINE.map((baustein) => baustein.id);
    expect(ids).toContain("knoepfe");
    expect(ids).toContain("seitenleiste-eingeklappt");
    expect(ids).toContain("seitenleiste-aufgeklappt");
    expect(ids).toEqual(
      expect.arrayContaining([
        "farben",
        "felder",
        "umschalter",
        "kacheln",
        "meldungen",
        "pillen",
        "dialog",
        "listen",
        "fortschritt",
      ]),
    );
  });

  it("stellt die drei Rahmen nebeneinander, solange die Breite es hergibt", () => {
    const breit = rahmenMassstab(1232, false);
    expect(breit.anordnung).toBe("nebeneinander");
    // Alle drei passen zusammen hinein.
    const summe = SCREEN_WIDTHS_PX.reduce(
      (s, b) => s + b * breit.massstab(b),
      0,
    );
    expect(summe).toBeLessThanOrEqual(1232);

    // Auf dem Telefon untereinander, jeder so breit wie der Platz.
    const schmal = rahmenMassstab(343, false);
    expect(schmal.anordnung).toBe("untereinander");
    for (const breite of SCREEN_WIDTHS_PX) {
      expect(breite * schmal.massstab(breite)).toBeLessThanOrEqual(343);
    }

    // In Originalgroesse unverkleinert.
    expect(rahmenMassstab(343, true).massstab(1280)).toBe(1);
  });

  it("steht in keiner Leiste", () => {
    for (const leiste of [
      "../components/seitenleiste.tsx",
      "../../../components/bereichsleiste.tsx",
    ]) {
      expect(readCss(leiste)).not.toContain(BAUKASTEN_PATH);
      expect(readCss(leiste)).not.toContain("@/lib/design/baukasten");
    }
  });
});

describe("Baukasten -- die Bausteine (req-089)", () => {
  it("zeigt Knöpfe gewöhnlich, betont und abgeschaltet", () => {
    render(<BausteinSeite id="knoepfe" zustand={null} />);

    const speichern = screen.getAllByRole("button", { name: "Speichern" });
    expect(speichern.some((knopf) => !knopf.hasAttribute("disabled"))).toBe(
      true,
    );
    expect(speichern.some((knopf) => knopf.hasAttribute("disabled"))).toBe(
      true,
    );
    const abbrechen = screen.getAllByRole("button", { name: "Abbrechen" });
    expect(abbrechen.some((knopf) => knopf.hasAttribute("disabled"))).toBe(
      true,
    );
  });

  it("zeigt die Seitenleiste eingeklappt", () => {
    render(<BausteinSeite id="seitenleiste-eingeklappt" zustand={null} />);
    expect(
      screen.getByRole("button", { name: "Bereiche aufklappen" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("zeigt die Seitenleiste aufgeklappt", () => {
    render(<BausteinSeite id="seitenleiste-aufgeklappt" zustand={null} />);
    expect(
      screen.getByRole("button", { name: "Bereiche einklappen" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("zeigt den Dialog offen, wenn der Rahmen es verlangt -- sonst erst auf Knopfdruck", () => {
    const { unmount } = render(<BausteinSeite id="dialog" zustand="offen" />);
    expect(screen.getByRole("dialog", { name: "POI löschen?" })).toBeVisible();
    unmount();

    render(<BausteinSeite id="dialog" zustand={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dialog öffnen" }));
    expect(screen.getByRole("dialog", { name: "POI löschen?" })).toBeVisible();
  });

  it("nennt sich selbst, damit die Bildschirmpruefung den Baustein nennt", () => {
    const { container } = render(<BausteinSeite id="felder" zustand={null} />);
    expect(container.querySelector('[data-baustein="Felder"]')).not.toBeNull();
  });
});

/**
 * Kontrast nach lib/design/kontrast.ts (req-089, GUI): jede Schrift auf der
 * Flaeche, auf der sie im Katalog tatsaechlich steht. Gefordert sind 4,5:1,
 * fuer grosse Schrift 3:1 -- die Bausteine halten durchweg 4,5:1.
 */
describe("Baukasten -- Kontrast der Schrift auf ihrer Flaeche (req-089)", () => {
  const css = readCss("./bausteine.module.css");
  const farbe = (name: string) =>
    FARBWELT_PLANER[name as keyof typeof FARBWELT_PLANER];

  const PAARE: {
    wo: string;
    selektor: string;
    schrift: string;
    flaeche: string;
  }[] = [
    {
      wo: "Gruppentitel",
      selektor: ".gruppenTitel",
      schrift: "--text-3",
      flaeche: "--page",
    },
    {
      wo: "Farbname",
      selektor: ".farbname",
      schrift: "--text",
      flaeche: "--card",
    },
    {
      wo: "Farbwert",
      selektor: ".farbwert",
      schrift: "--text-2",
      flaeche: "--card",
    },
    { wo: "Knopf", selektor: ".knopf,", schrift: "--text", flaeche: "--card" },
    {
      wo: "betonter Knopf",
      selektor: ".knopfBetont",
      schrift: "--on-acc",
      flaeche: "--acc",
    },
    {
      wo: "Knopf Gefahr",
      selektor: ".knopfGefahr",
      schrift: "--on-acc",
      flaeche: "--neg",
    },
    {
      wo: "Beschriftung",
      selektor: ".beschriftung",
      schrift: "--text-2",
      flaeche: "--page",
    },
    {
      wo: "Eingabe",
      selektor: ".eingabe",
      schrift: "--text",
      flaeche: "--field",
    },
    {
      wo: "Fehlertext",
      selektor: ".fehlertext",
      schrift: "--neg",
      flaeche: "--page",
    },
    {
      wo: "Segment",
      selektor: ".segment",
      schrift: "--text-2",
      flaeche: "--card",
    },
    {
      wo: "gewaehltes Segment",
      selektor: '.segment[aria-pressed="true"]',
      schrift: "--on-acc",
      flaeche: "--acc",
    },
    {
      wo: "Filter",
      selektor: ".filter",
      schrift: "--text-2",
      flaeche: "--page",
    },
    {
      wo: "gewaehlter Filter",
      selektor: '.filter[aria-pressed="true"]',
      schrift: "--acc-text",
      flaeche: "--card-alt",
    },
    {
      wo: "Kartentitel",
      selektor: ".kartenTitel",
      schrift: "--head",
      flaeche: "--card-alt",
    },
    {
      wo: "Kartentext",
      selektor: ".kartenText",
      schrift: "--text-2",
      flaeche: "--card-alt",
    },
    {
      wo: "Kartenmeta",
      selektor: ".kartenMeta",
      schrift: "--text-3",
      flaeche: "--card-alt",
    },
    {
      wo: "Meldung",
      selektor: ".meldung",
      schrift: "--text-2",
      flaeche: "--card",
    },
    {
      wo: "Hinweis-Titel",
      selektor: ".hinweis .meldungsTitel",
      schrift: "--hint-fg",
      flaeche: "--card",
    },
    {
      wo: "Erfolg-Titel",
      selektor: ".erfolg .meldungsTitel",
      schrift: "--pos",
      flaeche: "--card",
    },
    {
      wo: "Fehler-Titel",
      selektor: ".fehler .meldungsTitel",
      schrift: "--neg",
      flaeche: "--card",
    },
    {
      wo: "Pille",
      selektor: ".pille",
      schrift: "--text-2",
      flaeche: "--field",
    },
    {
      wo: "betonte Pille",
      selektor: ".pilleBetont",
      schrift: "--on-acc",
      flaeche: "--acc",
    },
    {
      wo: "Plakette",
      selektor: ".plakette",
      schrift: "--on-acc",
      flaeche: "--neg",
    },
    {
      wo: "Dialogtitel",
      selektor: ".dialogTitel",
      schrift: "--head",
      flaeche: "--card",
    },
    {
      wo: "Tabellenkopf",
      selektor: ".tabelle th",
      schrift: "--text-3",
      flaeche: "--card",
    },
    {
      wo: "Tabellenzelle",
      selektor: ".tabelle td",
      schrift: "--text",
      flaeche: "--card",
    },
    {
      wo: "Fortschritt",
      selektor: ".fortschrittKopf",
      schrift: "--text-2",
      flaeche: "--page",
    },
    {
      wo: "Schritt",
      selektor: ".schritt",
      schrift: "--text-3",
      flaeche: "--card",
    },
    {
      wo: "erledigter Schritt",
      selektor: ".schritt[data-erledigt]",
      schrift: "--pos",
      flaeche: "--card",
    },
    {
      wo: "aktueller Schritt",
      selektor: '.schritt[aria-current="step"]',
      schrift: "--acc-text",
      flaeche: "--card",
    },
  ];

  it.each(PAARE)(
    "$wo: $schrift auf $flaeche",
    ({ selektor, schrift, flaeche }) => {
      // Die Schrift steht wirklich so im Blatt.
      const regel = selektor.endsWith(",")
        ? (css.match(
            new RegExp(`^${selektor.replace(".", "\\.")}[^{]*{[^}]*}`, "m"),
          )?.[0] ?? "")
        : rule(css, selektor);
      expect(regel).toMatch(new RegExp(`color:\\s*var\\(${schrift}\\)`));

      expect(
        kontrastVerhaeltnis(farbe(schrift), farbe(flaeche)),
      ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    },
  );

  it("haelt jede Textstufe auf der Karte lesbar", () => {
    for (const stufe of ["--text", "--text-2", "--text-3", "--text-4"]) {
      expect(
        kontrastVerhaeltnis(farbe(stufe), farbe("--card")),
      ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    }
  });
});
