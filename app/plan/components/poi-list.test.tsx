import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoiList } from "./poi-list";
import type { Poi } from "@/lib/pois/types";

function poi(overrides: Partial<Poi> & { id: string; name: string }): Poi {
  return {
    tripId: "trip-1",
    number: 1,
    ort: "Ort",
    type: "sehenswuerdigkeit",
    position: { lat: 40.85, lng: 14.27 },
    status: "weiss_nicht",
    ...overrides,
  };
}

function twelvePois(): Poi[] {
  return Array.from({ length: 12 }, (_, i) =>
    poi({
      id: `poi-${i}`,
      number: i + 1,
      name: `POI ${i}`,
      type: i === 0 ? "restaurant" : "sehenswuerdigkeit",
    }),
  );
}

describe("PoiList", () => {
  it("zeigt eine Zeile je POI", () => {
    render(
      <PoiList
        pois={twelvePois()}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });

  it('zeigt den Zaehler "12 von 12"', () => {
    render(
      <PoiList
        pois={twelvePois()}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByText("12 von 12")).toBeInTheDocument();
  });

  it("zeigt nach Auswahl eines Typ-Filters nur POIs dieses Typs", () => {
    render(
      <PoiList
        pois={twelvePois()}
        typeFilter="restaurant"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("1 von 12")).toBeInTheDocument();
  });

  it("meldet den gewaehlten Typ-Filter beim Klick auf einen Filter-Chip", async () => {
    const user = userEvent.setup();
    const onTypeFilterChange = vi.fn();
    render(
      <PoiList
        pois={twelvePois()}
        typeFilter="alle"
        onTypeFilterChange={onTypeFilterChange}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Restaurant" }));

    expect(onTypeFilterChange).toHaveBeenCalledWith("restaurant");
  });

  it("zeigt keinen Foto-Platzhalter in einer POI-Zeile", () => {
    render(
      <PoiList
        pois={[poi({ id: "a", name: "Dom" })]}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("meldet den neuen Status beim Wechsel in der Auswahlliste einer Zeile", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    const p = poi({ id: "a", name: "Villa Rufolo", status: "weiss_nicht" });
    render(
      <PoiList
        pois={[p]}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={onStatusChange}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
      "Gesetzt",
    );

    expect(onStatusChange).toHaveBeenCalledWith("a", "gesetzt");
  });

  it("zeigt den Statuspunkt einer Zeile in der Statusfarbe (gesetzt = grün)", () => {
    const p = poi({ id: "a", name: "Villa Rufolo", status: "gesetzt" });
    render(
      <PoiList
        pois={[p]}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByTestId("poi-status-dot-a")).toHaveStyle({
      background: "rgb(143, 214, 164)",
    });
  });

  it("zeigt die Nummer jedes POI in seiner Zeile", () => {
    render(
      <PoiList
        pois={twelvePois()}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    for (const p of twelvePois()) {
      expect(screen.getByTestId(`poi-number-${p.id}`)).toHaveTextContent(
        `#${p.number}`,
      );
    }
  });

  it("hebt die uebergebene POI-Zeile hervor", () => {
    render(
      <PoiList
        pois={[poi({ id: "a", name: "Dom" }), poi({ id: "b", name: "Villa" })]}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId="b"
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByTestId("poi-row-b").className).toMatch(/rowHighlighted/);
    expect(screen.getByTestId("poi-row-a").className).not.toMatch(
      /rowHighlighted/,
    );
  });

  it('aendert bei Klick auf "Bewertungsrunde starten" nichts an der Anzeige', async () => {
    const user = userEvent.setup();
    render(
      <PoiList
        pois={twelvePois()}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Bewertungsrunde starten" }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });
});

// Seit req-035 klappt die Zeile zu einem Formular auf statt zu einem Detail
// zum Lesen -- dieselben Angaben aus req-026 stehen dort änderbar.
describe("PoiList — Formular der Zeile und Fotos (req-026, req-035)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  function villaRufolo(overrides: Partial<Poi> = {}): Poi {
    return poi({
      id: "poi-1",
      name: "Villa Rufolo",
      ort: "Ravello",
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      phone: "+39 089 857621",
      openingHours: ["Montag: 09:00–20:00", "Dienstag: 09:00–20:00"],
      photos: [{ id: "foto-1", position: 1 }],
      ...overrides,
    });
  }

  it("zeigt das Formular erst nach dem Aufklappen", () => {
    liste([villaRufolo()]);

    expect(screen.queryByTestId("poi-form-poi-1")).not.toBeInTheDocument();
  });

  it("zeigt im aufgeklappten Formular die Adresse", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    expect(screen.getByLabelText("Adresse")).toHaveValue(
      "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    );
  });

  it("zeigt im aufgeklappten Formular Telefonnummer und Oeffnungszeiten", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    expect(screen.getByLabelText("Telefonnummer")).toHaveValue(
      "+39 089 857621",
    );
    expect(screen.getByLabelText("Öffnungszeiten")).toHaveValue(
      "Montag: 09:00–20:00\nDienstag: 09:00–20:00",
    );
  });

  it("zeigt im aufgeklappten Formular ein Bild des Ortes", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    expect(
      within(screen.getByTestId("poi-form-poi-1")).getByRole("img", {
        name: "Bild 1 von Villa Rufolo",
      }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("klappt das Formular beim zweiten Klick wieder zu", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);
    const name = screen.getByRole("button", { name: "Villa Rufolo" });

    await user.click(name);
    await user.click(name);

    expect(screen.queryByTestId("poi-form-poi-1")).not.toBeInTheDocument();
  });

  it("ersetzt die farbige Flaeche der Zeile durch das erste Foto", () => {
    liste([
      villaRufolo({
        photos: [
          { id: "foto-1", position: 1 },
          { id: "foto-2", position: 2 },
        ],
      }),
    ]);

    expect(screen.queryByTestId("poi-swatch-poi-1")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Foto von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("zeigt bei einem POI ohne Fotos weiterhin die farbige Flaeche seines Typs", () => {
    liste([villaRufolo({ photos: [] })]);

    expect(screen.getByTestId("poi-swatch-poi-1")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("laesst die freiwilligen Felder leer, wenn nichts hinterlegt ist", async () => {
    const user = userEvent.setup();
    liste([poi({ id: "poi-2", name: "Handgemacht" })]);

    await user.click(screen.getByRole("button", { name: "Handgemacht" }));

    expect(screen.getByLabelText("Adresse")).toHaveValue("");
    expect(screen.getByLabelText("Telefonnummer")).toHaveValue("");
    expect(screen.getByLabelText("Öffnungszeiten")).toHaveValue("");
  });

  // jsdom rechnet keine Breiten aus -- geprueft wird darum, wo das Formular
  // haengt: in der mittleren Spalte der Zeile blieb neben Auswahlkaestchen,
  // Bild und Statusliste zu wenig Platz (bug-014).
  it("haengt das Formular der Zeile an die Zeile selbst, nicht in ihre mittlere Spalte", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    const form = screen.getByTestId("poi-form-poi-1");
    expect(form.parentElement).toBe(screen.getByTestId("poi-row-poi-1"));
  });

  it("stellt das Formular der Zeile neben keine andere Angabe der Zeile", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    const form = screen.getByTestId("poi-form-poi-1");
    for (const nachbar of [
      screen.getByRole("img", { name: "Foto von Villa Rufolo" }),
      screen.getByLabelText("Villa Rufolo auswählen"),
      screen.getByLabelText("Status von Villa Rufolo"),
    ]) {
      expect(nachbar.parentElement).not.toContainElement(form);
    }
  });

  // jsdom rechnet keine Hoehen aus -- geprueft wird darum, dass beide
  // Formulare im scrollenden Bereich stehen. Das beim Anlegen stand daneben
  // und wurde am unteren Rand der Spalte abgeschnitten (bug-016).
  it("stellt das Formular der Zeile in den Bildlaufbereich", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    expect(screen.getByTestId("poi-scrollbereich")).toContainElement(
      screen.getByTestId("poi-form-poi-1"),
    );
  });

  it("stellt das Formular beim Anlegen in denselben Bildlaufbereich", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "POI anlegen" }));

    expect(screen.getByTestId("poi-scrollbereich")).toContainElement(
      screen.getByTestId("poi-form-neu"),
    );
  });
});

describe("PoiList — Ortsangabe der Zeile (req-041)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        typeFilter="alle"
        onTypeFilterChange={() => {}}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  it("zeigt Ort und Typ, solange ein Ort abgeleitet ist", () => {
    liste([poi({ id: "poi-1", name: "Villa Rufolo", ort: "Ravello" })]);

    expect(screen.getByText("Ravello · Sehenswürdigkeit")).toBeInTheDocument();
  });

  it("zeigt ohne Ort keinen Platzhaltertext", () => {
    liste([
      poi({ id: "poi-1", name: "Bucht bei Praiano", ort: "", type: "strand" }),
    ]);

    const zeile = screen.getByRole("listitem");
    expect(within(zeile).getByText("Strand")).toBeInTheDocument();
    expect(zeile.textContent).not.toContain("·");
  });
});
