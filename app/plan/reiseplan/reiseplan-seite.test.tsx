import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DRUCK_ACTIVITIES,
  DRUCK_POIS,
  DRUCK_TRIP,
  ST_CAFFE,
  ST_DORNBIRN,
} from "@/tests/fixtures/druck-reise";
import { DRUCK_DARSTELLUNG_LABEL } from "@/lib/activities/druck-darstellung";
import { ReiseplanSeite } from "./reiseplan-seite";
import { STEUERUNG_NICHT_GESPEICHERT } from "./reiseplan-steuerung";

/**
 * Das Kennzeichen am Programmpunkt (req-080): gesetzt wird es neben dem Heft,
 * und die Wirkung ist gleich daneben zu sehen -- schmale Nebenstation (L5),
 * oder im Heft gar nicht. In der App bleibt der Programmpunkt dabei sichtbar;
 * das belegen app/plan/components/druck-kennzeichen.test.tsx und
 * app/go/druck-kennzeichen.test.tsx.
 */

function zeige() {
  render(
    <ReiseplanSeite
      trip={DRUCK_TRIP}
      activities={DRUCK_ACTIVITIES}
      pois={DRUCK_POIS}
      teilnehmerzahl={4}
      reiseleitung={["Uwe Kremmel"]}
      stand="2026-10-10"
    />,
  );
}

/** Die Schnittstelle, die das Kennzeichen speichert -- hier nur beantwortet. */
function mockServer(ok = true) {
  const anfragen: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      anfragen.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return ok
        ? Response.json({ activity: {} })
        : Response.json({ error: "nope" }, { status: 500 });
    }),
  );
  return anfragen;
}

function wahl(activityId: string) {
  return screen.getByTestId(`druck-darstellung-${activityId}`);
}

/** Die Zahl "Stationen" des Dashboards, samt ihrer Bezeichnung. */
function stationenZahl(): string {
  const block = Array.from(screen.getByTestId("druck-zahlen").children).find(
    (element) => element.textContent?.includes("Stationen"),
  );
  return block?.textContent ?? "";
}

function layoutVon(activityId: string): string | null {
  return screen
    .getByTestId(`station-${activityId}`)
    .getAttribute("data-layout");
}

afterEach(() => vi.unstubAllGlobals());

describe("Das Kennzeichen neben dem Heft (req-080)", () => {
  it("zeigt zu jedem Programmpunkt des Tages seine Wahl", () => {
    mockServer();
    zeige();

    expect(screen.getByTestId("druck-steuerung")).toBeInTheDocument();
    for (const activity of DRUCK_ACTIVITIES) {
      expect(wahl(activity.id)).toBeInTheDocument();
    }
  });

  it("steht bei einem Programmpunkt ohne Angabe auf „Vollständig“", () => {
    mockServer();
    zeige();

    expect(wahl(ST_DORNBIRN.id)).toHaveValue("vollstaendig");
    expect(wahl(ST_DORNBIRN.id)).toHaveTextContent(
      DRUCK_DARSTELLUNG_LABEL.vollstaendig,
    );
  });

  it("macht aus einem Programmpunkt mit „Als Nebenstation“ eine schmale Station (L5)", async () => {
    const user = userEvent.setup();
    const anfragen = mockServer();
    zeige();

    // Dornbirn ist die erste Station des Tages und traegt L1.
    expect(layoutVon(ST_DORNBIRN.id)).toBe("l1");

    await user.selectOptions(wahl(ST_DORNBIRN.id), "nebenstation");

    await waitFor(() => expect(layoutVon(ST_DORNBIRN.id)).toBe("l5"));
    expect(anfragen).toEqual([
      { activityId: ST_DORNBIRN.id, darstellung: "nebenstation" },
    ]);
  });

  it("laesst einen Programmpunkt mit „Nicht anzeigen“ im Heft fehlen", async () => {
    const user = userEvent.setup();
    const anfragen = mockServer();
    zeige();

    expect(screen.getByTestId(`station-${ST_CAFFE.id}`)).toBeInTheDocument();

    await user.selectOptions(wahl(ST_CAFFE.id), "nicht_anzeigen");

    await waitFor(() =>
      expect(
        screen.queryByTestId(`station-${ST_CAFFE.id}`),
      ).not.toBeInTheDocument(),
    );
    expect(anfragen).toEqual([
      { activityId: ST_CAFFE.id, darstellung: "nicht_anzeigen" },
    ]);
  });

  it("laesst ihn trotzdem in der Liste stehen -- sonst waere er verloren", async () => {
    const user = userEvent.setup();
    mockServer();
    zeige();

    await user.selectOptions(wahl(ST_CAFFE.id), "nicht_anzeigen");

    await waitFor(() =>
      expect(wahl(ST_CAFFE.id)).toHaveValue("nicht_anzeigen"),
    );
  });

  it("zaehlt eine weggelassene Station nicht mehr als Station mit", async () => {
    const user = userEvent.setup();
    mockServer();
    zeige();

    // Fuenf Stationen: die Alternative der Options-Gruppe zaehlt als eine.
    expect(stationenZahl()).toBe("5Stationen");

    await user.selectOptions(wahl(ST_CAFFE.id), "nicht_anzeigen");

    await waitFor(() => expect(stationenZahl()).toBe("4Stationen"));
  });

  it("nimmt die Anzeige zurueck und sagt es, wenn das Speichern fehlschlägt (bug-021)", async () => {
    const user = userEvent.setup();
    mockServer(false);
    zeige();

    await user.selectOptions(wahl(ST_DORNBIRN.id), "nicht_anzeigen");

    expect(
      await screen.findByText(STEUERUNG_NICHT_GESPEICHERT),
    ).toBeInTheDocument();
    expect(wahl(ST_DORNBIRN.id)).toHaveValue("vollstaendig");
    expect(screen.getByTestId(`station-${ST_DORNBIRN.id}`)).toBeInTheDocument();
  });
});
