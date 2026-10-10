import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { reiseplan } from "@/lib/druck/reiseplan";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import {
  DRUCK_ACTIVITIES,
  DRUCK_POIS,
  DRUCK_TRIP,
  POI_DORNBIRN,
  ST_DORNBIRN,
  ST_NACHTWAECHTER,
} from "@/tests/fixtures/druck-reise";
import { ReiseplanDruck } from "./reiseplan-druck";

/**
 * Der Reiseplan zum Ausdrucken (req-080), gefuellt mit der Reise des Mockups
 * (delivery/design/reiseplan-druck/variante-c-magazin.mockup.html).
 */

function zeige(overrides: Partial<Parameters<typeof reiseplan>[0]> = {}): void {
  render(
    <ReiseplanDruck
      reiseplan={reiseplan({
        trip: DRUCK_TRIP,
        activities: DRUCK_ACTIVITIES,
        pois: DRUCK_POIS,
        teilnehmerzahl: 4,
        reiseleitung: ["Uwe Kremmel"],
        stand: "2026-10-10",
        ...overrides,
      })}
    />,
  );
}

describe("Seite 1 -- Bild und Dashboard (req-080)", () => {
  it("steht als eigenes Blatt da", () => {
    zeige();

    expect(screen.getByTestId("druck-deckblatt")).toBeInTheDocument();
  });

  it("zeigt Titel und Ort mit Zeitraum", () => {
    zeige();

    expect(
      screen.getByRole("heading", { level: 1, name: "30 Johr zämma" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Rothenburg ob der Tauber · 25. – 26. Oktober 2026"),
    ).toBeInTheDocument();
  });

  it("zeigt das Foto ueber den oberen zwei Dritteln", () => {
    zeige();

    const foto = screen.getByAltText("Foto zu 30 Johr zämma");
    expect(foto).toHaveAttribute("src", poiFotoUrl(POI_DORNBIRN.photos![0].id));
  });

  it("zeigt die Beschreibung der Reise", () => {
    zeige();

    expect(screen.getByTestId("druck-beschreibung")).toHaveTextContent(
      "Ein Wochenende mit unseren Trauzeugen anlässlich des 30-jährigen Hochzeitstages.",
    );
  });

  it("stellt den ersten Satz der Beschreibung handschriftlich ueber den Titel", () => {
    zeige();

    expect(screen.getByTestId("druck-vorspann")).toHaveTextContent(
      "30 Jahre, und wieder zu viert unterwegs.",
    );
  });

  it("zeigt vier Zahlen -- Dauer, Stationen, Reisende, geplante Kosten", () => {
    zeige();

    const zahlen = screen.getByTestId("druck-zahlen");
    expect(zahlen).toHaveTextContent("2 Tage");
    expect(zahlen).toHaveTextContent("Reisedauer");
    expect(zahlen).toHaveTextContent("Stationen");
    expect(zahlen).toHaveTextContent("Reisende");
    expect(zahlen).toHaveTextContent("geplant");
  });

  it("zeigt die Eckdaten", () => {
    zeige();

    const eckdaten = screen.getByTestId("druck-eckdaten");
    expect(eckdaten).toHaveTextContent("Hauptort");
    expect(eckdaten).toHaveTextContent("Rothenburg ob der Tauber");
    expect(eckdaten).toHaveTextContent("Unterkunft");
    expect(eckdaten).toHaveTextContent("Anreise");
    expect(eckdaten).toHaveTextContent("So, 25. Oktober");
    expect(eckdaten).toHaveTextContent("Abreise");
    expect(eckdaten).toHaveTextContent("Mo, 26. Oktober");
    expect(eckdaten).toHaveTextContent("Reiseleitung");
    expect(eckdaten).toHaveTextContent("Uwe Kremmel");
    expect(eckdaten).toHaveTextContent("Stand");
    expect(eckdaten).toHaveTextContent("10. Oktober 2026");
  });

  it("traegt die Marke und das Wort „Reiseplan“", () => {
    zeige();

    expect(screen.getByText("Wegfara")).toBeInTheDocument();
    expect(screen.getByText("Reiseplan")).toBeInTheDocument();
  });

  it("erklaert am Bildschirm, wie daraus ein PDF wird", () => {
    zeige();

    const hinweis = screen.getByTestId("druck-hinweis");
    expect(hinweis).toHaveTextContent("A4 hoch");
    expect(hinweis).toHaveTextContent("Hintergrundgrafiken");
  });
});

describe("Die Tagesseiten (req-080)", () => {
  it("legt je Reisetag eine Seite an", () => {
    zeige();

    expect(screen.getByTestId("druck-tag-1")).toBeInTheDocument();
    expect(screen.getByTestId("druck-tag-2")).toBeInTheDocument();
  });

  it("zeigt Tagesnummer, Überschrift und ausgeschriebenes Datum", () => {
    zeige();

    const tag = screen.getByTestId("druck-tag-1");
    expect(tag).toHaveTextContent("Sonntag, 25. Oktober 2026");
    expect(within(tag).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Rothenburg",
    );
  });

  /**
   * req-080: Ein Tag mit vier Stationen traegt verschiedene Layouts, und
   * keine zwei gleichen stehen untereinander.
   */
  it("gibt den Stationen eines Tages verschiedene Layouts", () => {
    zeige();

    const layouts = Array.from(
      screen.getByTestId("druck-tag-1").querySelectorAll("[data-layout]"),
      (element) => element.getAttribute("data-layout"),
    );

    // Vier grosse Stationen und eine Nebenstation (siehe Mockup).
    expect(layouts).toEqual(["l1", "l5", "l2", "l3", "l4"]);
    for (let i = 1; i < layouts.length; i += 1) {
      expect(layouts[i]).not.toBe(layouts[i - 1]);
    }
  });

  it("zeigt an einer Station ihre Startzeit und keine Endzeit", () => {
    zeige();

    const station = screen.getByTestId(`station-${ST_DORNBIRN.id}`);
    expect(
      screen.getByTestId(`station-zeit-${ST_DORNBIRN.id}`),
    ).toHaveTextContent("09:00");
    // Der Programmpunkt endet um 10:00 -- im Heft steht das nicht.
    expect(station.textContent).not.toContain("10:00");
    expect(station.textContent).not.toContain("–");
  });

  it("zeigt an einer Station ihren Langtext und nicht den Kurztext", () => {
    zeige();

    expect(
      screen.getByTestId(`station-langtext-${ST_DORNBIRN.id}`),
    ).toHaveTextContent(ST_DORNBIRN.longText);
    expect(
      screen.getByTestId(`station-${ST_DORNBIRN.id}`).textContent,
    ).not.toContain(ST_DORNBIRN.shortText);
  });

  it("zeigt bei sieben Fotos ein grosses und zwei bis drei kleine", () => {
    zeige();

    expect(
      screen.getByTestId(`station-foto-gross-${ST_DORNBIRN.id}`),
    ).toBeInTheDocument();
    const kleine = screen.getByTestId(`station-fotos-klein-${ST_DORNBIRN.id}`);
    const anzahl = kleine.querySelectorAll("img").length;
    expect(anzahl).toBeGreaterThanOrEqual(2);
    expect(anzahl).toBeLessThanOrEqual(3);
  });

  /**
   * req-080: Hat ein POI nur ein Foto, fuellt dieses den Bildbereich -- und
   * es bleibt keine leere Flaeche. Die Nachtwaechter-Tour ist dieser Fall.
   */
  it("laesst bei nur einem Foto keine leere Fläche stehen", () => {
    zeige();

    const station = screen.getByTestId(`station-${ST_NACHTWAECHTER.id}`);
    const bilder = station.querySelectorAll("img");
    expect(bilder).toHaveLength(1);
    // Keine Fläche ohne Bild darin: jeder Bildkasten traegt genau ein Foto.
    const kaesten = Array.from(station.querySelectorAll("div")).filter(
      (element) => /(^|\s)_bild_/.test(element.className),
    );
    expect(kaesten).toHaveLength(1);
    expect(
      screen.queryByTestId(`station-fotos-klein-${ST_NACHTWAECHTER.id}`),
    ).not.toBeInTheDocument();
  });

  it("traegt am Fuß die Reise und den Tag", () => {
    zeige();

    const tag = screen.getByTestId("druck-tag-1");
    expect(tag).toHaveTextContent("30 Johr zämma · Rothenburg ob der Tauber");
    expect(tag).toHaveTextContent("Tag 1");
  });
});
