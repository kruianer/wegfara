import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NEUER_POI, PoiList } from "./poi-list";
import { ANLEGEZEILE_LABEL } from "./poi-anlegezeile";
import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde } from "@/lib/bewertungen/types";
import { GOOGLE_FOTO_PROBLEM_TEXT } from "@/lib/pois/google-foto-problem";

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

/**
 * Der Umbau der POI-Liste (req-060): der Platz über der Liste gehört ihr
 * selbst — die Überschrift „Points of Interest" entfällt.
 */
describe("PoiList — keine Überschrift über der Liste (req-060)", () => {
  it("zeigt über der Liste keine Überschrift", () => {
    render(
      <PoiList
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText(/Points of/)).not.toBeInTheDocument();
  });

  it("zeigt weiterhin, wie viele POIs der Filter gerade zeigt", () => {
    render(
      <PoiList
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByText("12 von 12")).toBeInTheDocument();
  });
});

/**
 * Das Anlegen sitzt seit req-060 über der Liste statt in ihr: zuerst die
 * Anlegezeile, dann der Filter, dann die Liste.
 */
describe("PoiList — Anlegezeile über der Liste (req-060)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiList
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        hasGoogleKey={true}
        {...props}
      />,
    );
  }

  /** Ob a im Dokument vor b steht. */
  function stehtVor(a: HTMLElement, b: HTMLElement): boolean {
    return Boolean(
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  }

  it("stellt Anlegezeile, Filter und Liste in genau dieser Reihenfolge", () => {
    liste();

    const anlegezeile = screen.getByTestId("poi-anlegezeile");
    const filter = screen.getByTestId("poi-filterzeile");
    const liste_ = screen.getByTestId("poi-scrollbereich");
    expect(stehtVor(anlegezeile, filter)).toBe(true);
    expect(stehtVor(filter, liste_)).toBe(true);
  });

  it("öffnet mit einem gewählten Ortsvorschlag das gefüllte Formular", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          places: [
            {
              name: "Villa Rufolo",
              context: "Kampanien, Italien",
              lat: 40.6465,
              lng: 14.6127,
              address: "Via Santa Chiara 26, 84010 Ravello, Italien",
              art: "tourism/attraction",
            },
          ],
        }),
      })),
    );
    liste({ pois: [] });

    await user.type(screen.getByLabelText(ANLEGEZEILE_LABEL), "Villa Rufolo");
    await user.click(await screen.findByText("Villa Rufolo"));

    const form = screen.getByTestId("poi-form-neu");
    expect(within(form).getByLabelText("Name")).toHaveValue("Villa Rufolo");
    expect(within(form).getByLabelText("Adresse")).toHaveValue(
      "Via Santa Chiara 26, 84010 Ravello, Italien",
    );
    expect(within(form).getByTestId("poi-form-position")).toHaveTextContent(
      "40.64650, 14.61270",
    );
  });

  it("öffnet nach einem Google-Maps-Link das gefüllte Formular", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          result: "gefunden",
          ort: {
            placeId: "ChIJVillaRufolo",
            name: "Villa Rufolo",
            type: "sehenswuerdigkeit",
            position: { lat: 40.6491, lng: 14.6113 },
            address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
            web: "https://villarufolo.com",
            phone: "+39 089 857621",
            openingHours: "Montag: 09:00–20:00",
            shortText: "Gärten mit Meerblick",
            longText: "",
            bewertung: 4.6,
            bewertungAnzahl: 1240,
            photoNames: [],
          },
        }),
      })),
    );
    liste({ pois: [] });

    await user.type(
      screen.getByLabelText(ANLEGEZEILE_LABEL),
      "https://maps.app.goo.gl/aBcD1234",
    );

    const form = await screen.findByTestId("poi-form-neu");
    expect(within(form).getByLabelText("Name")).toHaveValue("Villa Rufolo");
    expect(within(form).getByLabelText("Telefonnummer")).toHaveValue(
      "+39 089 857621",
    );
    expect(within(form).getByTestId("poi-form-position")).toHaveTextContent(
      "40.64910, 14.61130",
    );
  });
});

/**
 * Gefiltert wird seit req-060 über Auswahllisten statt über eine Leiste aus
 * Chips — Vorwahl ist überall „alle", und gefiltert wird allein die Liste.
 */
describe("PoiList — Typfilter als Auswahlliste (req-060)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiList
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        {...props}
      />,
    );
  }

  function typfilter(): HTMLElement {
    return screen.getByLabelText("Nach Typ filtern");
  }

  it("steht beim Öffnen auf „alle“", () => {
    liste();

    expect(typfilter()).toHaveValue("alle");
    expect(screen.getAllByRole("listitem")).toHaveLength(12);
  });

  it("zeigt nach Auswahl eines Typs nur POIs dieses Typs", async () => {
    const user = userEvent.setup();
    liste();

    await user.selectOptions(typfilter(), "Restaurant");

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "POI 0" })).toBeInTheDocument();
    expect(screen.getByText("1 von 12")).toBeInTheDocument();
  });

  it("zeigt nach dem Zurückstellen auf „alle“ wieder alle POIs", async () => {
    const user = userEvent.setup();
    liste();

    await user.selectOptions(typfilter(), "Restaurant");
    await user.selectOptions(typfilter(), "Alle");

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByText("12 von 12")).toBeInTheDocument();
  });
});

/** Der Statusfilter der Liste (req-060) — die Karte hat ihren eigenen. */
describe("PoiList — Statusfilter als Auswahlliste (req-060)", () => {
  function liste() {
    return render(
      <PoiList
        pois={[
          poi({ id: "poi-1", name: "Villa Rufolo", status: "gesetzt" }),
          poi({
            id: "poi-2",
            name: "Pompeji",
            number: 2,
            status: "wenn_zeit",
          }),
          poi({ id: "poi-3", name: "Matera", number: 3, status: "gesetzt" }),
        ]}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  function statusfilter(): HTMLElement {
    return screen.getByLabelText("Nach Status filtern");
  }

  it("steht beim Öffnen auf „alle“", () => {
    liste();

    expect(statusfilter()).toHaveValue("alle");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("zeigt bei „Gesetzt“ nur POIs mit diesem Status", async () => {
    const user = userEvent.setup();
    liste();

    await user.selectOptions(statusfilter(), "Gesetzt");

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Villa Rufolo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matera" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Pompeji" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("2 von 3")).toBeInTheDocument();
  });

  it("wirkt zusammen mit dem Typfilter", async () => {
    const user = userEvent.setup();
    liste();

    await user.selectOptions(statusfilter(), "Gesetzt");
    await user.selectOptions(
      screen.getByLabelText("Nach Typ filtern"),
      "Restaurant",
    );

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

/** Die Sortierung der Liste (req-060) — vorgewählt nach Nummer. */
describe("PoiList — Sortierung (req-060)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  /** Die Namen der POIs in der Reihenfolge, in der sie in der Liste stehen. */
  function reihenfolge(): string[] {
    return screen
      .getAllByTestId(/^poi-name-/)
      .map((name) => name.textContent ?? "");
  }

  const DREI = [
    poi({ id: "poi-1", name: "Villa Rufolo", number: 1, bewertung: 4.2 }),
    poi({ id: "poi-2", name: "Ausgrabungsstätte Pompeji", number: 2 }),
    poi({ id: "poi-3", name: "Bucht bei Praiano", number: 3, bewertung: 4.7 }),
  ];

  it("steht beim Öffnen auf „Nummer“", () => {
    liste(DREI);

    expect(screen.getByLabelText("Sortieren nach")).toHaveValue("nummer");
    expect(reihenfolge()).toEqual([
      "Villa Rufolo",
      "Ausgrabungsstätte Pompeji",
      "Bucht bei Praiano",
    ]);
  });

  it("ordnet nach Name", async () => {
    const user = userEvent.setup();
    liste(DREI);

    await user.selectOptions(screen.getByLabelText("Sortieren nach"), "Name");

    expect(reihenfolge()).toEqual([
      "Ausgrabungsstätte Pompeji",
      "Bucht bei Praiano",
      "Villa Rufolo",
    ]);
  });

  it("stellt bei „Bewertung“ POIs ohne Bewertung ans Ende", async () => {
    const user = userEvent.setup();
    liste(DREI);

    await user.selectOptions(
      screen.getByLabelText("Sortieren nach"),
      "Bewertung",
    );

    expect(reihenfolge()).toEqual([
      "Bucht bei Praiano",
      "Villa Rufolo",
      "Ausgrabungsstätte Pompeji",
    ]);
  });

  it("lässt jedem POI seine Nummer, egal wie sortiert wird (req-013)", async () => {
    const user = userEvent.setup();
    liste(DREI);

    await user.selectOptions(screen.getByLabelText("Sortieren nach"), "Name");

    expect(screen.getByTestId("poi-number-poi-1")).toHaveTextContent("#1");
    expect(screen.getByTestId("poi-number-poi-2")).toHaveTextContent("#2");
    expect(screen.getByTestId("poi-number-poi-3")).toHaveTextContent("#3");
  });

  it("sortiert nur, was der Filter zeigt", async () => {
    const user = userEvent.setup();
    liste([
      ...DREI,
      poi({
        id: "poi-4",
        name: "Alberobello",
        number: 4,
        type: "restaurant",
      }),
    ]);

    await user.selectOptions(
      screen.getByLabelText("Nach Typ filtern"),
      "Restaurant",
    );
    await user.selectOptions(screen.getByLabelText("Sortieren nach"), "Name");

    expect(reihenfolge()).toEqual(["Alberobello"]);
  });
});

/**
 * Das Löschen-Symbol rechts in der Box (req-060): bis dahin ging ein POI
 * nur aus seinem aufgeklappten Formular heraus.
 */
describe("PoiList — Löschen-Symbol in der Box (req-060)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiList
        pois={[poi({ id: "poi-1", name: "Villa Rufolo" })]}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        {...props}
      />,
    );
  }

  it("bietet es je Box an, ohne das Formular aufzuklappen", () => {
    liste();

    expect(
      screen.getByRole("button", { name: "Villa Rufolo entfernen" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("poi-form-poi-1")).not.toBeInTheDocument();
  });

  it("meldet den POI zur Rückfrage, statt ihn selbst zu entfernen", async () => {
    const user = userEvent.setup();
    const onPoiDelete = vi.fn();
    liste({ onPoiDelete });

    await user.click(
      screen.getByRole("button", { name: "Villa Rufolo entfernen" }),
    );

    expect(onPoiDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "poi-1" }),
    );
    // Die Zeile steht weiterhin da -- entfernt wird erst nach der Rückfrage.
    expect(screen.getByTestId("poi-row-poi-1")).toBeInTheDocument();
  });
});

describe("PoiList", () => {
  it("zeigt eine Zeile je POI", () => {
    render(
      <PoiList
        pois={twelvePois()}
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
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByText("12 von 12")).toBeInTheDocument();
  });

  it("zeigt keinen Foto-Platzhalter in einer POI-Zeile", () => {
    render(
      <PoiList
        pois={[poi({ id: "a", name: "Dom" })]}
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

  it("zeigt die Leiste der Bewertungsrunde nur dem Reiseleiter (req-054)", () => {
    render(
      <PoiList
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Bewertungsrunde starten" }),
    ).not.toBeInTheDocument();
  });
});

// Seit req-035 klappt die Zeile zu einem Formular auf statt zu einem Detail
// zum Lesen -- dieselben Angaben aus req-026 stehen dort änderbar.
describe("PoiList — Formular der Zeile und Fotos (req-026, req-035)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        // Die Leiste zum Starten einer Bewertungsrunde steht nur beim
        // Reiseleiter (req-054).
        istReiseleiter={true}
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

describe("PoiList — Kurztext in der Zeile (req-044)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  it("zeigt den Kurztext des POI", () => {
    liste([
      poi({
        id: "poi-1",
        name: "Villa Rufolo",
        shortText: "Gärten mit Meerblick",
      }),
    ]);

    expect(screen.getByTestId("poi-kurztext-poi-1")).toHaveTextContent(
      "Gärten mit Meerblick",
    );
  });

  it("laesst die Zeile ohne Kurztext unveraendert", () => {
    liste([poi({ id: "poi-1", name: "Villa Rufolo" })]);

    expect(screen.queryByTestId("poi-kurztext-poi-1")).not.toBeInTheDocument();
  });
});

/**
 * Die Bewertungsrunde im Planer (req-054): der Reiseleiter waehlt POIs aus und
 * startet die Runde; danach steht an jedem POI die Verteilung der Stimmen.
 * Abgestimmt wird im Begleiter, nicht hier.
 */
describe("PoiList — Bewertungsrunde (req-054)", () => {
  const PERSONEN = [
    { id: "anna", name: "Anna" },
    { id: "bert", name: "Bert" },
    { id: "clara", name: "Clara" },
  ];

  function laufendeRunde(poiIds: string[]): Bewertungsrunde {
    return {
      id: "runde-1",
      tripId: "trip-1",
      status: "laeuft",
      poiIds,
      startedAt: "2026-09-07T10:00:00.000Z",
      endedAt: null,
    };
  }

  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiList
        pois={[
          poi({ id: "poi-1", name: "Villa Rufolo" }),
          poi({ id: "poi-2", name: "Pompeji", number: 2 }),
          poi({ id: "poi-3", name: "Matera", number: 3 }),
        ]}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        istReiseleiter={true}
        personen={PERSONEN}
        {...props}
      />,
    );
  }

  it("startet eine Runde ueber genau die angehakten POIs", async () => {
    const user = userEvent.setup();
    const gestartet = vi.fn();
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ runde: laufendeRunde(["poi-1", "poi-3"]) }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    liste({ onRundeGestartet: gestartet });

    await user.click(screen.getByLabelText("Villa Rufolo auswählen"));
    await user.click(screen.getByLabelText("Matera auswählen"));
    await user.click(
      screen.getByRole("button", { name: "Bewertungsrunde starten" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bewertungsrunden",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tripId: "trip-1", poiIds: ["poi-1", "poi-3"] }),
      }),
    );
    await waitFor(() =>
      expect(gestartet).toHaveBeenCalledWith(laufendeRunde(["poi-1", "poi-3"])),
    );
  });

  it("startet keine Runde, solange kein POI angehakt ist", () => {
    liste();

    expect(
      screen.getByRole("button", { name: "Bewertungsrunde starten" }),
    ).toBeDisabled();
  });

  it("beendet die laufende Runde", async () => {
    const user = userEvent.setup();
    const beendet = vi.fn();
    const runde = laufendeRunde(["poi-1"]);
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            runde: { ...runde, status: "beendet", endedAt: "2026-09-08" },
          }),
        }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    liste({ runden: [runde], onRundeBeendet: beendet });

    await user.click(
      screen.getByRole("button", { name: "Bewertungsrunde beenden" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bewertungsrunden",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ roundId: "runde-1" }),
      }),
    );
    await waitFor(() => expect(beendet).toHaveBeenCalled());
  });

  it("bereitet waehrend einer laufenden Runde keine zweite vor", () => {
    liste({ runden: [laufendeRunde(["poi-1"])] });

    expect(
      screen.queryByRole("button", { name: "Bewertungsrunde starten" }),
    ).not.toBeInTheDocument();
    // Angekreuzt wird weiterhin -- seit req-057 trägt dieselbe Auswahl das
    // Aussortieren mehrerer POIs, und das geht auch während einer Runde.
    expect(
      screen.getByRole("button", { name: "Ausgewählte löschen" }),
    ).toBeInTheDocument();
  });

  it("zeigt je POI der Runde die Verteilung der Stimmen", () => {
    liste({
      runden: [laufendeRunde(["poi-1"])],
      stimmen: [
        {
          roundId: "runde-1",
          poiId: "poi-1",
          participantId: "anna",
          wahl: "unbedingt",
        },
        {
          roundId: "runde-1",
          poiId: "poi-1",
          participantId: "bert",
          wahl: "unbedingt",
        },
      ],
    });

    const bewertung = screen.getByTestId("poi-bewertung-poi-1");
    expect(bewertung).toHaveTextContent("In Bewertung");
    expect(bewertung).toHaveTextContent("Will ich unbedingt: 2");
  });

  it("nennt die Stimmen mit Namen und wer noch fehlt", () => {
    liste({
      runden: [laufendeRunde(["poi-1"])],
      stimmen: [
        {
          roundId: "runde-1",
          poiId: "poi-1",
          participantId: "anna",
          wahl: "unbedingt",
        },
        {
          roundId: "runde-1",
          poiId: "poi-1",
          participantId: "bert",
          wahl: "wenn_zeit",
        },
      ],
    });

    const bewertung = screen.getByTestId("poi-bewertung-poi-1");
    expect(bewertung).toHaveTextContent("Anna — Will ich unbedingt");
    expect(bewertung).toHaveTextContent("Bert — Wenn wir Zeit haben");
    expect(bewertung).toHaveTextContent("Fehlt noch: Clara");
  });

  it("nennt am POI, wer nicht dabei ist", () => {
    liste({
      runden: [laufendeRunde(["poi-1"])],
      stimmen: [
        {
          roundId: "runde-1",
          poiId: "poi-1",
          participantId: "bert",
          wahl: "ohne_mich",
        },
      ],
    });

    expect(screen.getByTestId("poi-bewertung-poi-1")).toHaveTextContent(
      "Nicht dabei: Bert",
    );
  });

  it("aendert den Status eines POI nicht, auch wenn alle dafuer sind", () => {
    liste({
      runden: [laufendeRunde(["poi-1"])],
      stimmen: PERSONEN.map((person) => ({
        roundId: "runde-1",
        poiId: "poi-1",
        participantId: person.id,
        wahl: "unbedingt" as const,
      })),
    });

    expect(screen.getByLabelText("Status von Villa Rufolo")).toHaveValue(
      "weiss_nicht",
    );
  });

  it("laesst die Stimmen stehen, wenn der Reiseleiter den Status setzt", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    liste({
      onStatusChange,
      runden: [laufendeRunde(["poi-1"])],
      stimmen: [
        {
          roundId: "runde-1",
          poiId: "poi-1",
          participantId: "anna",
          wahl: "unbedingt",
        },
      ],
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
      "Gesetzt",
    );

    expect(onStatusChange).toHaveBeenCalledWith("poi-1", "gesetzt");
    expect(screen.getByTestId("poi-bewertung-poi-1")).toHaveTextContent(
      "Anna — Will ich unbedingt",
    );
  });

  it("laesst die Stimmen einer beendeten Runde stehen", () => {
    liste({
      runden: [
        {
          ...laufendeRunde(["poi-1"]),
          status: "beendet",
          endedAt: "2026-09-08T10:00:00.000Z",
        },
      ],
      stimmen: [
        {
          roundId: "runde-1",
          poiId: "poi-1",
          participantId: "anna",
          wahl: "unbedingt",
        },
      ],
    });

    const bewertung = screen.getByTestId("poi-bewertung-poi-1");
    expect(bewertung).toHaveTextContent("Anna — Will ich unbedingt");
    expect(bewertung).not.toHaveTextContent("In Bewertung");
  });

  it("zeigt an einem POI ohne Runde keinen Stand", () => {
    liste({ runden: [laufendeRunde(["poi-1"])] });

    expect(screen.queryByTestId("poi-bewertung-poi-2")).not.toBeInTheDocument();
  });
});

/**
 * Was ein POI aus der KI-Suche in seiner Zeile zeigt (req-057): an einem
 * Namen allein sieht man nicht, ob ein Ort etwas taugt.
 */
describe("PoiList — die Angaben aus der KI-Suche (req-057)", () => {
  function ausDerSuche(overrides: Partial<Poi> = {}): Poi {
    return poi({
      id: "poi-1",
      name: "Villa Cimbrone",
      ort: "Ravello",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      shortText: "Historische Villa mit Terrasse über der Amalfiküste.",
      kiBegruendung: "Ruhige Gärten — passt zu „wenig Trubel“.",
      photos: [{ id: "foto-1", position: 1 }],
      ...overrides,
    });
  }

  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  it("zeigt zu einem POI aus der Suche sein Foto", () => {
    liste([ausDerSuche()]);

    expect(screen.getByAltText("Foto von Villa Cimbrone")).toHaveAttribute(
      "src",
      "/api/poi-fotos/foto-1",
    );
  });

  it("zeigt die Bewertung mit der Anzahl der Bewertungen", () => {
    liste([ausDerSuche()]);

    expect(screen.getByTestId("poi-google-bewertung-poi-1")).toHaveTextContent(
      "4,6 aus 1.240",
    );
  });

  it("zeigt die kurze Beschreibung des Ortes", () => {
    liste([ausDerSuche()]);

    expect(screen.getByTestId("poi-kurztext-poi-1")).toHaveTextContent(
      "Historische Villa mit Terrasse über der Amalfiküste.",
    );
  });

  it("zeigt den Satz, warum die KI den Ort vorschlaegt", () => {
    liste([ausDerSuche()]);

    expect(screen.getByTestId("poi-begruendung-poi-1")).toHaveTextContent(
      "Ruhige Gärten — passt zu „wenig Trubel“.",
    );
  });

  it("zeigt zu einem von Hand angelegten POI weder Bewertung noch Begruendung", () => {
    liste([poi({ id: "poi-2", name: "Empfehlung von Bert" })]);

    expect(
      screen.queryByTestId("poi-google-bewertung-poi-2"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("poi-begruendung-poi-2"),
    ).not.toBeInTheDocument();
  });
});

/** Mehrere POIs ankreuzen und gesammelt loeschen (req-057). */
describe("PoiList — Aussortieren (req-057)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiList
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        {...props}
      />,
    );
  }

  it("bietet je Zeile ein Auswahlkaestchen, auch ohne Reiseleitung", () => {
    liste();

    expect(screen.getByLabelText("POI 0 auswählen")).toBeInTheDocument();
    expect(screen.getByLabelText("POI 11 auswählen")).toBeInTheDocument();
  });

  it("ist ohne Auswahl nicht bedienbar", () => {
    liste();

    expect(
      screen.getByRole("button", { name: "Ausgewählte löschen" }),
    ).toBeDisabled();
  });

  it("meldet genau die angekreuzten POIs zum Entfernen", async () => {
    const user = userEvent.setup();
    const onPoisDelete = vi.fn();
    liste({ onPoisDelete });

    for (const i of [1, 3, 5, 7, 9]) {
      await user.click(screen.getByLabelText(`POI ${i} auswählen`));
    }
    await user.click(
      screen.getByRole("button", { name: "Ausgewählte löschen" }),
    );

    expect(onPoisDelete).toHaveBeenCalledTimes(1);
    expect(onPoisDelete.mock.calls[0][0].map((p: Poi) => p.id)).toEqual([
      "poi-1",
      "poi-3",
      "poi-5",
      "poi-7",
      "poi-9",
    ]);
  });

  it("zeigt, wie viele angekreuzt sind", async () => {
    const user = userEvent.setup();
    liste();

    await user.click(screen.getByLabelText("POI 0 auswählen"));
    await user.click(screen.getByLabelText("POI 1 auswählen"));

    expect(screen.getByText("2 ausgewählt")).toBeInTheDocument();
  });

  it("kreuzt mit einem Klick alle sichtbaren POIs an", async () => {
    const user = userEvent.setup();
    const onPoisDelete = vi.fn();
    liste({ onPoisDelete });

    await user.click(screen.getByLabelText("Alle POIs auswählen"));
    await user.click(
      screen.getByRole("button", { name: "Ausgewählte löschen" }),
    );

    expect(onPoisDelete.mock.calls[0][0]).toHaveLength(12);
  });

  it("meldet nur POIs, die der Typfilter gerade zeigt", async () => {
    const user = userEvent.setup();
    const onPoisDelete = vi.fn();
    liste({ onPoisDelete });

    await user.selectOptions(
      screen.getByLabelText("Nach Typ filtern"),
      "Restaurant",
    );
    await user.click(screen.getByLabelText("Alle POIs auswählen"));
    await user.click(
      screen.getByRole("button", { name: "Ausgewählte löschen" }),
    );

    expect(onPoisDelete.mock.calls[0][0].map((p: Poi) => p.id)).toEqual([
      "poi-0",
    ]);
  });

  it("hebt die Auswahl nach dem Entfernen auf", async () => {
    const user = userEvent.setup();
    liste({ onPoisDelete: () => {} });

    await user.click(screen.getByLabelText("POI 0 auswählen"));
    await user.click(
      screen.getByRole("button", { name: "Ausgewählte löschen" }),
    );

    expect(
      screen.getByRole("button", { name: "Ausgewählte löschen" }),
    ).toBeDisabled();
  });
});

describe("PoiList — Bilder aus Google, die nicht ankamen (bug-027)", () => {
  /** Die Antwort des Anlegens: der POI steht, seine Bilder nicht. */
  function stubSpeichern(fotoProblem: string | null) {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () => ({
              poi: poi({ id: "poi-neu", name: "inatura" }),
              fotoProblem,
            }),
          }) as Response,
      ),
    );
  }

  function jsx(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return (
      <PoiList
        pois={[]}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        onPoiSaved={() => {}}
        picking={null}
        onPickingChange={() => {}}
        {...props}
      />
    );
  }

  /**
   * Ein POI wie in bug-027: Name eingetippt, Position von der Karte, dann
   * von Hand gespeichert. Das Formular schliesst sich dabei -- deshalb kann
   * die Meldung ueber die fehlenden Bilder nicht darin stehen.
   */
  async function legeAn(user: ReturnType<typeof userEvent.setup>) {
    const { rerender } = render(jsx());
    await user.click(screen.getByRole("button", { name: "POI anlegen" }));
    // Der Klick auf die Karte kommt von aussen ins offene Formular herein.
    rerender(
      jsx({ picked: { key: NEUER_POI, position: { lat: 47.4, lng: 9.7 } } }),
    );
    await user.type(screen.getByLabelText("Name"), "inatura");
    await user.click(screen.getByRole("button", { name: "Speichern" }));
  }

  it("meldet nach dem Anlegen, dass die Bilder nicht abgelegt werden konnten", async () => {
    const user = userEvent.setup();
    stubSpeichern("ablage_fehlt");

    await legeAn(user);

    expect(await screen.findByTestId("poi-foto-problem")).toHaveTextContent(
      GOOGLE_FOTO_PROBLEM_TEXT.ablage_fehlt,
    );
  });

  it("schweigt, solange die Bilder ankommen", async () => {
    const user = userEvent.setup();
    stubSpeichern(null);

    await legeAn(user);

    // Das Formular hat sich geschlossen -- gespeichert wurde also.
    expect(screen.queryByTestId("poi-form-neu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("poi-foto-problem")).not.toBeInTheDocument();
  });
});

/**
 * Was ein Ort je Person kostet, steht in seiner Box (req-061) — es
 * entscheidet mit, ob er in den Plan kommt.
 */
describe("PoiList — Kosten in der POI-Box (req-061)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  it("zeigt den Betrag in der Box des POI", () => {
    liste([poi({ id: "poi-1", name: "Villa Rufolo", kostenCent: 1250 })]);

    expect(screen.getByTestId("poi-kosten-poi-1")).toHaveTextContent(
      "12,50 € pro Person",
    );
  });

  it("zeigt bei einem POI ohne Kosten keinen Betrag", () => {
    liste([poi({ id: "poi-1", name: "Villa Rufolo" })]);

    expect(screen.queryByTestId("poi-kosten-poi-1")).not.toBeInTheDocument();
  });
});

/**
 * Ob ein Ort schon gebucht ist, steht als Kennzeichen in seiner Box
 * (req-061) — „Nicht nötig" trägt keines, sonst trüge jeder Strand eines.
 */
describe("PoiList — Buchungsstatus in der POI-Box (req-061)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiList
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  it("kennzeichnet einen offenen POI", () => {
    liste([poi({ id: "poi-1", name: "Hotel Luna", buchung: "offen" })]);

    expect(screen.getByTestId("poi-buchung-poi-1")).toHaveTextContent("Offen");
  });

  it("kennzeichnet einen gebuchten POI", () => {
    liste([poi({ id: "poi-1", name: "Hotel Luna", buchung: "gebucht" })]);

    expect(screen.getByTestId("poi-buchung-poi-1")).toHaveTextContent(
      "Gebucht",
    );
  });

  it("gibt einem POI mit 'Nicht nötig' kein Kennzeichen", () => {
    liste([poi({ id: "poi-1", name: "Strand", buchung: "nicht_noetig" })]);

    expect(screen.queryByTestId("poi-buchung-poi-1")).not.toBeInTheDocument();
  });

  it("gibt einem POI ohne Angabe kein Kennzeichen", () => {
    liste([poi({ id: "poi-1", name: "Strand" })]);

    expect(screen.queryByTestId("poi-buchung-poi-1")).not.toBeInTheDocument();
  });
});
