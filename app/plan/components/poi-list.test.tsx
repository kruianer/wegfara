import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NEUER_POI, PoiList } from "./poi-list";
import { ANLEGEZEILE_LABEL } from "./poi-anlegezeile";
import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde } from "@/lib/bewertungen/types";
import { GOOGLE_FOTO_PROBLEM_TEXT } from "@/lib/pois/google-foto-problem";
import { VORGEWAEHLTE_LISTEN_EINSTELLUNGEN } from "@/lib/pois/ansicht-einstellungen";
import { POI_TYPE_COLOR } from "@/lib/pois/type-meta";
import { POI_STATUS_COLOR } from "@/lib/pois/status-meta";
import { filterWaehlen, sortierenNach } from "@/tests/poi-liste-bedienen";

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

/**
 * Die Liste, wie der Planer sie stellt: Typfilter, Statusfilter und
 * Sortierung liegen seit bug-052 ausserhalb der Komponente — in PlanView, je
 * Reise gemerkt, damit sie den Wechsel des Bereichs ueberdauern. Dieser
 * Rahmen haelt sie an PlanViews Stelle; ohne ihn bliebe jede Auswahl in den
 * Filtern wirkungslos.
 */
function PoiListe(props: ComponentProps<typeof PoiList>) {
  const [listenEinstellungen, setListenEinstellungen] = useState(
    VORGEWAEHLTE_LISTEN_EINSTELLUNGEN,
  );

  return (
    <PoiList
      listenEinstellungen={listenEinstellungen}
      onListenEinstellungenChange={setListenEinstellungen}
      {...props}
    />
  );
}

/**
 * Schaltet die Liste in den Auswahlmodus (req-097): erst dann tragen die
 * Zeilen ein Ankreuzfeld, und im Kopf stehen die Aktionen für die Auswahl.
 */
function auswahlStarten() {
  fireEvent.click(screen.getByRole("button", { name: "Auswählen" }));
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
 * selbst — die Überschrift „Points of Interest" entfällt. Seit req-098 steht
 * im Kopf der knappe Titel „POIs" mit der Zahl daneben, wie im Entwurf.
 */
describe("PoiList — Titel über der Liste (req-060, req-098)", () => {
  it("zeigt über der Liste nur den knappen Titel „POIs“", () => {
    render(
      <PoiListe
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getAllByRole("heading")).toHaveLength(1);
    expect(screen.getByRole("heading")).toHaveTextContent(/^POIs$/);
    expect(screen.queryByText(/Points of/)).not.toBeInTheDocument();
  });

  it("zeigt ungefiltert nur die Zahl, gefiltert „x von y“", () => {
    render(
      <PoiListe
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByTestId("poi-zaehler")).toHaveTextContent(/^12$/);
    filterWaehlen("Typ", "Restaurant");
    expect(screen.getByTestId("poi-zaehler")).toHaveTextContent("1 von 12");
  });
});

/**
 * Das Anlegen sitzt seit req-060 über der Liste statt in ihr: zuerst die
 * Anlegezeile, dann der Filter, dann die Liste.
 */
describe("PoiList — Anlegezeile über der Liste (req-060)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiListe
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
 * Gefiltert wird seit req-060 nur die Liste. Seit req-098 im Filterblatt
 * statt über Auswahllisten -- und je Feld mit mehreren Werten. Vorwahl ist
 * die leere Menge: kein Feld filtert.
 */
describe("PoiList — Typfilter im Filterblatt (req-060, req-098)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiListe
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

  it("filtert beim Öffnen nicht", () => {
    liste();

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    const typ = screen.getByRole("group", { name: "Typ" });
    for (const pille of within(typ).getAllByRole("button")) {
      expect(pille).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("zeigt nach Auswahl eines Typs nur POIs dieses Typs", () => {
    liste();

    filterWaehlen("Typ", "Restaurant");

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "POI 0" })).toBeInTheDocument();
    expect(screen.getByText("1 von 12")).toBeInTheDocument();
  });

  it("zeigt nach dem Abwählen wieder alle POIs", () => {
    liste();

    filterWaehlen("Typ", "Restaurant");
    filterWaehlen("Typ", "Restaurant");

    expect(screen.getAllByRole("listitem")).toHaveLength(12);
    expect(screen.getByTestId("poi-zaehler")).toHaveTextContent(/^12$/);
  });
});

/** Der Statusfilter der Liste (req-060) — die Karte hat ihren eigenen. */
describe("PoiList — Statusfilter im Filterblatt (req-060, req-098)", () => {
  function liste() {
    return render(
      <PoiListe
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

  it("filtert beim Öffnen nicht", () => {
    liste();

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("zeigt bei „Fix“ nur POIs mit diesem Status", () => {
    liste();

    filterWaehlen("Status", "Fix");

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

  it("wirkt zusammen mit dem Typfilter", () => {
    liste();

    filterWaehlen("Status", "Fix");
    filterWaehlen("Typ", "Restaurant");

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

/** Die Sortierung der Liste (req-060) — vorgewählt nach Nummer. */
describe("PoiList — Sortierung (req-060)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiListe
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
    // Der Titel allein: der Knopf darum trägt seit req-097 auch Ort und
    // Kurztext.
    return screen
      .getAllByTestId(/^poi-titel-/)
      .map((titel) => titel.textContent ?? "");
  }

  const DREI = [
    poi({ id: "poi-1", name: "Villa Rufolo", number: 1, bewertung: 4.2 }),
    poi({ id: "poi-2", name: "Ausgrabungsstätte Pompeji", number: 2 }),
    poi({ id: "poi-3", name: "Bucht bei Praiano", number: 3, bewertung: 4.7 }),
  ];

  it("steht beim Öffnen auf „Nummer“", () => {
    liste(DREI);

    fireEvent.click(screen.getByRole("button", { name: "Sortieren" }));
    expect(screen.getByRole("button", { name: /^Nummer/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(reihenfolge()).toEqual([
      "Villa Rufolo",
      "Ausgrabungsstätte Pompeji",
      "Bucht bei Praiano",
    ]);
  });

  it("ordnet nach Name", () => {
    liste(DREI);

    sortierenNach("Name");

    expect(reihenfolge()).toEqual([
      "Ausgrabungsstätte Pompeji",
      "Bucht bei Praiano",
      "Villa Rufolo",
    ]);
  });

  it("stellt bei „Bewertung“ POIs ohne Bewertung ans Ende", () => {
    liste(DREI);

    sortierenNach("Bewertung");

    expect(reihenfolge()).toEqual([
      "Bucht bei Praiano",
      "Villa Rufolo",
      "Ausgrabungsstätte Pompeji",
    ]);
  });

  it("lässt jedem POI seine Nummer, egal wie sortiert wird (req-013)", () => {
    liste(DREI);

    sortierenNach("Name");

    expect(screen.getByTestId("poi-number-poi-1")).toHaveTextContent("#1");
    expect(screen.getByTestId("poi-number-poi-2")).toHaveTextContent("#2");
    expect(screen.getByTestId("poi-number-poi-3")).toHaveTextContent("#3");
  });

  it("sortiert nur, was der Filter zeigt", () => {
    liste([
      ...DREI,
      poi({
        id: "poi-4",
        name: "Alberobello",
        number: 4,
        type: "restaurant",
      }),
    ]);

    filterWaehlen("Typ", "Restaurant");
    sortierenNach("Name");

    expect(reihenfolge()).toEqual(["Alberobello"]);
  });

  it("nennt im Sortierblatt je Ordnung ihre Richtung (req-098)", () => {
    liste(DREI);

    fireEvent.click(screen.getByRole("button", { name: "Sortieren" }));

    expect(screen.getByTestId("poi-sortier-richtung-nummer")).toHaveTextContent(
      "1 → 3",
    );
    expect(screen.getByTestId("poi-sortier-richtung-name")).toHaveTextContent(
      "A → Z",
    );
    expect(screen.getByTestId("poi-sortier-richtung-status")).toHaveTextContent(
      "Fix zuerst",
    );
    expect(
      screen.getByTestId("poi-sortier-richtung-bewertung"),
    ).toHaveTextContent("beste zuerst");
    // Eine Richtung umschalten lässt sich nicht -- je Ordnung ein Knopf.
    const blatt = screen.getByTestId("poi-sortierblatt");
    expect(within(blatt).getAllByRole("button")).toHaveLength(4);
  });
});

/**
 * Das Löschen-Symbol rechts in der Box (req-060) gibt es seit req-097 nicht
 * mehr: ein Papierkorb je Zeile ist ein dauerhafter Knopf für etwas
 * Endgültiges, der sich versehentlich leicht trifft. Gelöscht wird über das
 * Formular der Zeile und über den Auswahlmodus (req-057) -- und weiterhin
 * erst nach der Rückfrage.
 */
describe("PoiList — Löschen ohne Symbol in der Box (req-060, req-097)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiListe
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

  it("bietet in der Box keinen Papierkorb an", () => {
    liste();

    expect(
      screen.queryByRole("button", { name: "Villa Rufolo entfernen" }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("poi-row-poi-1")).queryByRole("button", {
        name: /entfernen|löschen/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("meldet den POI aus dem Formular zur Rückfrage, statt ihn selbst zu entfernen", async () => {
    const user = userEvent.setup();
    const onPoiDelete = vi.fn();
    liste({ onPoiDelete });

    await user.click(screen.getByTestId("poi-name-poi-1"));
    await user.click(screen.getByRole("button", { name: "POI löschen" }));

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
      <PoiListe
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

  it("zeigt ungefiltert die Zahl aller POIs (req-098)", () => {
    render(
      <PoiListe
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByTestId("poi-zaehler")).toHaveTextContent(/^12$/);
  });

  it("zeigt keinen Foto-Platzhalter in einer POI-Zeile", () => {
    render(
      <PoiListe
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
      <PoiListe
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
      "Fix",
    );

    expect(onStatusChange).toHaveBeenCalledWith("a", "gesetzt");
  });

  it("zeigt den Status einer Zeile in der Statusfarbe (gesetzt = grün)", () => {
    const p = poi({ id: "a", name: "Villa Rufolo", status: "gesetzt" });
    render(
      <PoiListe
        pois={[p]}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    // Seit req-097 trägt die Statuspille die Farbe selbst -- dieselbe wie
    // die Nadel auf der Karte. Das Blatt liest sie aus --status.
    expect(
      screen.getByTestId("poi-row-a").style.getPropertyValue("--status"),
    ).toBe("#8FD6A4");
    expect(screen.getByTestId("poi-status-a").className).toMatch(
      /statusSelect/,
    );
  });

  it("zeigt die Nummer jedes POI in seiner Zeile", () => {
    render(
      <PoiListe
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
      <PoiListe
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

  it("bietet im Kopf keine Bewertungsrunde an (req-054, seit req-098 im Bereich Bewertungen)", () => {
    render(
      <PoiListe
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
      <PoiListe
        pois={pois}
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

  /**
   * Sieben Fotos je POI (req-068) aendern nichts an der Liste: die Zeile
   * bleibt eine Zeile und zeigt genau ein Bild -- die Ansicht wird keine
   * Galerie. Die uebrigen Fotos liegen in der Grossansicht dahinter.
   */
  it("zeigt in der Zeile auch bei sieben Fotos genau ein Bild", () => {
    liste([
      villaRufolo({
        photos: Array.from({ length: 7 }, (_, i) => ({
          id: `foto-${i + 1}`,
          position: i + 1,
        })),
      }),
    ]);

    const bilder = within(screen.getByTestId("poi-row-poi-1")).getAllByRole(
      "img",
    );
    expect(bilder).toHaveLength(1);
    expect(bilder[0]).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  /**
   * Ist das erste Foto ein KI-Bild, ist es auch in der Liste als solches zu
   * erkennen (req-072) -- dort, wo man die POIs der Reihe nach durchgeht.
   */
  it("kennzeichnet ein erzeugtes erstes Foto in der Zeile", () => {
    liste([
      villaRufolo({
        photos: [{ id: "foto-ki", position: 1, source: "ki" }],
      }),
    ]);

    const zeile = within(screen.getByTestId("poi-row-poi-1"));
    expect(zeile.getByRole("img", { name: "Mit KI erzeugt" })).toBeVisible();
  });

  it("kennzeichnet ein hochgeladenes erstes Foto in der Zeile nicht", () => {
    liste([
      villaRufolo({
        photos: [{ id: "foto-1", position: 1, source: "manuell" }],
      }),
    ]);

    expect(
      screen.queryByRole("img", { name: "Mit KI erzeugt" }),
    ).not.toBeInTheDocument();
  });

  /**
   * Das Zeichen haengt am ersten Foto, nicht am POI: liegt das KI-Bild
   * weiter hinten, bleibt die Zeile ohne Zeichen -- dort ist es ja nicht zu
   * sehen.
   */
  it("laesst die Zeile ohne Zeichen, wenn das KI-Bild nicht das erste ist", () => {
    liste([
      villaRufolo({
        photos: [
          { id: "foto-1", position: 1, source: "manuell" },
          { id: "foto-ki", position: 2, source: "ki" },
        ],
      }),
    ]);

    expect(
      within(screen.getByTestId("poi-row-poi-1")).queryByRole("img", {
        name: "Mit KI erzeugt",
      }),
    ).not.toBeInTheDocument();
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
      screen.getByTestId("poi-gegend-poi-1"),
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
      <PoiListe
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

    // Seit req-097 steht der Ort vor dem Kurztext und der Typ auf dem Bild.
    expect(screen.getByTestId("poi-ort-poi-1")).toHaveTextContent("Ravello");
    expect(screen.getByTestId("poi-typ-poi-1")).toHaveTextContent(
      "Sehenswürdigkeit",
    );
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
      <PoiListe
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
      <PoiListe
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
        personen={PERSONEN}
        {...props}
      />,
    );
  }

  /**
   * Gestartet und beendet wird die Runde seit req-098 im Bereich
   * „Bewertungen" (dort getestet, bewertungen-view.test.tsx). Die Liste
   * zeigt nur noch den Stand an den Zeilen.
   */
  it("bietet im Auswahlmodus keine Bewertungsrunde an (req-098)", () => {
    liste();
    auswahlStarten();
    fireEvent.click(screen.getByLabelText("Villa Rufolo auswählen"));

    expect(
      screen.queryByRole("button", { name: "Bewertungsrunde starten" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Bewertungsrunde/)).not.toBeInTheDocument();
  });

  it("zeigt die laufende Runde nicht im Kopf der Liste (req-098)", () => {
    // Ihr Stand steht im Bereich „Bewertungen" (req-063).
    liste({ runden: [laufendeRunde(["poi-1"])] });

    expect(
      screen.queryByRole("button", { name: "Bewertungsrunde beenden" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Bewertungsrunde läuft/)).not.toBeInTheDocument();
    // Angekreuzt wird weiterhin -- seit req-057 trägt dieselbe Auswahl das
    // Aussortieren mehrerer POIs, und das geht auch während einer Runde.
    auswahlStarten();
    expect(
      screen.getByRole("button", { name: /^Entfernen/ }),
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
      "Fix",
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
      <PoiListe
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

    // Unter dem Bild knapp (req-097), die volle Angabe im Tooltip.
    const bewertung = screen.getByTestId("poi-google-bewertung-poi-1");
    expect(bewertung).toHaveTextContent("★ 4,6");
    expect(bewertung).toHaveTextContent("1,2k");
    expect(bewertung).toHaveAttribute("title", "4,6 aus 1.240 Bewertungen");
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

/**
 * „Ausgewählte löschen" und „Bewertungsrunde starten" standen in einer
 * eigenen Leiste unter dem Filter und kosteten damit eine ganze Zeile
 * (bug-040). Sie stehen seit req-098 im Kopf der Liste, im Auswahlmodus an
 * der Stelle der Filter -- und nennen im Tooltip weiterhin, was sie tun.
 */
describe("PoiList — Aktionen im Kopf der Liste (bug-040, req-098)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    return render(
      <PoiListe
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

  /** Was im Kopf der Liste steht — und nicht darunter. */
  function kopf() {
    return within(screen.getByTestId("poi-filterzeile"));
  }

  it("stellt die Aktionen dorthin, wo sonst die Filter stehen (req-097)", () => {
    liste();

    // Im Normalfall die vier Griffe, keine Aktionen.
    expect(kopf().getByRole("button", { name: "Filter" })).toBeInTheDocument();
    expect(
      kopf().queryByRole("button", { name: /^Entfernen/ }),
    ).not.toBeInTheDocument();

    auswahlStarten();

    const zeile = kopf();
    expect(
      zeile.queryByRole("button", { name: "Filter" }),
    ).not.toBeInTheDocument();
    expect(
      zeile.getByRole("button", { name: /^Entfernen/ }),
    ).toBeInTheDocument();
  });

  it("kreuzt auch alle POIs aus dem Kopf an", () => {
    liste();
    auswahlStarten();

    expect(kopf().getByLabelText("Alle POIs auswählen")).toBeVisible();
  });

  it("zeigt Entfernen als Symbol mit der Zahl der Angekreuzten (req-098)", async () => {
    const user = userEvent.setup();
    liste();
    auswahlStarten();

    for (const i of [1, 2, 3]) {
      await user.click(screen.getByLabelText(`POI ${i} auswählen`));
    }

    const entfernen = kopf().getByRole("button", { name: /^Entfernen/ });
    expect(entfernen.querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("poi-entfernen-zahl")).toHaveTextContent(/^3$/);
    expect(entfernen).toHaveAccessibleName("Entfernen (3)");
  });

  it("nennt im Tooltip weiterhin, was der Knopf tut", () => {
    liste();
    auswahlStarten();

    expect(kopf().getByRole("button", { name: /^Entfernen/ })).toHaveAttribute(
      "title",
      "Ausgewählte entfernen",
    );
  });

  it("bleibt ohne angekreuzte POIs unwirksam", () => {
    liste();
    auswahlStarten();

    expect(kopf().getByRole("button", { name: /^Entfernen/ })).toBeDisabled();
  });

  it("meldet zum Entfernen nur an die Rueckfrage, loescht nicht selbst", async () => {
    const user = userEvent.setup();
    const onPoisDelete = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    liste({ onPoisDelete });
    auswahlStarten();

    await user.click(screen.getByLabelText("POI 0 auswählen"));
    await user.click(kopf().getByRole("button", { name: /^Entfernen/ }));

    expect(onPoisDelete).toHaveBeenCalledTimes(1);
    // Die Rueckfrage aus req-035 entscheidet, ob wirklich entfernt wird --
    // die Zeile selbst spricht dafuer nie mit dem Server.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("laesst unter dem Kopf keine eigene Aktionsleiste mehr stehen", () => {
    liste();

    // Vor bug-040 stand hier „POIs auswählen" samt beider Knoepfe mit Text.
    expect(screen.queryByText("POIs auswählen")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("poi-scrollbereich")).queryByRole("button", {
        name: /^Entfernen/,
      }),
    ).not.toBeInTheDocument();
  });
});

/** Mehrere POIs ankreuzen und gesammelt loeschen (req-057). */
describe("PoiList — Aussortieren (req-057)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    render(
      <PoiListe
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        {...props}
      />,
    );
    // Angekreuzt wird seit req-097 im Auswahlmodus.
    auswahlStarten();
  }

  it("bietet je Zeile ein Auswahlkaestchen, auch ohne Reiseleitung", () => {
    liste();

    expect(screen.getByLabelText("POI 0 auswählen")).toBeInTheDocument();
    expect(screen.getByLabelText("POI 11 auswählen")).toBeInTheDocument();
  });

  it("ist ohne Auswahl nicht bedienbar", () => {
    liste();

    expect(screen.getByRole("button", { name: /^Entfernen/ })).toBeDisabled();
  });

  it("meldet genau die angekreuzten POIs zum Entfernen", async () => {
    const user = userEvent.setup();
    const onPoisDelete = vi.fn();
    liste({ onPoisDelete });

    for (const i of [1, 3, 5, 7, 9]) {
      await user.click(screen.getByLabelText(`POI ${i} auswählen`));
    }
    await user.click(screen.getByRole("button", { name: /^Entfernen/ }));

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

    expect(screen.getByText("2 gewählt")).toBeInTheDocument();
  });

  it("kreuzt mit einem Klick alle sichtbaren POIs an", async () => {
    const user = userEvent.setup();
    const onPoisDelete = vi.fn();
    liste({ onPoisDelete });

    await user.click(screen.getByLabelText("Alle POIs auswählen"));
    await user.click(screen.getByRole("button", { name: /^Entfernen/ }));

    expect(onPoisDelete.mock.calls[0][0]).toHaveLength(12);
  });

  it("meldet nur POIs, die der Typfilter gerade zeigt", async () => {
    const user = userEvent.setup();
    const onPoisDelete = vi.fn();
    liste({ onPoisDelete });

    // Gefiltert wird ausserhalb des Auswahlmodus (req-097).
    await user.click(screen.getByRole("button", { name: "Fertig" }));
    filterWaehlen("Typ", "Restaurant");
    await user.click(screen.getByRole("button", { name: "Auswählen" }));
    await user.click(screen.getByLabelText("Alle POIs auswählen"));
    await user.click(screen.getByRole("button", { name: /^Entfernen/ }));

    expect(onPoisDelete.mock.calls[0][0].map((p: Poi) => p.id)).toEqual([
      "poi-0",
    ]);
  });

  it("hebt die Auswahl nach dem Entfernen auf", async () => {
    const user = userEvent.setup();
    liste({ onPoisDelete: () => {} });

    await user.click(screen.getByLabelText("POI 0 auswählen"));
    await user.click(screen.getByRole("button", { name: /^Entfernen/ }));

    expect(screen.getByRole("button", { name: /^Entfernen/ })).toBeDisabled();
  });
});

/**
 * Mehrere POIs ankreuzen und ihnen gemeinsam einen Status geben (req-069) --
 * derselbe Weg wie beim gemeinsamen Entfernen (req-057), nur eine andere
 * Aktion daneben.
 */
describe("PoiList — Status für mehrere POIs (req-069)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    render(
      <PoiListe
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        {...props}
      />,
    );
    // Angekreuzt wird seit req-097 im Auswahlmodus.
    auswahlStarten();
  }

  function gemeinsamerStatus() {
    return screen.getByRole("combobox", {
      name: "Status für Ausgewählte setzen",
    });
  }

  it("steht im Kopf der Liste, wo auch das gemeinsame Entfernen steht", () => {
    liste();

    expect(
      within(screen.getByTestId("poi-filterzeile")).getByRole("combobox", {
        name: "Status für Ausgewählte setzen",
      }),
    ).toBeInTheDocument();
  });

  it("bietet dieselben Status wie ein einzelner POI", () => {
    liste();

    const einzeln = within(
      screen.getByRole("combobox", { name: "Status von POI 0" }),
    )
      .getAllByRole("option")
      .map((option) => option.textContent);
    const gemeinsam = within(gemeinsamerStatus())
      .getAllByRole("option")
      .map((option) => option.textContent);

    // Vorne steht die Beschriftung der Liste selbst -- sie ist kein Status.
    expect(gemeinsam.slice(1)).toEqual(einzeln);
  });

  it("meldet genau die angekreuzten POIs mit dem gewählten Status", async () => {
    const user = userEvent.setup();
    const onStatusChangeFuerMehrere = vi.fn();
    liste({ onStatusChangeFuerMehrere });

    for (const i of [1, 3, 5]) {
      await user.click(screen.getByLabelText(`POI ${i} auswählen`));
    }
    await user.selectOptions(gemeinsamerStatus(), "gesetzt");

    expect(onStatusChangeFuerMehrere).toHaveBeenCalledTimes(1);
    expect(onStatusChangeFuerMehrere).toHaveBeenCalledWith(
      ["poi-1", "poi-3", "poi-5"],
      "gesetzt",
    );
  });

  it("lässt die übrigen sichtbaren POIs aus", async () => {
    const user = userEvent.setup();
    const onStatusChangeFuerMehrere = vi.fn();
    liste({ onStatusChangeFuerMehrere });

    await user.click(screen.getByLabelText("POI 2 auswählen"));
    await user.selectOptions(gemeinsamerStatus(), "auf_keinen_fall");

    expect(onStatusChangeFuerMehrere).toHaveBeenCalledWith(
      ["poi-2"],
      "auf_keinen_fall",
    );
  });

  it("ist ohne Auswahl nicht auslösbar", () => {
    liste();

    expect(gemeinsamerStatus()).toBeDisabled();
  });

  it("lässt die Auswahl danach stehen", async () => {
    const user = userEvent.setup();
    liste({ onStatusChangeFuerMehrere: () => {} });

    await user.click(screen.getByLabelText("POI 0 auswählen"));
    await user.click(screen.getByLabelText("POI 1 auswählen"));
    await user.selectOptions(gemeinsamerStatus(), "gesetzt");

    expect(screen.getByLabelText("POI 0 auswählen")).toBeChecked();
    expect(screen.getByLabelText("POI 1 auswählen")).toBeChecked();
    expect(screen.getByText("2 gewählt")).toBeInTheDocument();
  });

  it("fällt nach dem Setzen auf seine Beschriftung zurück", async () => {
    // Die Liste zeigt keinen Zustand an -- die angekreuzten POIs können
    // verschiedene Status tragen. Sie muss deshalb sofort wieder denselben
    // Status auslösen können.
    const user = userEvent.setup();
    const onStatusChangeFuerMehrere = vi.fn();
    liste({ onStatusChangeFuerMehrere });

    await user.click(screen.getByLabelText("POI 0 auswählen"));
    await user.selectOptions(gemeinsamerStatus(), "gesetzt");

    expect(gemeinsamerStatus()).toHaveValue("");
  });

  it("wird gezeichnet wie die übrigen Griffe des Kopfs (req-098)", () => {
    // Von dort kommen die 44x44 px Trefferfläche (bug-024) und die gewohnte
    // sichtbare Höhe (bug-039) -- siehe poi-list.layout.test.ts. Die
    // Auswahlliste selbst liegt unsichtbar darüber.
    liste();

    const knopf = gemeinsamerStatus().closest("label")!;
    expect(knopf.className).toMatch(/knopf/);
    expect(knopf).toHaveTextContent("Status…");
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
      <PoiListe
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
/**
 * Die Kosten standen bis req-097 in der Box. Seither entfallen sie aus der
 * Zeile -- beim Sammeln steht ein Preis selten und kostete eine ganze Zeile
 * -- und bleiben im Formular beim Anklicken des Titels.
 */
describe("PoiList — Kosten im Formular statt in der Box (req-061, req-097)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiListe
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  it("zeigt den Betrag nicht in der Box, aber im Formular", async () => {
    const user = userEvent.setup();
    liste([poi({ id: "poi-1", name: "Villa Rufolo", kostenCent: 1250 })]);

    expect(screen.queryByTestId("poi-kosten-poi-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("poi-row-poi-1")).not.toHaveTextContent("12,50");

    await user.click(screen.getByTestId("poi-name-poi-1"));

    expect(screen.getByLabelText("Kosten je Person")).toHaveValue("12,50");
  });

  it("zeigt bei einem POI ohne Kosten keinen Betrag", () => {
    liste([poi({ id: "poi-1", name: "Villa Rufolo" })]);

    expect(screen.queryByTestId("poi-kosten-poi-1")).not.toBeInTheDocument();
  });
});

/**
 * Ob ein Ort schon gebucht ist, steht als Kennzeichen in seiner Box
 * (req-061) — „Nicht nötig" trägt keines, sonst trüge jeder Strand eines.
 * Seit req-097 ist es ein Zeichen unter dem Bild: Haken für gebucht,
 * Ausrufezeichen für offen; der Zustand steht in seinem Namen.
 */
describe("PoiList — Buchungsstatus in der POI-Box (req-061)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiListe
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

    expect(
      screen.getByRole("img", { name: "Buchung: Offen" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("poi-buchung-poi-1").className).toMatch(
      /buchungOffen/,
    );
  });

  it("kennzeichnet einen gebuchten POI", () => {
    liste([poi({ id: "poi-1", name: "Hotel Luna", buchung: "gebucht" })]);

    expect(
      screen.getByRole("img", { name: "Buchung: Gebucht" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("poi-buchung-poi-1").className).toMatch(
      /buchungGebucht/,
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

/**
 * Der Knopf „Maps" führt zum Ort selbst, sobald der POI aus Google stammt
 * (bug-037) — dort stehen Bewertungen und weitere Fotos.
 */
describe("PoiList — Kartenweg öffnet den Ort (bug-037)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiListe
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  function mapsLink(): URL {
    return new URL(
      // Seit req-097 ein Symbol mit dem Namen „Auf der Karte".
      screen
        .getByRole("link", { name: "Auf der Karte" })
        .getAttribute("href") ?? "",
    );
  }

  it("nennt bei einem POI aus Google dessen Kennung", () => {
    liste([
      poi({
        id: "poi-1",
        name: "Villa Rufolo",
        googlePlaceId: "ChIJVillaRufolo",
      }),
    ]);

    expect(mapsLink().searchParams.get("query_place_id")).toBe(
      "ChIJVillaRufolo",
    );
  });

  it("öffnet ohne Google-Kennung wie bisher die Koordinaten", () => {
    liste([poi({ id: "poi-1", name: "Villa Rufolo" })]);

    expect(mapsLink().searchParams.get("query")).toBe("40.85,14.27");
    expect(mapsLink().searchParams.has("query_place_id")).toBe(false);
  });
});

/**
 * Ein Klick auf das Foto der Zeile zeigt es groß (bug-038): bis dahin war es
 * ein reines Bildelement ohne Klickverhalten. Wie sich die Großansicht
 * bedienen lässt, prüft components/foto-ansicht.test.tsx — hier steht nur der
 * Weg von der Liste dorthin.
 */
describe("PoiList — Großansicht des Fotos (bug-038)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiListe
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  function mitFotos(anzahl: number): Poi {
    return poi({
      id: "poi-1",
      name: "Villa Rufolo",
      photos: Array.from({ length: anzahl }, (_, i) => ({
        id: `foto-${i + 1}`,
        position: i + 1,
      })),
    });
  }

  it("zeigt das Foto groß, wenn man es anklickt", async () => {
    const user = userEvent.setup();
    liste([mitFotos(1)]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Fotos von Villa Rufolo groß anzeigen",
      }),
    );

    const gross = screen.getByRole("dialog", {
      name: "Fotos von Villa Rufolo",
    });
    expect(
      within(gross).getByRole("img", { name: "Bild 1 von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("gibt der Großansicht alle Fotos des POI zum Blättern mit", async () => {
    const user = userEvent.setup();
    liste([mitFotos(3)]);

    await user.click(
      screen.getByRole("button", {
        name: "Fotos von Villa Rufolo groß anzeigen",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(screen.getByText("Bild 2 von 3")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Bild 2 von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-2");
  });

  it("schließt die Großansicht wieder mit der Escape-Taste", async () => {
    const user = userEvent.setup();
    liste([mitFotos(2)]);

    await user.click(
      screen.getByRole("button", {
        name: "Fotos von Villa Rufolo groß anzeigen",
      }),
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("schließt die Großansicht wieder mit dem Knopf „Schließen“", async () => {
    const user = userEvent.setup();
    liste([mitFotos(2)]);

    await user.click(
      screen.getByRole("button", {
        name: "Fotos von Villa Rufolo groß anzeigen",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Schließen" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lässt die farbige Fläche eines POI ohne Foto unangetastet", () => {
    liste([poi({ id: "poi-1", name: "Handgemacht", photos: [] })]);

    expect(screen.getByTestId("poi-swatch-poi-1")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /groß anzeigen/ }),
    ).not.toBeInTheDocument();
  });

  it("klappt beim Klick auf das Foto kein Formular auf", async () => {
    const user = userEvent.setup();
    liste([mitFotos(1)]);

    await user.click(
      screen.getByRole("button", {
        name: "Fotos von Villa Rufolo groß anzeigen",
      }),
    );

    expect(screen.queryByTestId("poi-form-poi-1")).not.toBeInTheDocument();
  });
});

/**
 * Die Zeile kompakt und dreispaltig (req-097): Bild mit Bewertung und
 * Buchung darunter | Titel, Kurztext, Wege | Status und Gegend. Masse,
 * feste Höhe und Abschneiden prüft das Blatt (poi-list.layout.test.ts) --
 * jsdom führt kein CSS aus.
 */
describe("PoiList — die dreispaltige Zeile (req-097)", () => {
  function liste(pois: Poi[]) {
    return render(
      <PoiListe
        pois={pois}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );
  }

  const FOTO = { id: "foto-1", position: 1 };

  it("zeigt das Foto im Bildfeld der Zeile", () => {
    liste([poi({ id: "poi-1", name: "Guggenheim", photos: [FOTO] })]);

    const bild = screen.getByTestId("poi-bild-poi-1");
    expect(bild.className).toMatch(/_bild_/);
    expect(
      within(bild).getByRole("img", { name: "Foto von Guggenheim" }),
    ).toBeInTheDocument();
  });

  it("zeigt Nummer und Typ auch ohne Foto, auf der leeren Fläche", () => {
    liste([
      poi({ id: "poi-1", name: "Puente colgante", number: 3, type: "strand" }),
    ]);

    const bild = screen.getByTestId("poi-bild-poi-1");
    expect(within(bild).getByTestId("poi-swatch-poi-1")).toBeInTheDocument();
    expect(within(bild).getByTestId("poi-number-poi-1")).toHaveTextContent(
      "#3",
    );
    expect(within(bild).getByTestId("poi-typ-poi-1")).toHaveTextContent(
      "Strand",
    );
  });

  it("legt Nummer und Typ auch auf ein Foto", () => {
    liste([poi({ id: "poi-1", name: "Guggenheim", photos: [FOTO] })]);

    const bild = screen.getByTestId("poi-bild-poi-1");
    expect(within(bild).getByTestId("poi-number-poi-1")).toBeInTheDocument();
    expect(within(bild).getByTestId("poi-typ-poi-1")).toBeInTheDocument();
  });

  it("gibt dem Typ-Band eines Restaurants dessen Typfarbe", () => {
    liste([poi({ id: "poi-1", name: "Mercado", type: "restaurant" })]);

    expect(screen.getByTestId("poi-typ-poi-1")).toHaveTextContent("Restaurant");
    // Das Band liest die Farbe als --typ (poi-list.module.css).
    expect(
      screen.getByTestId("poi-row-poi-1").style.getPropertyValue("--typ"),
    ).toBe(POI_TYPE_COLOR.restaurant);
  });

  it("gibt dem Bild eines Weltkulturerbes den Glow, anderen nicht", () => {
    liste([
      poi({ id: "poi-1", name: "Guggenheim", type: "weltkulturerbe" }),
      poi({ id: "poi-2", name: "Mercado", type: "restaurant" }),
    ]);

    expect(screen.getByTestId("poi-bild-poi-1").className).toMatch(
      /bildWelterbe/,
    );
    expect(screen.getByTestId("poi-bild-poi-2").className).not.toMatch(
      /bildWelterbe/,
    );
  });

  it("stellt die Bewertung unter das Bild", () => {
    liste([
      poi({
        id: "poi-1",
        name: "Guggenheim",
        bewertung: 4.7,
        bewertungAnzahl: 61204,
      }),
    ]);

    const bild = screen.getByTestId("poi-bild-poi-1");
    const bewertung = screen.getByTestId("poi-google-bewertung-poi-1");
    // Dieselbe Spalte, nach dem Bild.
    expect(bild.parentElement).toContainElement(bewertung);
    expect(bild).not.toContainElement(bewertung);
    expect(
      bild.compareDocumentPosition(bewertung) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(bewertung).toHaveTextContent("★ 4,7");
    expect(bewertung).toHaveTextContent("61k");
  });

  it("stellt die Buchung als Zeichen unter das Bild", () => {
    liste([poi({ id: "poi-1", name: "Hotel Luna", buchung: "gebucht" })]);

    const bild = screen.getByTestId("poi-bild-poi-1");
    expect(bild.parentElement).toContainElement(
      screen.getByTestId("poi-buchung-poi-1"),
    );
  });

  it("zeigt bei Buchung „nicht nötig“ kein Buchungszeichen", () => {
    liste([poi({ id: "poi-1", name: "Strand", buchung: "nicht_noetig" })]);

    expect(screen.queryByTestId("poi-buchung-poi-1")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /Buchung/ }),
    ).not.toBeInTheDocument();
  });

  it("stellt den Ort vor den Kurztext", () => {
    liste([
      poi({
        id: "poi-1",
        name: "Guggenheim",
        ort: "Bilbao",
        shortText: "Gehrys Titanschiff am Nervión.",
      }),
    ]);

    const ort = screen.getByTestId("poi-ort-poi-1");
    const text = screen.getByTestId("poi-kurztext-poi-1");
    expect(ort).toHaveTextContent("Bilbao");
    expect(ort.className).toMatch(/_ort_/);
    expect(ort.parentElement).toBe(text.parentElement);
    expect(
      ort.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("baut eine Zeile ohne Kurztext genauso auf wie eine mit", () => {
    // Die Höhe selbst ist fest (.rowTop, poi-list.layout.test.ts) -- hier
    // steht nur, dass dieselben Plätze da sind.
    liste([
      poi({ id: "poi-1", name: "Mit", shortText: "Ein Text." }),
      poi({ id: "poi-2", name: "Ohne" }),
    ]);

    function plaetze(id: string) {
      return Array.from(
        screen.getByTestId(`poi-row-${id}`).firstElementChild!.children,
      ).map((spalte) => spalte.className);
    }
    expect(plaetze("poi-2")).toEqual(plaetze("poi-1"));
    expect(screen.queryByTestId("poi-kurztext-poi-2")).not.toBeInTheDocument();
  });

  it("lässt einen sehr langen Kurztext ganz im Dokument und kürzt nur die Anzeige", () => {
    const lang = "Sehr lang. ".repeat(18).trim();
    liste([poi({ id: "poi-1", name: "Lang", shortText: lang })]);

    const text = screen.getByTestId("poi-kurztext-poi-1");
    expect(text).toHaveTextContent(lang);
    // Gekürzt wird im Blatt, an diesem Behälter.
    expect(text.parentElement!.className).toMatch(/_kurztext_/);
  });

  it("zeigt genau zwei Wege -- Webseite und Karte", () => {
    liste([
      poi({ id: "poi-1", name: "Guggenheim", web: "https://guggenheim.eus" }),
    ]);

    const wege = within(screen.getByTestId("poi-row-poi-1")).getAllByRole(
      "link",
    );
    expect(wege.map((weg) => weg.getAttribute("aria-label"))).toEqual([
      "Webseite",
      "Auf der Karte",
    ]);
    expect(wege[0]).toHaveAttribute("href", "https://guggenheim.eus");
    expect(
      screen.queryByRole("link", { name: "Google" }),
    ).not.toBeInTheDocument();
  });

  it("macht ohne Webseite aus dem ersten Weg sichtbar die Google-Suche", () => {
    liste([poi({ id: "poi-1", name: "Puente colgante", ort: "Portugalete" })]);

    const weg = screen.getByTestId("poi-webseite-poi-1");
    expect(weg).toHaveAccessibleName("Bei Google suchen");
    expect(weg.className).toMatch(/wegSuche/);
    const ziel = new URL(weg.getAttribute("href") ?? "");
    expect(ziel.hostname).toBe("www.google.com");
    expect(ziel.searchParams.get("q")).toContain("Puente colgante Portugalete");
    // Dieselbe Stelle wie die Webseite: erster der beiden Wege.
    expect(
      within(screen.getByTestId("poi-row-poi-1")).getAllByRole("link")[0],
    ).toBe(weg);
  });

  it("trägt kein Farbband am linken Rand", () => {
    liste([poi({ id: "poi-1", name: "Guggenheim", status: "gesetzt" })]);

    expect(
      screen.queryByTestId("poi-status-dot-poi-1"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("poi-row-poi-1").style.borderLeft).toBe("");
  });

  it("gibt der Statuspille bei „Warteliste“ die Farbe dieses Status", () => {
    liste([poi({ id: "poi-1", name: "Playa", status: "wenn_zeit" })]);

    const pille = screen.getByRole("combobox", { name: "Status von Playa" });
    expect(pille).toHaveDisplayValue("Warteliste");
    expect(pille.className).toMatch(/statusSelect/);
    expect(
      screen.getByTestId("poi-row-poi-1").style.getPropertyValue("--status"),
    ).toBe(POI_STATUS_COLOR.wenn_zeit);
  });

  it("zeigt die Gegend als Kürzel und den Namen beim Überfahren", () => {
    liste([
      poi({
        id: "poi-1",
        name: "La Concha",
        gegend: "San Sebastián",
        gegendKuerzel: "SSE",
      }),
    ]);

    const gegend = screen.getByTestId("poi-gegend-poi-1");
    expect(gegend).toHaveTextContent(/^SSE$/);
    expect(gegend).toHaveAttribute("title", "San Sebastián");
  });

  it("zeigt ohne Gegend „—“", () => {
    liste([poi({ id: "poi-1", name: "La Concha" })]);

    expect(screen.getByTestId("poi-gegend-poi-1")).toHaveTextContent(/^—$/);
  });
});

/**
 * Auswählen ohne Kästchen je Zeile (req-097): das Ankreuzfeld kostete 44 px
 * in jeder Zeile, dauerhaft, für eine Handlung, die selten vorkommt. Es
 * erscheint erst auf „Auswählen“; die Funktionen dahinter -- Status für
 * mehrere (req-069), mehrere aussortieren (req-057) -- bleiben.
 */
describe("PoiList — Auswahlmodus (req-097)", () => {
  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    render(
      <PoiListe
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

  it("zeigt im Normalfall kein Ankreuzfeld in den Zeilen", () => {
    liste();

    for (const zeile of screen.getAllByTestId(/^poi-row-/)) {
      expect(within(zeile).queryByRole("checkbox")).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("gibt nach „Auswählen“ jeder Zeile ein Ankreuzfeld und den Kopf seine Aktionen", async () => {
    const user = userEvent.setup();
    liste();

    await user.click(screen.getByRole("button", { name: "Auswählen" }));

    for (const zeile of screen.getAllByTestId(/^poi-row-/)) {
      expect(within(zeile).getByRole("checkbox")).toBeInTheDocument();
    }
    const kopf = within(screen.getByTestId("poi-filterzeile"));
    expect(
      kopf.getByRole("combobox", { name: "Status für Ausgewählte setzen" }),
    ).toHaveDisplayValue("Status…");
    expect(
      kopf.getByRole("button", { name: /^Entfernen/ }),
    ).toBeInTheDocument();
    expect(kopf.getByRole("button", { name: "Fertig" })).toBeInTheDocument();
  });

  it("setzt den Status für zwei angekreuzte POIs auf beide (req-069)", async () => {
    const user = userEvent.setup();
    const onStatusChangeFuerMehrere = vi.fn();
    liste({ onStatusChangeFuerMehrere });

    await user.click(screen.getByRole("button", { name: "Auswählen" }));
    await user.click(screen.getByLabelText("POI 2 auswählen"));
    await user.click(screen.getByLabelText("POI 4 auswählen"));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status für Ausgewählte setzen" }),
      "Warteliste",
    );

    expect(onStatusChangeFuerMehrere).toHaveBeenCalledWith(
      ["poi-2", "poi-4"],
      "wenn_zeit",
    );
  });

  it("macht die ganze Zeile zum Tippziel", async () => {
    const user = userEvent.setup();
    liste();

    await user.click(screen.getByRole("button", { name: "Auswählen" }));
    // Auf den Titel getippt: angekreuzt statt aufgeklappt.
    await user.click(screen.getByTestId("poi-name-poi-3"));

    expect(screen.getByLabelText("POI 3 auswählen")).toBeChecked();
    expect(screen.queryByTestId("poi-form-poi-3")).not.toBeInTheDocument();
    expect(screen.getByTestId("poi-row-poi-3").className).toMatch(
      /rowAusgewaehlt/,
    );

    // Ein zweiter Tipp auf die Zeile nimmt das Kreuz wieder weg.
    await user.click(screen.getByTestId("poi-gegend-poi-3"));
    expect(screen.getByLabelText("POI 3 auswählen")).not.toBeChecked();
  });

  it("kreuzt beim Tipp auf das Kästchen genau einmal an", async () => {
    const user = userEvent.setup();
    liste();

    await user.click(screen.getByRole("button", { name: "Auswählen" }));
    await user.click(screen.getByLabelText("POI 5 auswählen"));

    expect(screen.getByLabelText("POI 5 auswählen")).toBeChecked();
  });

  it("lässt die Wege und den Status der Zeile im Auswahlmodus das Ihre tun", async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    liste({ onStatusChange });

    await user.click(screen.getByRole("button", { name: "Auswählen" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status von POI 1" }),
      "Nein",
    );

    expect(onStatusChange).toHaveBeenCalledWith("poi-1", "auf_keinen_fall");
    expect(screen.getByLabelText("POI 1 auswählen")).not.toBeChecked();
  });

  it("beendet mit „Fertig“ den Modus samt Auswahl", async () => {
    const user = userEvent.setup();
    liste();

    await user.click(screen.getByRole("button", { name: "Auswählen" }));
    await user.click(screen.getByLabelText("POI 0 auswählen"));
    await user.click(screen.getByRole("button", { name: "Fertig" }));

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Auswählen" }));
    expect(screen.getByLabelText("POI 0 auswählen")).not.toBeChecked();
  });

  it("klappt ausserhalb des Auswahlmodus weiter das Formular auf", async () => {
    const user = userEvent.setup();
    liste();

    await user.click(screen.getByTestId("poi-name-poi-3"));

    expect(screen.getByTestId("poi-form-poi-3")).toBeInTheDocument();
  });
});

/**
 * Der Kopf der Liste (req-098): drei Zustände, von denen immer nur einer
 * sichtbar ist -- Ruhe, Filter offen, Auswahl. Je Feld mehrere Werte,
 * innerhalb eines Feldes „oder", zwischen den Feldern „und".
 */
describe("PoiList — Filter, Suche und Kopf (req-098)", () => {
  const SAMMLUNG: Poi[] = [
    poi({
      id: "gugg",
      number: 1,
      name: "Guggenheim-Museum",
      ort: "Bilbao",
      gegend: "BIO",
      type: "weltkulturerbe",
      status: "gesetzt",
    }),
    poi({
      id: "merc",
      number: 2,
      name: "Mercado de la Ribera",
      ort: "Bilbao",
      gegend: "BIO",
      type: "restaurant",
      status: "wahrscheinlich",
    }),
    poi({
      id: "puen",
      number: 3,
      name: "Puente colgante",
      ort: "Portugalete",
      type: "sehenswuerdigkeit",
      status: "weiss_nicht",
    }),
    poi({
      id: "conc",
      number: 4,
      name: "Playa de la Concha",
      ort: "San Sebastián",
      gegend: "SSE",
      type: "strand",
      status: "gesetzt",
    }),
    poi({
      id: "carl",
      number: 5,
      name: "Hotel Carlton",
      ort: "Bilbao",
      gegend: "BIO",
      type: "hotel",
      status: "auf_keinen_fall",
    }),
    poi({
      id: "rioj",
      number: 6,
      name: "Bodega Ysios",
      ort: "Laguardia",
      gegend: "RIO",
      type: "aktivitaet",
      status: "wenn_zeit",
    }),
  ];

  function liste(props: Partial<ComponentProps<typeof PoiList>> = {}) {
    render(
      <PoiListe
        pois={SAMMLUNG}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
        {...props}
      />,
    );
  }

  function kopf() {
    return within(screen.getByTestId("poi-filterzeile"));
  }

  /** Die Kennungen der Zeilen, die die Liste gerade zeigt. */
  function gezeigt(): string[] {
    return screen
      .queryAllByTestId(/^poi-row-/)
      .map((zeile) => zeile.dataset.testid!.replace("poi-row-", ""));
  }

  it("zeigt im Ruhezustand genau vier Griffe: Suchen, Filter, Sortieren, Auswählen", () => {
    liste();

    expect(
      kopf().getByRole("searchbox", { name: "POIs durchsuchen" }),
    ).toBeInTheDocument();
    expect(
      kopf()
        .getAllByRole("button")
        .map((knopf) => knopf.getAttribute("aria-label")),
    ).toEqual(["Filter", "Sortieren", "Auswählen"]);
  });

  it("zeigt im Ruhezustand kein Auswahlfeld für Typ, Status oder Sortierung", () => {
    liste();

    expect(kopf().queryByRole("combobox")).not.toBeInTheDocument();
    expect(kopf().queryByText("Typ")).not.toBeInTheDocument();
    expect(kopf().queryByText("Status")).not.toBeInTheDocument();
    expect(kopf().queryByText("Sortieren")).not.toBeInTheDocument();
  });

  it("öffnet mit „Filter“ ein Blatt mit Status, Gegend und Typ", () => {
    liste();

    fireEvent.click(kopf().getByRole("button", { name: "Filter" }));

    const blatt = within(screen.getByTestId("poi-filterblatt"));
    expect(
      blatt
        .getAllByRole("group")
        .map((feld) => feld.getAttribute("aria-label")),
    ).toEqual(["Status", "Gegend", "Typ"]);
    expect(kopf().getByRole("button", { name: "Filter" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("zeigt bei „Fix“ und „Alternative“ die POIs beider Status", () => {
    liste();

    filterWaehlen("Status", "Fix");
    filterWaehlen("Status", "Alternative");

    expect(gezeigt()).toEqual(["gugg", "merc", "conc"]);
  });

  it("zeigt bei Status „Fix“ und Gegend „BIO“ nur, was beides erfüllt", () => {
    liste();

    filterWaehlen("Status", "Fix");
    filterWaehlen("Gegend", "BIO");

    expect(gezeigt()).toEqual(["gugg"]);
  });

  it("filtert in einem Feld ohne Wahl nicht", () => {
    liste();

    filterWaehlen("Gegend", "BIO");

    // Status und Typ sind leer: jeder Status, jeder Typ der Gegend BIO.
    expect(gezeigt()).toEqual(["gugg", "merc", "carl"]);
  });

  it("nennt am Filter-Knopf die Zahl der gesetzten Filter", () => {
    liste();

    expect(screen.queryByTestId("poi-filter-zahl")).not.toBeInTheDocument();
    filterWaehlen("Status", "Fix");
    filterWaehlen("Status", "Alternative");
    filterWaehlen("Gegend", "BIO");

    expect(
      within(kopf().getByRole("button", { name: "Filter" })).getByText("2"),
    ).toBeInTheDocument();
  });

  it("stellt zugeklappt die gesetzten Filter als Chips unter den Titel", () => {
    liste();

    filterWaehlen("Status", "Fix");
    filterWaehlen("Gegend", "BIO");
    // Offen steht das Blatt -- die Chips kämen doppelt.
    expect(screen.queryByTestId("poi-filter-chips")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));

    const chips = within(screen.getByTestId("poi-filter-chips"));
    expect(
      chips.getByRole("button", { name: "Filter „Fix“ entfernen" }),
    ).toBeInTheDocument();
    expect(
      chips.getByRole("button", { name: "Filter „BIO“ entfernen" }),
    ).toBeInTheDocument();
    expect(
      chips.getByRole("button", { name: "zurücksetzen" }),
    ).toBeInTheDocument();
  });

  it("nimmt mit dem Kreuz eines Chips nur diesen Filter weg", () => {
    liste();

    filterWaehlen("Status", "Fix");
    filterWaehlen("Gegend", "BIO");
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Filter „Fix“ entfernen" }),
    );

    expect(
      screen.queryByRole("button", { name: "Filter „Fix“ entfernen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Filter „BIO“ entfernen" }),
    ).toBeInTheDocument();
    expect(gezeigt()).toEqual(["gugg", "merc", "carl"]);
  });

  it("nimmt mit „zurücksetzen“ alle Filter weg", () => {
    liste();

    filterWaehlen("Status", "Fix");
    filterWaehlen("Typ", "Strand");
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    fireEvent.click(screen.getByRole("button", { name: "zurücksetzen" }));

    expect(gezeigt()).toHaveLength(6);
    expect(screen.queryByTestId("poi-filter-chips")).not.toBeInTheDocument();
  });

  it("nennt im Titel „x von y“, sobald etwas eingrenzt", () => {
    liste();

    expect(screen.getByTestId("poi-zaehler")).toHaveTextContent(/^6$/);
    filterWaehlen("Gegend", "BIO");
    expect(screen.getByTestId("poi-zaehler")).toHaveTextContent("3 von 6");
  });

  it("erklärt eine leere Liste mit den gesetzten Filtern und bietet das Zurücksetzen an", () => {
    liste();

    filterWaehlen("Status", "Nein");
    filterWaehlen("Gegend", "RIO");

    expect(gezeigt()).toEqual([]);
    const meldung = within(screen.getByTestId("poi-leermeldung"));
    expect(
      meldung.getByText(
        "Status „Nein“ und Gegend „RIO“ kommen zusammen nicht vor.",
        { exact: false },
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      meldung.getByRole("button", { name: "Filter zurücksetzen" }),
    );
    expect(gezeigt()).toHaveLength(6);
  });

  it("gibt jedem Typ im Blatt seinen Farbpunkt -- auch den nicht gewählten", () => {
    liste();

    filterWaehlen("Typ", "Hotel");

    const typen = within(screen.getByRole("group", { name: "Typ" }));
    const pillen = typen.getAllByRole("button");
    expect(pillen).toHaveLength(7);
    for (const pille of pillen) {
      expect(within(pille).getByTestId("pillen-punkt")).toBeInTheDocument();
    }
    expect(typen.getByRole("button", { name: "Restaurant" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      typen
        .getByRole("button", { name: "Restaurant" })
        .style.getPropertyValue("--c"),
    ).toBe(POI_TYPE_COLOR.restaurant);
    // Der Status trägt seinen Punkt ebenso, in der Farbe der Zeile.
    const fix = within(screen.getByRole("group", { name: "Status" })).getByRole(
      "button",
      { name: "Fix" },
    );
    expect(within(fix).getByTestId("pillen-punkt")).toBeInTheDocument();
    expect(fix.style.getPropertyValue("--c")).toBe(POI_STATUS_COLOR.gesetzt);
  });

  it("findet beim Tippen von „Gugg“ das Guggenheim-Museum", () => {
    liste();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Gugg" },
    });

    expect(gezeigt()).toEqual(["gugg"]);
  });

  it("findet beim Tippen von „Bilbao“ die POIs dieses Orts", () => {
    liste();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Bilbao" },
    });

    expect(gezeigt()).toEqual(["gugg", "merc", "carl"]);
  });

  it("lässt Suche und Filter zusammen wirken", () => {
    liste();

    filterWaehlen("Status", "Fix");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Bilbao" },
    });

    expect(gezeigt()).toEqual(["gugg"]);
    expect(screen.getByTestId("poi-zaehler")).toHaveTextContent("1 von 6");
  });

  it("zeigt nach „Auswählen“ Status…, Gegend…, Entfernen und Fertig -- und keinen Filter", () => {
    liste();

    auswahlStarten();

    expect(kopf().getByText("Status…", { selector: "span" })).toBeVisible();
    expect(kopf().getByText("Gegend…", { selector: "span" })).toBeVisible();
    expect(
      kopf().getByRole("combobox", { name: "Status für Ausgewählte setzen" }),
    ).toBeInTheDocument();
    expect(
      kopf().getByRole("combobox", { name: "Gegend für Ausgewählte setzen" }),
    ).toBeInTheDocument();
    expect(
      kopf().getByRole("button", { name: /^Entfernen/ }),
    ).toBeInTheDocument();
    expect(kopf().getByRole("button", { name: "Fertig" })).toBeInTheDocument();
    expect(
      kopf().queryByRole("button", { name: "Filter" }),
    ).not.toBeInTheDocument();
    expect(kopf().queryByRole("searchbox")).not.toBeInTheDocument();
    expect(
      kopf().queryByRole("button", { name: "Sortieren" }),
    ).not.toBeInTheDocument();
  });

  it("nennt am Entfernen die Zahl der angekreuzten POIs", () => {
    liste();

    auswahlStarten();
    for (const name of ["Guggenheim-Museum", "Hotel Carlton", "Bodega Ysios"]) {
      fireEvent.click(screen.getByLabelText(`${name} auswählen`));
    }

    expect(
      within(kopf().getByRole("button", { name: /^Entfernen/ })).getByText("3"),
    ).toBeInTheDocument();
  });

  it("meldet für sechs angekreuzte POIs „Gegend… BIO“ alle sechs", () => {
    const onGegendFuerMehrere = vi.fn();
    liste({ onGegendFuerMehrere });

    auswahlStarten();
    fireEvent.click(screen.getByLabelText("Alle POIs auswählen"));
    const gegend = kopf().getByRole("combobox", {
      name: "Gegend für Ausgewählte setzen",
    });
    // Zur Wahl stehen die Gegenden der Reise und „Keine Gegend".
    expect(
      within(gegend)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Gegend…", "BIO", "RIO", "SSE", "Keine Gegend"]);
    fireEvent.change(gegend, { target: { value: "BIO" } });

    expect(onGegendFuerMehrere).toHaveBeenCalledWith(
      ["gugg", "merc", "puen", "conc", "carl", "rioj"],
      "BIO",
    );
    // Die Liste fällt auf ihre Beschriftung zurück, die Auswahl bleibt.
    expect(gegend).toHaveValue("");
    expect(screen.getByText("6 gewählt")).toBeInTheDocument();
  });

  it("ist bei „Gegend…“ ohne Auswahl nicht auslösbar", () => {
    liste();

    auswahlStarten();

    expect(
      kopf().getByRole("combobox", { name: "Gegend für Ausgewählte setzen" }),
    ).toBeDisabled();
  });

  it("leert mit „Fertig“ die Auswahl und zeigt wieder die vier Griffe", () => {
    liste();

    auswahlStarten();
    fireEvent.click(screen.getByLabelText("Bodega Ysios auswählen"));
    fireEvent.click(kopf().getByRole("button", { name: "Fertig" }));
    auswahlStarten();

    expect(screen.getByLabelText("Bodega Ysios auswählen")).not.toBeChecked();
    expect(screen.getByText("0 gewählt")).toBeInTheDocument();
  });

  it("zeigt den Kopf nach „Fertig“ wieder mit seinen vier Griffen", () => {
    liste();

    auswahlStarten();
    expect(kopf().queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(kopf().getByRole("button", { name: "Fertig" }));

    expect(kopf().getByRole("searchbox")).toBeInTheDocument();
    expect(
      kopf()
        .getAllByRole("button")
        .map((knopf) => knopf.getAttribute("aria-label")),
    ).toEqual(["Filter", "Sortieren", "Auswählen"]);
  });
});

/**
 * Die Liste rollt in den Farben der App (req-097) -- über das gemeinsame
 * Blatt aus bug-041, das sie bis dahin nicht nutzte. Die Farben selbst prüft
 * poi-list.layout.test.ts.
 */
describe("PoiList — Bildlaufleiste (req-097)", () => {
  it("gibt dem Bildlaufbereich das gemeinsame Blatt", () => {
    render(
      <PoiListe
        pois={twelvePois()}
        highlightedPoiId={null}
        onStatusChange={() => {}}
        tripId="trip-1"
        hasSearchArea={true}
        onPoisAdded={() => {}}
      />,
    );

    expect(screen.getByTestId("poi-scrollbereich").className).toMatch(
      /bildlauf/,
    );
  });
});
