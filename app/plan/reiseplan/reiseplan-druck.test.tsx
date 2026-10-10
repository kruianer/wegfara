import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { reiseplan } from "@/lib/druck/reiseplan";
import { poiFotoUrl } from "@/lib/pois/foto-url";
import {
  DRUCK_ACTIVITIES,
  DRUCK_POIS,
  DRUCK_TRIP,
  POI_DORNBIRN,
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
