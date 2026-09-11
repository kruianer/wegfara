import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Activity } from "@/lib/activities/types";
import type { GespeicherteKostenzeile } from "@/lib/kosten/types";
import type { Poi } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import { KostenView } from "./kosten-view";

const REISE: Trip = {
  id: "reise-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: REISE.id,
    number: 1,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.649, lng: 14.612 },
    status: "gesetzt",
    ...overrides,
  };
}

function programmpunkt(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "activity-1",
    tripId: REISE.id,
    type: "sehenswuerdigkeit",
    title: "Villa Rufolo",
    shortText: "",
    longText: "",
    startAt: "2026-07-19T10:00",
    endAt: "2026-07-19T12:00",
    poiId: "poi-1",
    ...overrides,
  };
}

function zeige({
  activities = [programmpunkt()],
  pois = [poi()],
  gespeicherte = [],
  teilnehmerzahl = 4,
  onPoiChanged = () => {},
  onZeileGespeichert = () => {},
}: {
  activities?: Activity[];
  pois?: Poi[];
  gespeicherte?: GespeicherteKostenzeile[];
  teilnehmerzahl?: number;
  onPoiChanged?: (poi: Poi) => void;
  onZeileGespeichert?: (zeile: GespeicherteKostenzeile) => void;
} = {}) {
  return render(
    <KostenView
      trip={REISE}
      activities={activities}
      pois={pois}
      gespeicherte={gespeicherte}
      teilnehmerzahl={teilnehmerzahl}
      onPoiChanged={onPoiChanged}
      onZeileGespeichert={onZeileGespeichert}
    />,
  );
}

/** Die Zeilen der Tabelle ohne ihre Kopfzeile. */
function zeilen() {
  return within(screen.getByTestId("kostenzeilen")).getAllByRole("row");
}

describe("Bereich Kosten (req-062)", () => {
  it("zeigt zu drei Programmpunkten drei Zeilen", () => {
    zeige({
      activities: [
        programmpunkt({ id: "a1", poiId: "poi-1" }),
        programmpunkt({
          id: "a2",
          poiId: "poi-2",
          startAt: "2026-07-20T10:00",
          endAt: "2026-07-20T11:00",
        }),
        programmpunkt({
          id: "a3",
          poiId: "poi-3",
          startAt: "2026-07-21T10:00",
          endAt: "2026-07-21T11:00",
        }),
      ],
      pois: [
        poi({ id: "poi-1" }),
        poi({ id: "poi-2", name: "Pompeji" }),
        poi({ id: "poi-3", name: "Capri" }),
      ],
    });

    expect(zeilen()).toHaveLength(3);
  });

  it("zeigt den Preis je Person, wie er am POI steht (req-061)", () => {
    zeige({ pois: [poi({ kostenCent: 1250 })] });

    expect(screen.getByLabelText("Preis je Person: Villa Rufolo")).toHaveValue(
      "12,50",
    );
  });

  it("zeigt als Anzahl die Teilnehmerzahl der Reise", () => {
    zeige({ teilnehmerzahl: 4 });

    expect(
      within(zeilen()[0]).getByTestId("kostenzeile-anzahl"),
    ).toHaveTextContent("4");
  });

  it("zeigt als Gesamt den Preis mal der Anzahl", () => {
    zeige({ pois: [poi({ kostenCent: 1250 })], teilnehmerzahl: 4 });

    expect(
      within(zeilen()[0]).getByTestId("kostenzeile-gesamt"),
    ).toHaveTextContent("50,00");
  });

  it("zeigt Name und Reisetag des Programmpunkts", () => {
    zeige();

    expect(zeilen()[0]).toHaveTextContent("Villa Rufolo");
    expect(zeilen()[0]).toHaveTextContent("Tag 2 · So 19.07.");
  });

  /** Zweimal essen kostet zweimal (req-062). */
  it("zeigt denselben POI an zwei Reisetagen in zwei Zeilen", () => {
    zeige({
      activities: [
        programmpunkt({ id: "a1", startAt: "2026-07-19T12:00" }),
        programmpunkt({ id: "a2", startAt: "2026-07-21T12:00" }),
      ],
      pois: [poi({ kostenCent: 1250 })],
    });

    expect(zeilen()).toHaveLength(2);
  });

  it("sagt es, wenn noch keine Kosten erfasst sind", () => {
    zeige({ activities: [] });

    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/noch keine Kosten erfasst/i)).toBeInTheDocument();
  });
});

/**
 * Preis und Buchungsstatus stehen am POI (req-061) und fliessen von hier
 * dorthin zurueck -- es gibt eine Wahrheit, an zwei Stellen bedienbar. Die
 * Schnittstelle entscheidet, wo die Aenderung landet; die Tabelle uebernimmt
 * den geaenderten POI, damit er auch im Bereich POIs sofort richtig steht.
 */
describe("Kosten -- Preis und Buchung ändern (req-062)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function antwortet(antwort: unknown, ok = true) {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      void url;
      void init;
      return { ok, json: async () => antwort };
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("schickt den geänderten Preis an die Schnittstelle", async () => {
    const user = userEvent.setup();
    const geaendert = poi({ kostenCent: 1500 });
    const fetchMock = antwortet({ poi: geaendert, zeile: null });
    const onPoiChanged = vi.fn();
    zeige({ pois: [poi({ kostenCent: 1250 })], onPoiChanged });

    const feld = screen.getByLabelText("Preis je Person: Villa Rufolo");
    await user.clear(feld);
    await user.type(feld, "15,00");
    await user.tab();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/kostenzeilen");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      activityId: "activity-1",
      preis: "15,00",
    });
    await waitFor(() => expect(onPoiChanged).toHaveBeenCalledWith(geaendert));
  });

  it("schreibt nicht, wenn der Preis unverändert bleibt", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet({ poi: null, zeile: null });
    zeige({ pois: [poi({ kostenCent: 1250 })] });

    await user.click(screen.getByLabelText("Preis je Person: Villa Rufolo"));
    await user.tab();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("weist einen Buchstaben als Preis ab und schreibt nicht", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet({ poi: null, zeile: null });
    zeige({ pois: [poi({ kostenCent: 1250 })] });

    const feld = screen.getByLabelText("Preis je Person: Villa Rufolo");
    await user.clear(feld);
    await user.type(feld, "abc");
    await user.tab();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("kosten-hinweis")).toHaveTextContent(
      /Betrag in Euro/i,
    );
  });

  it("sagt es, wenn das Speichern fehlschlägt (bug-021)", async () => {
    const user = userEvent.setup();
    antwortet({}, false);
    zeige({ pois: [poi({ kostenCent: 1250 })] });

    const feld = screen.getByLabelText("Preis je Person: Villa Rufolo");
    await user.clear(feld);
    await user.type(feld, "15,00");
    await user.tab();

    await waitFor(() =>
      expect(screen.getByTestId("kosten-hinweis")).toBeInTheDocument(),
    );
  });

  it("zeigt den Buchungsstatus des POI", () => {
    zeige({ pois: [poi({ buchung: "offen" })] });

    expect(screen.getByLabelText("Buchung: Villa Rufolo")).toHaveValue("offen");
  });

  it("schickt den geänderten Buchungsstatus an die Schnittstelle", async () => {
    const user = userEvent.setup();
    const geaendert = poi({ buchung: "gebucht" });
    const fetchMock = antwortet({ poi: geaendert, zeile: null });
    const onPoiChanged = vi.fn();
    zeige({ pois: [poi()], onPoiChanged });

    await user.selectOptions(
      screen.getByLabelText("Buchung: Villa Rufolo"),
      "gebucht",
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body))).toEqual({
      activityId: "activity-1",
      buchung: "gebucht",
    });
    await waitFor(() => expect(onPoiChanged).toHaveBeenCalledWith(geaendert));
  });

  /**
   * Ein Programmpunkt ohne POI (req-018) hat nichts, woran der Preis stehen
   * koennte -- er wird an der Zeile selbst gespeichert.
   */
  it("meldet eine gespeicherte Zeile ohne POI zurück", async () => {
    const user = userEvent.setup();
    const zeile: GespeicherteKostenzeile = {
      id: "zeile-1",
      tripId: REISE.id,
      activityId: "activity-1",
      bezeichnung: null,
      preisCent: 3000,
      buchung: null,
      anzahl: null,
      dokumentId: null,
    };
    antwortet({ poi: null, zeile });
    const onZeileGespeichert = vi.fn();
    zeige({
      activities: [programmpunkt({ poiId: undefined, title: "Wien" })],
      pois: [],
      onZeileGespeichert,
    });

    const feld = screen.getByLabelText("Preis je Person: Wien");
    await user.type(feld, "30,00");
    await user.tab();

    await waitFor(() => expect(onZeileGespeichert).toHaveBeenCalledWith(zeile));
  });
});
