import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoView } from "./go-view";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";
import { DEMO_ACTIVITIES } from "@/tests/fixtures/demo-activities";
import { DEMO_TRANSFERS } from "@/tests/fixtures/demo-transfers";
import { clearWeatherCache } from "@/lib/weather/cache";
import { openMeteoResponse } from "@/tests/fixtures/open-meteo-response";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const TODAY = "2026-07-20";

function mockWeatherSource() {
  clearWeatherCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () =>
        openMeteoResponse({
          currentTemperature: 24,
          currentPrecipitation: 5,
          dailyDates: ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23"],
          dailyMaxTemperatures: [29, 30, 26, 28],
          dailyMaxPrecipitations: [10, 15, 33, 5],
        }),
    })),
  );
}

describe("GoView", () => {
  it("zeigt die aktuell aktive Reise im Kopfbereich", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.getByText("Süditalien Rundreise")).toBeInTheDocument();
  });

  it("zeigt den Zeitraum der geoeffneten Reise im Kopfbereich", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.getByText("18. – 23. Juli 2026")).toBeInTheDocument();
  });

  it("oeffnet beim Klick auf den Reisetitel eine Liste mit genau drei Reisen", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button")).toHaveLength(3);
  });

  it('kennzeichnet eine noch nicht begonnene Reise als "Geplant"', async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));

    const dialog = screen.getByRole("dialog");
    const wienItem = within(dialog)
      .getByText("Wien Städtereise")
      .closest("button");
    expect(wienItem).not.toBeNull();
    expect(
      within(wienItem as HTMLElement).getByText("Geplant"),
    ).toBeInTheDocument();
  });

  it("oeffnet die gewaehlte Reise nach Auswahl in der Liste", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Wien Städtereise"));

    expect(screen.getByRole("banner")).toHaveTextContent("Wien Städtereise");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zeigt fuer die dreitaegige Wien-Reise genau drei Eintraege in der Tagesauswahl", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));
    await user.click(screen.getByText("Wien Städtereise"));

    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("markiert den heutigen Tag in der Tagesauswahl als gewaehlt", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    const selectedTab = screen.getByRole("tab", { selected: true });
    expect(selectedTab).toHaveTextContent("20.07.");
  });

  it("markiert einen angeklickten Tag als gewaehlt", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    const targetTab = screen.getByText("22.07.").closest("button")!;
    await user.click(targetTab);

    expect(targetTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { selected: true })).toBe(targetTab);
  });

  it("zeigt in der Tagesauswahl keine Ortsangabe", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.queryByText("Amalfi")).not.toBeInTheDocument();
  });

  it("zeigt im Kopfbereich keinen Hauptort", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.queryByText("Amalfi")).not.toBeInTheDocument();
  });

  it('zeigt beim Antippen von "Karte" die Kartenansicht statt des Zeitstrahls', async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("18.07.").closest("button")!);
    await user.click(screen.getByRole("button", { name: "Karte" }));

    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Karte" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it('kehrt beim Antippen von "Plan" zum Zeitstrahl zurueck', async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByRole("button", { name: "Karte" }));
    await user.click(screen.getByRole("button", { name: "Plan" }));

    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plan" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("zeigt in der Kartenansicht vier Marker fuer einen Tag mit vier Programmpunkten", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("18.07.").closest("button")!);
    await user.click(screen.getByRole("button", { name: "Karte" }));

    expect(screen.getAllByRole("button", { name: /^\d+\. / })).toHaveLength(4);
  });

  it("zeigt in der Kartenansicht die Marker des neu gewaehlten Reisetags", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("18.07.").closest("button")!);
    await user.click(screen.getByRole("button", { name: "Karte" }));
    expect(
      screen.getByRole("button", { name: "1. Dom von Amalfi" }),
    ).toBeInTheDocument();

    await user.click(screen.getByText("19.07.").closest("button")!);

    expect(
      screen.queryByRole("button", { name: "1. Dom von Amalfi" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "1. Bootstour nach Capri" }),
    ).toBeInTheDocument();
  });

  it("zeigt in der Kartenansicht fuer einen Reisetag ohne Programmpunkte keinen Marker", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("20.07.").closest("button")!);
    await user.click(screen.getByRole("button", { name: "Karte" }));

    expect(
      screen.queryByRole("button", { name: /^\d+\. / }),
    ).not.toBeInTheDocument();
  });

  it("zeigt fuer den heutigen Tag eine Temperatur in Grad Celsius im Kopfbereich", async () => {
    mockWeatherSource();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await waitFor(() => {
      expect(screen.getByRole("banner")).toHaveTextContent("29°");
    });
  });

  it("zeigt fuer den heutigen Tag eine Regenwahrscheinlichkeit in Prozent im Kopfbereich", async () => {
    mockWeatherSource();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await waitFor(() => {
      expect(screen.getByRole("banner")).toHaveTextContent("10%");
    });
  });

  it("zeigt beim Wechsel auf einen anderen Reisetag die Vorhersage fuer diesen Tag", async () => {
    mockWeatherSource();
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await waitFor(() => {
      expect(screen.getByRole("banner")).toHaveTextContent("29°");
    });

    const targetTab = screen.getByText("22.07.").closest("button")!;
    await user.click(targetTab);

    await waitFor(() => {
      expect(screen.getByRole("banner")).toHaveTextContent("26°");
      expect(screen.getByRole("banner")).toHaveTextContent("33%");
    });
  });

  it("zeigt fuer eine vergangene Reise das aktuelle Wetter am Hauptort", async () => {
    mockWeatherSource();
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));
    await user.click(screen.getByText("Alpen-Adria-Radtour"));

    await waitFor(() => {
      expect(screen.getByRole("banner")).toHaveTextContent("24°");
      expect(screen.getByRole("banner")).toHaveTextContent("5%");
    });
  });

  it("zeigt keine Wetterangabe, wenn die Wetterquelle nicht erreichbar ist", async () => {
    clearWeatherCache();
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("banner")).not.toHaveTextContent("°");
    expect(screen.getByRole("banner")).not.toHaveTextContent("%");
  });

  it("zeigt Reisetitel und Zeitraum weiterhin, wenn die Wetterquelle nicht erreichbar ist", async () => {
    clearWeatherCache();
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("banner")).toHaveTextContent(
      "Süditalien Rundreise",
    );
    expect(screen.getByRole("banner")).toHaveTextContent("18. – 23. Juli 2026");
  });

  it("ruft die Wetterquelle innerhalb von 15 Minuten fuer denselben Tag nicht erneut auf", async () => {
    clearWeatherCache();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => openMeteoResponse(),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const otherTab = screen.getByText("21.07.").closest("button")!;
    await user.click(otherTab);
    const originalTab = screen.getByText("20.07.").closest("button")!;
    await user.click(originalTab);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("zeigt fuer einen Tag mit vier Programmpunkten genau vier Programmpunkte im Zeitstrahl", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("18.07.").closest("button")!);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("nummeriert den ersten Programmpunkt des zweiten Reisetags ebenfalls mit 1", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("18.07.").closest("button")!);
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText("1"),
    ).toBeInTheDocument();

    await user.click(screen.getByText("19.07.").closest("button")!);
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText("1"),
    ).toBeInTheDocument();
  });

  it("zeigt einen Programmpunkt, der um 22:00 beginnt und um 00:30 endet, am Folgetag nicht", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("19.07.").closest("button")!);
    expect(
      screen.getByText("Abendlicher Stadtbummel in Positano"),
    ).toBeInTheDocument();

    await user.click(screen.getByText("20.07.").closest("button")!);
    expect(
      screen.queryByText("Abendlicher Stadtbummel in Positano"),
    ).not.toBeInTheDocument();
  });

  it('zeigt fuer einen Reisetag ohne Programmpunkte "Noch nichts geplant"', async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("20.07.").closest("button")!);

    expect(screen.getByText("Noch nichts geplant")).toBeInTheDocument();
  });

  it("zeigt drei zeitgleiche Programmpunkte als eine Options-Gruppe im Zeitstrahl", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("21.07.").closest("button")!);

    expect(screen.getByText("3 OPTIONEN · 13:30 – 15:00")).toBeInTheDocument();
  });

  it("kennzeichnet ohne vorherige Wahl die erste Alternative als gewaehlt", async () => {
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("21.07.").closest("button")!);

    expect(
      screen.getByText("Ausgrabungen von Herculaneum"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("✓ Gewählt")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Option 1 von 3" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("kennzeichnet die zweite Alternative als gewaehlt, wenn ihr Punkt angeklickt wird, und speichert die Wahl", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("21.07.").closest("button")!);
    await user.click(screen.getByRole("button", { name: "Option 2 von 3" }));

    expect(
      screen.getByRole("button", { name: "Option 2 von 3" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("Aufstieg zum Vesuv").closest("div")?.parentElement,
    ).toHaveTextContent("✓ Gewählt");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/activity-option-selection",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("behaelt die gewaehlte Alternative, wenn ich den Reisetag verlasse und erneut oeffne", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true })),
    );
    const user = userEvent.setup();
    render(
      <GoView trips={DEMO_TRIPS} activities={DEMO_ACTIVITIES} today={TODAY} />,
    );

    await user.click(screen.getByText("21.07.").closest("button")!);
    await user.click(screen.getByRole("button", { name: "Option 2 von 3" }));

    await user.click(screen.getByText("22.07.").closest("button")!);
    await user.click(screen.getByText("21.07.").closest("button")!);

    expect(
      screen.getByRole("button", { name: "Option 2 von 3" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("uebernimmt eine bereits gespeicherte Wahl beim Oeffnen der Reise", () => {
    render(
      <GoView
        trips={DEMO_TRIPS}
        activities={DEMO_ACTIVITIES}
        optionSelections={{
          "d5fda5ea-65e7-4b47-8096-62618599a288|2026-07-21T13:30|2026-07-21T15:00":
            "1a2b3c4d-0003-4a11-8b11-9f1c2d3e4f03",
        }}
        today="2026-07-21"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Option 3 von 3" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("zeigt einen Transfer zwischen zwei Programmpunkten im Zeitstrahl (req-006)", async () => {
    const user = userEvent.setup();
    render(
      <GoView
        trips={DEMO_TRIPS}
        activities={DEMO_ACTIVITIES}
        transfers={DEMO_TRANSFERS}
        today={TODAY}
      />,
    );

    await user.click(screen.getByText("18.07.").closest("button")!);

    expect(screen.getByText("Fahrt zum Aussichtspunkt")).toBeInTheDocument();
    expect(screen.getByText("12 Min · 4,2 km")).toBeInTheDocument();
  });

  it('zeigt fuer den Transfer nach Positano keine Schaltflaeche "Route", weil der Zielpunkt keine Position hat', async () => {
    const user = userEvent.setup();
    render(
      <GoView
        trips={DEMO_TRIPS}
        activities={DEMO_ACTIVITIES}
        transfers={DEMO_TRANSFERS}
        today={TODAY}
      />,
    );

    await user.click(screen.getByText("19.07.").closest("button")!);

    expect(
      screen.getByText("Bootsfahrt zurück nach Positano"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Route" }),
    ).not.toBeInTheDocument();
  });
});
