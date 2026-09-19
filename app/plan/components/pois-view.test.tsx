import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoisView } from "./pois-view";
import { MapLibreMap } from "@/tests/mocks/maplibre-gl";
import type { Poi, PoiPosition } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import { DEFAULT_MAP_VISIBLE_STATUSES } from "@/lib/pois/status-meta";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const TRIP_ID = "trip-1";
const MAIN_PLACE = { name: "Amalfi", lat: 40.6333, lng: 14.6027 };

function poi(overrides: Partial<Poi> & { id: string; name: string }): Poi {
  return {
    tripId: TRIP_ID,
    number: 1,
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6491, lng: 14.6113 },
    status: "weiss_nicht",
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: TRIP_ID,
    type: "sehenswuerdigkeit",
    title: "Gärten der Villa Rufolo",
    shortText: "",
    longText: "",
    startAt: "2026-05-01T10:00",
    endAt: "2026-05-01T12:00",
    ...overrides,
  };
}

/**
 * Die POI-Liste liegt seit bug-020 in PlanView, das Suchgebiet seit bug-030
 * -- PoisView bekommt beides und meldet Aenderungen nach oben. Der Rahmen
 * hier haelt sie an PlanViews Stelle, damit die Tests dieselben Ablaeufe
 * pruefen wie zuvor.
 */
function PoisViewHarness({
  pois: initialPois,
  activities,
}: {
  pois: Poi[];
  activities: Activity[];
}) {
  const [pois, setPois] = useState(initialPois);
  const [searchArea, setSearchArea] = useState<PoiPosition[] | null>(null);

  return (
    <PoisView
      pois={pois}
      activities={activities}
      mainPlace={MAIN_PLACE}
      windowWidth={1600}
      tripId={TRIP_ID}
      searchArea={searchArea}
      onSearchAreaChanged={(_tripId, points) => setSearchArea(points)}
      visibleMapStatuses={DEFAULT_MAP_VISIBLE_STATUSES}
      onToggleMapStatus={() => {}}
      onPoisChanged={(saved) =>
        setPois((current) => {
          const neu = new Map(saved.map((poi) => [poi.id, poi]));
          const ersetzt = current.map((poi) => neu.get(poi.id) ?? poi);
          for (const poi of current) neu.delete(poi.id);
          return [...ersetzt, ...neu.values()];
        })
      }
      onPoiRemoved={(removed) =>
        setPois((current) => current.filter((poi) => poi.id !== removed.id))
      }
    />
  );
}

function renderView(pois: Poi[], activities: Activity[] = []) {
  return render(<PoisViewHarness pois={pois} activities={activities} />);
}

/** Der Schalter „Position auf der Karte setzen“ eines Formulars (req-044). */
function schalter(form: HTMLElement) {
  return within(form).getByRole("button", {
    name: "Position auf der Karte setzen",
  });
}

/** Wartet den Frame ab, nach dem die Karte ihre Groesse kennt. */
async function flushMapReady() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function antwortet(payload: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => payload }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  MapLibreMap.instances.length = 0;
});

/**
 * Filter und Sortierung der Liste wirken seit req-060 allein auf die Liste
 * — die Karte daneben behält ihre eigene Statusauswahl (req-013).
 */
describe("PoisView — der Filter der Liste und die Karte (req-060)", () => {
  const restaurant = poi({
    id: "poi-1",
    name: "Da Vincenzo",
    type: "restaurant",
    status: "gesetzt",
  });
  const dom = poi({
    id: "poi-2",
    name: "Dom von Ravello",
    number: 2,
    status: "gesetzt",
  });

  /** Welche Status die Karte gerade zeigt. */
  function kartenStatus(): string[] {
    return screen
      .getAllByRole("switch")
      .filter((schalter) => (schalter as HTMLInputElement).checked)
      .map((schalter) => schalter.getAttribute("aria-label") ?? "");
  }

  it("ändert die Statusauswahl der Karte nicht", async () => {
    const user = userEvent.setup();
    renderView([restaurant, dom]);
    await flushMapReady();
    const vorher = kartenStatus();

    await user.selectOptions(
      screen.getByLabelText("Nach Typ filtern"),
      "Restaurant",
    );

    expect(kartenStatus()).toEqual(vorher);
  });

  it("lässt die POIs anderer Typen auf der Karte stehen", async () => {
    const user = userEvent.setup();
    renderView([restaurant, dom]);
    await flushMapReady();

    await user.selectOptions(
      screen.getByLabelText("Nach Typ filtern"),
      "Restaurant",
    );

    // In der Liste steht nur noch das Restaurant ...
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    // ... auf der Karte aber weiterhin beide.
    expect(screen.getByTestId("poi-marker-number-poi-1")).toBeInTheDocument();
    expect(screen.getByTestId("poi-marker-number-poi-2")).toBeInTheDocument();
  });
});

describe("PoisView — POI anlegen (req-035)", () => {
  it('öffnet ein leeres Formular beim Klick auf "POI anlegen"', async () => {
    const user = userEvent.setup();
    renderView([]);

    await user.click(screen.getByRole("button", { name: "POI anlegen" }));

    const form = screen.getByTestId("poi-form-neu");
    expect(within(form).getByLabelText("Name")).toHaveValue("");
    expect(within(form).getByLabelText("Ort")).toHaveValue("");
    expect(within(form).getByTestId("poi-form-position")).toHaveTextContent(
      "Noch keine Position",
    );
  });

  it('hält "Position auf der Karte setzen" beim Öffnen aus (req-044)', async () => {
    const user = userEvent.setup();
    renderView([]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "POI anlegen" }));

    expect(schalter(screen.getByTestId("poi-form-neu"))).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.queryByTestId("poi-map-position-modus"),
    ).not.toBeInTheDocument();
  });

  it("übernimmt beim Klick auf die Karte die angeklickte Position", async () => {
    const user = userEvent.setup();
    renderView([]);
    await flushMapReady();
    await user.click(screen.getByRole("button", { name: "POI anlegen" }));

    // Erst der Schalter macht den Kartenklick wirksam (req-044).
    await user.click(schalter(screen.getByTestId("poi-form-neu")));
    expect(screen.getByTestId("poi-map-position-modus")).toBeInTheDocument();
    await act(async () => {
      MapLibreMap.live().simulateClick([14.5289, 40.6117]);
    });

    expect(screen.getByTestId("poi-form-position")).toHaveTextContent(
      "40.61170, 14.52890",
    );
    // Mit der gesetzten Position endet der Modus wieder.
    expect(
      screen.queryByTestId("poi-map-position-modus"),
    ).not.toBeInTheDocument();
  });

  it("zeigt den angelegten POI in der Liste", async () => {
    const user = userEvent.setup();
    antwortet({
      poi: poi({
        id: "poi-neu",
        name: "Bucht bei Praiano",
        ort: "Praiano",
        type: "strand",
        number: 13,
      }),
    });
    renderView([]);
    await user.click(screen.getByRole("button", { name: "POI anlegen" }));
    const form = screen.getByTestId("poi-form-neu");

    await user.type(within(form).getByLabelText("Name"), "Bucht bei Praiano");
    await user.click(schalter(form));
    await act(async () => {
      MapLibreMap.live().simulateClick([14.5289, 40.6117]);
    });
    await user.click(within(form).getByRole("button", { name: "Speichern" }));

    expect(
      screen.getByRole("button", { name: "Bucht bei Praiano" }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("poi-form-neu")).not.toBeInTheDocument();
  });

  it("legt ohne Namen keinen POI an", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet({});
    renderView([]);
    await user.click(screen.getByRole("button", { name: "POI anlegen" }));
    const form = screen.getByTestId("poi-form-neu");

    await user.type(within(form).getByLabelText("Ort"), "Praiano");
    await user.click(within(form).getByRole("button", { name: "Speichern" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("poi-form-neu")).toBeInTheDocument();
  });
});

describe("PoisView — POI ändern (req-035)", () => {
  const villa = poi({ id: "poi-1", name: "Villa Rufolo", number: 4 });

  it("zeigt beim Klick auf die Zeile ein Formular mit seinen Angaben", async () => {
    const user = userEvent.setup();
    renderView([villa]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    const form = screen.getByTestId("poi-form-poi-1");
    expect(within(form).getByLabelText("Name")).toHaveValue("Villa Rufolo");
    expect(within(form).getByLabelText("Ort")).toHaveValue("Ravello");
  });

  it("übernimmt den geänderten Namen in die Liste", async () => {
    const user = userEvent.setup();
    antwortet({ poi: { ...villa, name: "Villa Rufolo (Garten)" } });
    renderView([villa]);
    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    const form = screen.getByTestId("poi-form-poi-1");

    await user.clear(within(form).getByLabelText("Name"));
    await user.type(
      within(form).getByLabelText("Name"),
      "Villa Rufolo (Garten)",
    );
    await user.click(within(form).getByRole("button", { name: "Speichern" }));

    expect(
      screen.getByRole("button", { name: "Villa Rufolo (Garten)" }),
    ).toBeInTheDocument();
  });

  it("zeigt das nach vorn gerückte Bild in der POI-Zeile", async () => {
    const user = userEvent.setup();
    antwortet({
      photos: [
        { id: "foto-2", position: 1 },
        { id: "foto-1", position: 2 },
      ],
    });
    renderView([
      poi({
        ...villa,
        photos: [
          { id: "foto-1", position: 1 },
          { id: "foto-2", position: 2 },
        ],
      }),
    ]);
    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    await user.click(screen.getByRole("button", { name: "Bild 2 nach vorn" }));

    expect(
      screen.getByRole("img", { name: "Foto von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-2");
  });

  it("zeigt die Nummer, bietet sie aber nicht zum Ändern an (req-013)", async () => {
    const user = userEvent.setup();
    renderView([villa]);

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    const form = screen.getByTestId("poi-form-poi-1");
    expect(within(form).getByTestId("poi-form-number")).toHaveTextContent("#4");
    expect(within(form).queryByLabelText("Nummer")).not.toBeInTheDocument();
  });
});

describe("PoisView — Position per Kartenklick (req-044, löst bug-015 ab)", () => {
  const villa = poi({ id: "poi-1", name: "Villa Rufolo", number: 4 });
  const bucht = poi({
    id: "poi-2",
    name: "Bucht bei Praiano",
    number: 5,
    position: { lat: 40.6117, lng: 14.5289 },
  });

  it("ist beim Öffnen des Formulars ausgeschaltet", async () => {
    const user = userEvent.setup();
    renderView([villa]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    expect(schalter(screen.getByTestId("poi-form-poi-1"))).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.queryByTestId("poi-map-position-modus"),
    ).not.toBeInTheDocument();
  });

  it("lässt die Position beim Kartenklick unverändert, solange er aus ist", async () => {
    const user = userEvent.setup();
    renderView([villa]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await act(async () => {
      MapLibreMap.live().simulateClick([14.5289, 40.6117]);
    });

    const form = screen.getByTestId("poi-form-poi-1");
    expect(within(form).getByTestId("poi-form-position")).toHaveTextContent(
      "40.64910, 14.61130",
    );
  });

  it("übernimmt den Kartenklick, wenn der Schalter eingeschaltet ist", async () => {
    const user = userEvent.setup();
    renderView([villa]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await user.click(schalter(screen.getByTestId("poi-form-poi-1")));
    await act(async () => {
      MapLibreMap.live().simulateClick([14.5289, 40.6117]);
    });

    const form = screen.getByTestId("poi-form-poi-1");
    expect(within(form).getByTestId("poi-form-position")).toHaveTextContent(
      "40.61170, 14.52890",
    );
  });

  it("schaltet sich nach dem gesetzten Klick wieder aus", async () => {
    const user = userEvent.setup();
    renderView([villa]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await user.click(schalter(screen.getByTestId("poi-form-poi-1")));
    await act(async () => {
      MapLibreMap.live().simulateClick([14.5289, 40.6117]);
    });

    expect(schalter(screen.getByTestId("poi-form-poi-1"))).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.queryByTestId("poi-map-position-modus"),
    ).not.toBeInTheDocument();
  });

  it("nennt auf der Karte den POI, dessen Position gesetzt wird", async () => {
    const user = userEvent.setup();
    renderView([villa]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await user.click(schalter(screen.getByTestId("poi-form-poi-1")));

    expect(screen.getByTestId("poi-map-position-modus")).toHaveTextContent(
      "Villa Rufolo",
    );
  });

  it("gibt den Klick dem Formular, dessen Schalter zuletzt an ging", async () => {
    const user = userEvent.setup();
    renderView([villa, bucht]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await user.click(screen.getByRole("button", { name: "Bucht bei Praiano" }));
    await user.click(schalter(screen.getByTestId("poi-form-poi-1")));
    await user.click(schalter(screen.getByTestId("poi-form-poi-2")));
    await act(async () => {
      MapLibreMap.live().simulateClick([14.4989, 40.6402]);
    });

    expect(
      within(screen.getByTestId("poi-form-poi-2")).getByTestId(
        "poi-form-position",
      ),
    ).toHaveTextContent("40.64020, 14.49890");
    // Das andere Formular bleibt unberührt -- ein Klick gehört genau einem.
    expect(
      within(screen.getByTestId("poi-form-poi-1")).getByTestId(
        "poi-form-position",
      ),
    ).toHaveTextContent("40.64910, 14.61130");
  });

  it("wartet nach dem Schließen des Formulars nicht mehr auf einen Klick", async () => {
    const user = userEvent.setup();
    renderView([villa]);
    await flushMapReady();

    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await user.click(schalter(screen.getByTestId("poi-form-poi-1")));
    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));

    expect(
      screen.queryByTestId("poi-map-position-modus"),
    ).not.toBeInTheDocument();
  });

  it("lässt bei offenem Formular weiter ein Suchgebiet zeichnen", async () => {
    const user = userEvent.setup();
    renderView([villa]);
    await flushMapReady();
    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await user.click(schalter(screen.getByTestId("poi-form-poi-1")));

    await user.click(
      screen.getByRole("button", { name: "Suchgebiet zeichnen" }),
    );
    await act(async () => {
      MapLibreMap.live().simulateClick([14.5289, 40.6117]);
    });

    // Der Klick gehört dem Zeichnen, nicht dem Formular.
    expect(
      screen.queryByTestId("poi-map-position-modus"),
    ).not.toBeInTheDocument();
    const form = screen.getByTestId("poi-form-poi-1");
    expect(within(form).getByTestId("poi-form-position")).toHaveTextContent(
      "40.64910, 14.61130",
    );
    // Der erste Eckpunkt des Entwurfs ist der, an dem geschlossen wird.
    expect(
      screen.getByRole("button", { name: "Suchgebiet schließen" }),
    ).toBeInTheDocument();
  });
});

describe("PoisView — POI löschen (req-035)", () => {
  const villa = poi({ id: "poi-1", name: "Villa Rufolo", number: 4 });

  async function rueckfrageOeffnen(activities: Activity[] = []) {
    const user = userEvent.setup();
    renderView([villa], activities);
    await user.click(screen.getByRole("button", { name: "Villa Rufolo" }));
    await user.click(screen.getByRole("button", { name: "POI löschen" }));
    return user;
  }

  it("nennt in der Rückfrage den Namen des POI", async () => {
    await rueckfrageOeffnen();

    expect(
      screen.getByRole("alertdialog", { name: "POI entfernen" }),
    ).toHaveTextContent("Villa Rufolo");
  });

  it("weist nicht auf einen Programmpunkt hin, wenn der POI unverplant ist", async () => {
    await rueckfrageOeffnen();

    expect(screen.queryByTestId("poi-delete-verplant")).not.toBeInTheDocument();
  });

  it("weist auf einen zugeordneten Programmpunkt hin", async () => {
    await rueckfrageOeffnen([activity({ id: "act-1", poiId: "poi-1" })]);

    expect(screen.getByTestId("poi-delete-verplant")).toHaveTextContent(
      "Gärten der Villa Rufolo",
    );
  });

  it("entfernt den POI nach der Bestätigung aus der Liste", async () => {
    antwortet({ status: "ok" });
    const user = await rueckfrageOeffnen();

    await user.click(
      screen.getByRole("button", { name: "Endgültig entfernen" }),
    );

    expect(
      screen.queryByRole("button", { name: "Villa Rufolo" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * bug-021: Ein fehlgeschlagenes Speichern blieb still -- die Anzeige sah aus
 * wie nach einem erfolgreichen. Beim Status war das besonders tueckisch, weil
 * die Oberflaeche ihn sofort uebernahm und der Fehler bewusst verschluckt
 * wurde.
 */
/**
 * Der kurze Weg zum Entfernen (req-060): das Löschen-Symbol rechts in der
 * Box führt auf dieselbe Rückfrage wie „POI löschen" im Formular (req-035).
 */
describe("PoisView — Löschen-Symbol in der Box (req-060)", () => {
  const villa = poi({ id: "poi-1", name: "Villa Rufolo", number: 4 });

  async function symbolWaehlen(activities: Activity[] = []) {
    const user = userEvent.setup();
    renderView([villa], activities);
    await user.click(
      screen.getByRole("button", { name: "Villa Rufolo entfernen" }),
    );
    return user;
  }

  it("öffnet die Rückfrage, ohne das Formular aufzuklappen", async () => {
    await symbolWaehlen();

    expect(
      screen.getByRole("alertdialog", { name: "POI entfernen" }),
    ).toHaveTextContent("Villa Rufolo");
    expect(screen.queryByTestId("poi-form-poi-1")).not.toBeInTheDocument();
  });

  it("warnt in der Rückfrage, wenn der POI bereits verplant ist (req-035)", async () => {
    await symbolWaehlen([activity({ id: "act-1", poiId: "poi-1" })]);

    expect(screen.getByTestId("poi-delete-verplant")).toHaveTextContent(
      "Gärten der Villa Rufolo",
    );
  });

  it("entfernt den POI nach der Bestätigung aus der Liste", async () => {
    antwortet({ status: "ok" });
    const user = await symbolWaehlen();

    await user.click(
      screen.getByRole("button", { name: "Endgültig entfernen" }),
    );

    expect(
      screen.queryByRole("button", { name: "Villa Rufolo" }),
    ).not.toBeInTheDocument();
  });

  it("lässt den POI stehen, wenn ich die Rückfrage abbreche", async () => {
    const user = await symbolWaehlen();

    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Villa Rufolo" }),
    ).toBeInTheDocument();
  });
});

describe("PoisView — fehlgeschlagenes Speichern wird gemeldet (bug-021)", () => {
  async function statusSetzen(ok: boolean) {
    antwortet({}, ok);
    const user = userEvent.setup();
    render(
      <PoisViewHarness
        pois={[poi({ id: "poi-1", name: "Villa Rufolo" })]}
        activities={[]}
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
      "gesetzt",
    );
    return user;
  }

  it("meldet, wenn der Status nicht gespeichert werden konnte", async () => {
    await statusSetzen(false);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Der Status von „Villa Rufolo" konnte nicht gespeichert werden.',
    );
  });

  it("nimmt den Status zurueck, wenn nicht gespeichert werden konnte", async () => {
    await statusSetzen(false);

    await screen.findByRole("alert");
    expect(
      screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
    ).toHaveValue("weiss_nicht");
  });

  it("meldet nichts, wenn der Status gespeichert wurde", async () => {
    await statusSetzen(true);

    expect(
      screen.getByRole("combobox", { name: "Status von Villa Rufolo" }),
    ).toHaveValue("gesetzt");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

/**
 * Wer sich eine Ecke des Gebiets zurechtgezogen hat, will dort bleiben,
 * waehrend er die POIs durchgeht. Bis bug-048 zoomte und verschob sich die
 * Karte bei jedem gesetzten Status: die Karte zeigt nur POIs der
 * angekreuzten Status, mit dem neuen Status aenderte sich diese Liste --
 * und daran hing das Ruecken des Ausschnitts.
 */
describe("PoisView — der Kartenausschnitt beim Setzen eines Status (bug-048)", () => {
  /**
   * Zwei POIs mit einem Status, den die Karte zeigt
   * (DEFAULT_MAP_VISIBLE_STATUSES), also beide auf der Karte.
   */
  function sichtbarePois(): Poi[] {
    return [
      poi({ id: "poi-1", name: "Villa Rufolo", status: "gesetzt" }),
      poi({
        id: "poi-2",
        name: "Dom von Ravello",
        number: 2,
        status: "gesetzt",
        position: { lat: 40.8, lng: 14.4 },
      }),
    ];
  }

  async function setzeStatus(name: string, status: string) {
    await userEvent
      .setup()
      .selectOptions(
        screen.getByRole("combobox", { name: `Status von ${name}` }),
        status,
      );
  }

  it("laesst Zoom und Mitte stehen, wenn ein POI auf der Karte bleibt", async () => {
    antwortet({});
    renderView(sichtbarePois());
    await flushMapReady();
    const karte = MapLibreMap.instances.at(-1)!;
    // Der Nutzer hat sich eine Ecke des Gebiets zurechtgezogen.
    karte.setCenter([9.99, 53.55]);
    const vorher = karte.fitBoundsCalls.length;

    await setzeStatus("Villa Rufolo", "wahrscheinlich");

    expect(karte.fitBoundsCalls).toHaveLength(vorher);
    expect(karte.center).toEqual([9.99, 53.55]);
  });

  it("laesst Zoom und Mitte stehen, wenn der neue Status den POI von der Karte nimmt", async () => {
    antwortet({});
    renderView(sichtbarePois());
    await flushMapReady();
    const karte = MapLibreMap.instances.at(-1)!;
    karte.setCenter([9.99, 53.55]);
    const vorher = karte.fitBoundsCalls.length;

    // "Auf keinen Fall" gehoert nicht zu den angekreuzten Status: der POI
    // faellt von der Karte, die gefilterte Liste wird kuerzer.
    await setzeStatus("Villa Rufolo", "auf_keinen_fall");

    expect(
      screen.queryByTestId("poi-marker-number-poi-1"),
    ).not.toBeInTheDocument();
    expect(karte.fitBoundsCalls).toHaveLength(vorher);
    expect(karte.center).toEqual([9.99, 53.55]);
  });

  it("laesst Zoom und Mitte stehen, wenn der letzte POI von der Karte faellt", async () => {
    antwortet({});
    renderView([poi({ id: "poi-1", name: "Villa Rufolo", status: "gesetzt" })]);
    await flushMapReady();
    const karte = MapLibreMap.instances.at(-1)!;
    karte.setCenter([9.99, 53.55]);
    const vorher = karte.fitBoundsCalls.length;

    await setzeStatus("Villa Rufolo", "auf_keinen_fall");

    expect(karte.fitBoundsCalls).toHaveLength(vorher);
    // Ohne sichtbare POIs sprang die Karte zurueck in den Hauptort.
    expect(karte.center).toEqual([9.99, 53.55]);
  });
});

/**
 * Nach einer KI-Suche geht der Reiseleiter dreissig Treffer durch und
 * verwirft zwei Drittel davon. Mehrere POIs ankreuzen und gemeinsam
 * entfernen konnte er laengst (req-057) -- seit req-069 setzt er ihnen
 * genauso gemeinsam einen Status.
 */
describe("PoisView — Status für mehrere POIs (req-069)", () => {
  /** Zehn sichtbare POIs, die ersten drei mit verschiedenen Status. */
  function zehnPois(): Poi[] {
    const status = [
      "gesetzt",
      "wenn_zeit",
      "auf_keinen_fall",
    ] as const satisfies readonly Poi["status"][];
    return Array.from({ length: 10 }, (_, i) =>
      poi({
        id: `poi-${i}`,
        number: i + 1,
        name: `POI ${i}`,
        status: status[i] ?? "weiss_nicht",
      }),
    );
  }

  function gemeinsamerStatus() {
    return screen.getByRole("combobox", {
      name: "Status für Ausgewählte setzen",
    });
  }

  function statusVon(name: string) {
    return screen.getByRole("combobox", { name: `Status von ${name}` });
  }

  /** Die ersten drei POIs ankreuzen und ihnen gemeinsam einen Status geben. */
  async function dreiSetzen(status: string, ok = true) {
    const fetchMock = antwortet(
      { status: "ok", updatedIds: ["poi-0", "poi-1", "poi-2"] },
      ok,
    );
    const user = userEvent.setup();
    renderView(zehnPois());

    for (const i of [0, 1, 2]) {
      await user.click(screen.getByLabelText(`POI ${i} auswählen`));
    }
    await user.selectOptions(gemeinsamerStatus(), status);
    return { user, fetchMock };
  }

  it("gibt allen drei angekreuzten POIs den gewählten Status", async () => {
    await dreiSetzen("wahrscheinlich");

    for (const i of [0, 1, 2]) {
      expect(statusVon(`POI ${i}`)).toHaveValue("wahrscheinlich");
    }
  });

  it("ersetzt dabei auch untereinander verschiedene Status", async () => {
    // POI 0 stand auf "Gesetzt", POI 1 auf "Wenn wir Zeit haben", POI 2 auf
    // "Auf keinen Fall" -- danach tragen alle drei denselben.
    await dreiSetzen("weiss_nicht");

    const gesetzte = [0, 1, 2].map(
      (i) => (statusVon(`POI ${i}`) as HTMLSelectElement).value,
    );
    expect(gesetzte).toEqual(["weiss_nicht", "weiss_nicht", "weiss_nicht"]);
  });

  it("lässt die übrigen sieben sichtbaren POIs unverändert", async () => {
    await dreiSetzen("wahrscheinlich");

    for (let i = 3; i < 10; i += 1) {
      expect(statusVon(`POI ${i}`)).toHaveValue("weiss_nicht");
    }
  });

  it("schickt genau die angekreuzten POIs an den Server", async () => {
    const { fetchMock } = await dreiSetzen("gesetzt");

    const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/poi-status");
    expect(JSON.parse(String(init.body))).toEqual({
      poiIds: ["poi-0", "poi-1", "poi-2"],
      status: "gesetzt",
    });
  });

  it("lässt dieselben POIs danach angekreuzt stehen", async () => {
    await dreiSetzen("gesetzt");

    for (const i of [0, 1, 2]) {
      expect(screen.getByLabelText(`POI ${i} auswählen`)).toBeChecked();
    }
    for (let i = 3; i < 10; i += 1) {
      expect(screen.getByLabelText(`POI ${i} auswählen`)).not.toBeChecked();
    }
  });

  it("meldet, wenn das Speichern fehlschlug (bug-021)", async () => {
    await dreiSetzen("wahrscheinlich", false);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Der Status von 3 POIs konnte nicht gespeichert werden.",
    );
  });

  it("zeigt nach einem Fehlschlag nicht den neuen Status an (bug-021)", async () => {
    await dreiSetzen("wahrscheinlich", false);

    await screen.findByRole("alert");
    expect(statusVon("POI 0")).toHaveValue("gesetzt");
    expect(statusVon("POI 1")).toHaveValue("wenn_zeit");
    expect(statusVon("POI 2")).toHaveValue("auf_keinen_fall");
  });

  it("nimmt nur die POIs zurück, die der Server nicht gesetzt hat", async () => {
    // Ein POI, den es im Account nicht mehr gibt, faellt serverseitig still
    // heraus -- die Oberflaeche darf ihn dann nicht neu gefaerbt stehen
    // lassen (req-024, bug-021).
    antwortet({ status: "ok", updatedIds: ["poi-0", "poi-1"] });
    const user = userEvent.setup();
    renderView(zehnPois());

    for (const i of [0, 1, 2]) {
      await user.click(screen.getByLabelText(`POI ${i} auswählen`));
    }
    await user.selectOptions(gemeinsamerStatus(), "wahrscheinlich");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Der Status von „POI 2" konnte nicht gespeichert werden.',
    );
    expect(statusVon("POI 0")).toHaveValue("wahrscheinlich");
    expect(statusVon("POI 1")).toHaveValue("wahrscheinlich");
    expect(statusVon("POI 2")).toHaveValue("auf_keinen_fall");
  });

  it("meldet nichts, wenn alle gespeichert wurden", async () => {
    await dreiSetzen("gesetzt");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
