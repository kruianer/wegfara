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

describe("PoiList — Detail und Fotos (req-026)", () => {
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

  it("zeigt das Detail erst nach dem Aufklappen", () => {
    liste([villaRufolo()]);

    expect(screen.queryByTestId("poi-detail-poi-1")).not.toBeInTheDocument();
  });

  it("zeigt im aufgeklappten Detail die Adresse", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    expect(screen.getByTestId("poi-detail-poi-1")).toHaveTextContent(
      "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    );
  });

  it("zeigt im aufgeklappten Detail Telefonnummer und Oeffnungszeiten", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    const detail = screen.getByTestId("poi-detail-poi-1");
    expect(detail).toHaveTextContent("+39 089 857621");
    expect(detail).toHaveTextContent("Montag: 09:00–20:00");
    expect(detail).toHaveTextContent("Dienstag: 09:00–20:00");
  });

  it("zeigt im aufgeklappten Detail ein Foto des Ortes", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    const fotos = within(screen.getByTestId("poi-detail-poi-1")).getAllByRole(
      "img",
      { name: "Foto von Villa Rufolo" },
    );
    expect(fotos[0]).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("klappt das Detail beim zweiten Klick wieder zu", async () => {
    const user = userEvent.setup();
    liste([villaRufolo()]);
    const name = screen.getByRole("button", { name: "Villa Rufolo" });

    await user.click(name);
    await user.click(name);

    expect(screen.queryByTestId("poi-detail-poi-1")).not.toBeInTheDocument();
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

  it("nennt im Detail, wenn keine weiteren Angaben hinterlegt sind", async () => {
    const user = userEvent.setup();
    liste([poi({ id: "poi-2", name: "Handgemacht" })]);

    await user.click(screen.getByRole("button", { name: "Handgemacht" }));

    expect(screen.getByTestId("poi-detail-poi-2")).toHaveTextContent(
      "keine weiteren Angaben",
    );
  });
});
