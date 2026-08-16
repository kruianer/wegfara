import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timeline } from "./timeline";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Dom von Amalfi",
    shortText: "Kurztext",
    longText: "Der ausfuehrliche Text zum Programmpunkt.",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T12:30",
    position: { lat: 40.6343, lng: 14.6027 },
    ...overrides,
  };
}

function transfer(overrides: Partial<Transfer> & { id: string }): Transfer {
  return {
    tripId: "trip-1",
    fromActivityId: "a",
    toActivityId: "b",
    mode: "auto",
    title: "Fahrt zum Aussichtspunkt",
    durationMin: 12,
    distanceKm: 4.2,
    ...overrides,
  };
}

describe("Timeline", () => {
  it("zeigt genau so viele Programmpunkte wie uebergeben", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            title: "Erster",
            startAt: "2026-07-18T09:00",
            endAt: "2026-07-18T10:00",
          }),
          activity({
            id: "b",
            title: "Zweiter",
            startAt: "2026-07-18T10:30",
            endAt: "2026-07-18T11:30",
          }),
          activity({
            id: "c",
            title: "Dritter",
            startAt: "2026-07-18T12:00",
            endAt: "2026-07-18T13:00",
          }),
          activity({
            id: "d",
            title: "Vierter",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T14:30",
          }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("nummeriert den ersten Programmpunkt mit 1", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            title: "Erster",
            startAt: "2026-07-18T09:00",
            endAt: "2026-07-18T10:00",
          }),
          activity({
            id: "b",
            title: "Zweiter",
            startAt: "2026-07-18T10:30",
            endAt: "2026-07-18T11:30",
          }),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("1")).toBeInTheDocument();
    expect(within(items[1]).getByText("2")).toBeInTheDocument();
  });

  it("beginnt die Nummerierung fuer jeden uebergebenen Tag wieder bei 1", () => {
    const { rerender } = render(
      <Timeline activities={[activity({ id: "day1-a" })]} />,
    );
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText("1"),
    ).toBeInTheDocument();

    rerender(
      <Timeline
        activities={[activity({ id: "day2-a", title: "Anderer Tag" })]}
      />,
    );
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText("1"),
    ).toBeInTheDocument();
  });

  it("zeigt den Typ-Chip eines Restaurants in der Farbe #e0603e", () => {
    render(
      <Timeline activities={[activity({ id: "a", type: "restaurant" })]} />,
    );

    expect(screen.getByText("Restaurant")).toHaveStyle({
      backgroundColor: "#e0603e",
    });
  });

  it('zeigt Beginn- und Endzeit als "10:00 – 12:30"', () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            startAt: "2026-07-18T10:00",
            endAt: "2026-07-18T12:30",
          }),
        ]}
      />,
    );

    expect(screen.getByText("10:00 – 12:30")).toBeInTheDocument();
  });

  it('zeigt den ausfuehrlichen Text erst nach Klick auf "Mehr lesen"', async () => {
    const user = userEvent.setup();
    render(<Timeline activities={[activity({ id: "a" })]} />);

    expect(
      screen.queryByText("Der ausfuehrliche Text zum Programmpunkt."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("Mehr lesen"));

    expect(
      screen.getByText("Der ausfuehrliche Text zum Programmpunkt."),
    ).toBeInTheDocument();
  });

  it('verbirgt den ausfuehrlichen Text wieder nach Klick auf "Weniger anzeigen"', async () => {
    const user = userEvent.setup();
    render(<Timeline activities={[activity({ id: "a" })]} />);

    await user.click(screen.getByText("Mehr lesen"));
    await user.click(screen.getByText("Weniger anzeigen"));

    expect(
      screen.queryByText("Der ausfuehrliche Text zum Programmpunkt."),
    ).not.toBeInTheDocument();
  });

  it('zeigt "Noch nichts geplant", wenn keine Programmpunkte vorhanden sind', () => {
    render(<Timeline activities={[]} />);
    expect(screen.getByText("Noch nichts geplant")).toBeInTheDocument();
  });

  it("zeigt kein Foto zu einem Programmpunkt", () => {
    render(<Timeline activities={[activity({ id: "a" })]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("fasst drei zeitgleiche Programmpunkte zu einer Gruppe an einer Stelle zusammen", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "c",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("3 OPTIONEN · 13:30 – 15:00")).toBeInTheDocument();
  });

  it("kennzeichnet die erste Alternative als gewaehlt, solange nie gewaehlt wurde", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            title: "Erste Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            title: "Zweite Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("✓ Gewählt")).toHaveLength(1);
    expect(screen.getByText("Erste Option")).toBeInTheDocument();
  });

  it("uebernimmt eine gespeicherte Wahl fuer die Gruppe", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            title: "Erste Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            title: "Zweite Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
        optionSelections={{ "trip-1|2026-07-18T13:30|2026-07-18T15:00": "b" }}
      />,
    );

    const secondCard = screen
      .getByText("Zweite Option")
      .closest("div")?.parentElement;
    expect(secondCard).not.toBeNull();
    expect(
      within(secondCard as HTMLElement).queryByText("✓ Gewählt"),
    ).toBeInTheDocument();
  });

  it("gruppiert Programmpunkte NICHT, wenn nur der Beginn uebereinstimmt, aber nicht das Ende", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            startAt: "2026-07-18T18:00",
            endAt: "2026-07-18T18:30",
          }),
          activity({
            id: "b",
            startAt: "2026-07-18T18:00",
            endAt: "2026-07-18T20:00",
          }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/OPTIONEN/)).not.toBeInTheDocument();
  });

  it("zaehlt eine Gruppe als einen Programmpunkt des Tages und nummeriert sie durch", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "vorher",
            startAt: "2026-07-18T09:00",
            endAt: "2026-07-18T10:00",
          }),
          activity({
            id: "a",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "c",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("1")).toBeInTheDocument();
    expect(within(items[1]).getByText("2")).toBeInTheDocument();
  });

  describe("Transfers (req-006)", () => {
    function twoActivities() {
      return [
        activity({
          id: "a",
          title: "Erster",
          startAt: "2026-07-18T09:00",
          endAt: "2026-07-18T10:00",
        }),
        activity({
          id: "b",
          title: "Zweiter",
          startAt: "2026-07-18T10:30",
          endAt: "2026-07-18T11:30",
        }),
      ];
    }

    it("steht zwischen den beiden Programmpunkten, die er verbindet", () => {
      render(
        <Timeline
          activities={twoActivities()}
          transfers={[
            transfer({ id: "t1", fromActivityId: "a", toActivityId: "b" }),
          ]}
        />,
      );

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(within(items[0]).getByText("Erster")).toBeInTheDocument();
      expect(
        within(items[1]).getByText("Fahrt zum Aussichtspunkt"),
      ).toBeInTheDocument();
      expect(within(items[2]).getByText("Zweiter")).toBeInTheDocument();
    });

    it('zeigt Verkehrsmittel Auto, 12 Minuten und 4,2 km als "12 Min · 4,2 km"', () => {
      render(
        <Timeline
          activities={twoActivities()}
          transfers={[
            transfer({
              id: "t1",
              fromActivityId: "a",
              toActivityId: "b",
              mode: "auto",
              durationMin: 12,
              distanceKm: 4.2,
            }),
          ]}
        />,
      );

      expect(screen.getByText("12 Min · 4,2 km")).toBeInTheDocument();
    });

    it("zeigt fuer das Verkehrsmittel Boot ein Boot-Symbol", () => {
      render(
        <Timeline
          activities={twoActivities()}
          transfers={[
            transfer({
              id: "t1",
              fromActivityId: "a",
              toActivityId: "b",
              mode: "boot",
            }),
          ]}
        />,
      );

      expect(screen.getByRole("img", { name: "Boot" })).toBeInTheDocument();
    });

    it("nummeriert den zweiten Programmpunkt trotz Transfer dazwischen mit 2", () => {
      render(
        <Timeline
          activities={twoActivities()}
          transfers={[
            transfer({ id: "t1", fromActivityId: "a", toActivityId: "b" }),
          ]}
        />,
      );

      const items = screen.getAllByRole("listitem");
      expect(within(items[0]).getByText("1")).toBeInTheDocument();
      expect(within(items[2]).getByText("2")).toBeInTheDocument();
    });

    it("zeigt am Transfer keine Ziffer", () => {
      render(
        <Timeline
          activities={twoActivities()}
          transfers={[
            transfer({ id: "t1", fromActivityId: "a", toActivityId: "b" }),
          ]}
        />,
      );

      const items = screen.getAllByRole("listitem");
      expect(within(items[1]).queryByText("1")).not.toBeInTheDocument();
      expect(within(items[1]).queryByText("2")).not.toBeInTheDocument();
    });

    it('oeffnet "Route" zum Zielpunkt in einem neuen Fenster, wenn dieser eine Position hat', () => {
      render(
        <Timeline
          activities={[
            activity({
              id: "a",
              title: "Erster",
              startAt: "2026-07-18T09:00",
              endAt: "2026-07-18T10:00",
            }),
            activity({
              id: "b",
              title: "Zweiter",
              startAt: "2026-07-18T10:30",
              endAt: "2026-07-18T11:30",
              position: { lat: 40.627, lng: 14.597 },
            }),
          ]}
          transfers={[
            transfer({
              id: "t1",
              fromActivityId: "a",
              toActivityId: "b",
              mode: "auto",
            }),
          ]}
        />,
      );

      const link = screen.getByRole("link", { name: "Route" });
      expect(link).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&destination=40.627,14.597&travelmode=driving",
      );
      expect(link).toHaveAttribute("target", "_blank");
    });

    it('zeigt KEINE Schaltflaeche "Route", wenn der Zielpunkt keine Position hat', () => {
      render(
        <Timeline
          activities={[
            activity({
              id: "a",
              title: "Erster",
              startAt: "2026-07-18T09:00",
              endAt: "2026-07-18T10:00",
            }),
            activity({
              id: "b",
              title: "Zweiter",
              startAt: "2026-07-18T10:30",
              endAt: "2026-07-18T11:30",
              position: undefined,
            }),
          ]}
          transfers={[
            transfer({ id: "t1", fromActivityId: "a", toActivityId: "b" }),
          ]}
        />,
      );

      expect(
        screen.queryByRole("link", { name: "Route" }),
      ).not.toBeInTheDocument();
    });

    it("zeigt KEINE Transfer-Zeile zwischen zwei Programmpunkten ohne Transfer dazwischen", () => {
      render(<Timeline activities={twoActivities()} transfers={[]} />);

      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(
        screen.queryByRole("link", { name: "Route" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("An- und Abreise als Transfer (req-018)", () => {
    // Ausgangspunkt der Anreise: ein gewoehnlicher Programmpunkt vom Typ
    // "Stadt & Dorf" am ersten Reisetag.
    function wien(): Activity {
      return activity({
        id: "wien",
        type: "stadt_dorf",
        title: "Wien",
        shortText: "Ausgangspunkt der Anreise.",
        startAt: "2026-07-18T06:00",
        endAt: "2026-07-18T07:00",
        position: { lat: 48.2082, lng: 16.3738 },
      });
    }

    function neapel(): Activity {
      return activity({
        id: "neapel",
        title: "Altstadt von Neapel",
        startAt: "2026-07-18T10:00",
        endAt: "2026-07-18T12:00",
        position: { lat: 40.8518, lng: 14.2681 },
      });
    }

    function anreise(): Transfer {
      return transfer({
        id: "anreise",
        fromActivityId: "wien",
        toActivityId: "neapel",
        mode: "flug",
        title: "Flug Wien–Neapel",
        durationMin: 105,
        distanceKm: 815,
      });
    }

    it("zeigt den Flug zwischen dem Ausgangspunkt und dem ersten Programmpunkt am Zielort", () => {
      render(
        <Timeline activities={[wien(), neapel()]} transfers={[anreise()]} />,
      );

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(within(items[0]).getByText("Wien")).toBeInTheDocument();
      expect(
        within(items[1]).getByText("Flug Wien–Neapel"),
      ).toBeInTheDocument();
      expect(
        within(items[2]).getByText("Altstadt von Neapel"),
      ).toBeInTheDocument();
    });

    it("zeigt am Flug ein Flugzeug-Symbol", () => {
      render(
        <Timeline activities={[wien(), neapel()]} transfers={[anreise()]} />,
      );

      expect(screen.getByRole("img", { name: "Flug" })).toBeInTheDocument();
    });

    it('zeigt den Ausgangspunkt mit dem Typ-Chip "Stadt & Dorf"', () => {
      render(
        <Timeline activities={[wien(), neapel()]} transfers={[anreise()]} />,
      );

      expect(screen.getByText("Stadt & Dorf")).toHaveStyle({
        backgroundColor: "#a1547f",
      });
    });

    it("stellt den Ausgangspunkt genauso dar wie denselben Programmpunkt ohne Anreise", () => {
      const mitAnreise = render(
        <Timeline activities={[wien(), neapel()]} transfers={[anreise()]} />,
      );
      const zeileMitAnreise =
        mitAnreise.container.querySelectorAll("li")[0].innerHTML;
      mitAnreise.unmount();

      const ohneAnreise = render(
        <Timeline activities={[wien(), neapel()]} transfers={[]} />,
      );
      const zeileOhneAnreise =
        ohneAnreise.container.querySelectorAll("li")[0].innerHTML;

      expect(zeileMitAnreise).toBe(zeileOhneAnreise);
    });

    it("nummeriert den Ausgangspunkt wie jeden anderen Programmpunkt mit 1", () => {
      render(
        <Timeline activities={[wien(), neapel()]} transfers={[anreise()]} />,
      );

      const items = screen.getAllByRole("listitem");
      expect(within(items[0]).getByText("1")).toBeInTheDocument();
      expect(within(items[2]).getByText("2")).toBeInTheDocument();
    });

    it("zeigt die Abreise als Transfer vom letzten Programmpunkt zum Rückreiseziel", () => {
      const letzterPunkt = activity({
        id: "checkout",
        type: "hotel",
        title: "Check-out",
        startAt: "2026-07-23T09:00",
        endAt: "2026-07-23T10:30",
      });
      const rueckreiseziel = activity({
        id: "heim",
        type: "stadt_dorf",
        title: "Wien",
        startAt: "2026-07-23T14:00",
        endAt: "2026-07-23T15:00",
        position: { lat: 48.2082, lng: 16.3738 },
      });

      render(
        <Timeline
          activities={[letzterPunkt, rueckreiseziel]}
          transfers={[
            transfer({
              id: "abreise",
              fromActivityId: "checkout",
              toActivityId: "heim",
              mode: "flug",
              title: "Flug Neapel–Wien",
            }),
          ]}
        />,
      );

      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(
        within(items[1]).getByText("Flug Neapel–Wien"),
      ).toBeInTheDocument();
      expect(within(items[2]).getByText("Wien")).toBeInTheDocument();
    });
  });
});
