import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoisView } from "./pois-view";
import { MapLibreMap } from "@/tests/mocks/maplibre-gl";
import type { Poi } from "@/lib/pois/types";
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

function renderView(pois: Poi[], activities: Activity[] = []) {
  return render(
    <PoisView
      pois={pois}
      activities={activities}
      mainPlace={MAIN_PLACE}
      windowWidth={1600}
      tripId={TRIP_ID}
      searchArea={null}
      visibleMapStatuses={DEFAULT_MAP_VISIBLE_STATUSES}
      onToggleMapStatus={() => {}}
    />,
  );
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

  it("übernimmt beim Klick auf die Karte die angeklickte Position", async () => {
    const user = userEvent.setup();
    renderView([]);
    await flushMapReady();
    await user.click(screen.getByRole("button", { name: "POI anlegen" }));

    await user.click(
      screen.getByRole("button", { name: "Auf der Karte setzen" }),
    );
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
    await user.type(within(form).getByLabelText("Ort"), "Praiano");
    await user.click(
      within(form).getByRole("button", { name: "Auf der Karte setzen" }),
    );
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
