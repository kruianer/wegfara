import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PlanungView } from "./planung-view";
import type { Trip } from "@/lib/trips/types";
import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import { movedActivityTimes } from "@/lib/plan/move-activity";
import { transferVorschlag } from "@/lib/transfers/vorschlag";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Einen Transfer zwischen zwei Programmpunkten anlegen, aendern und
 * entfernen (req-052).
 *
 * Die Ansicht fuehrt die Transfers nicht selbst -- das tut ihr Aufrufer
 * (siehe app/plan/plan-view.tsx). Der Test stellt ihn nach: erst dann
 * erscheint ein gespeicherter Transfer im Zeitstrahl und verschwindet ein
 * entfernter daraus.
 */

const TRIP: Trip = {
  id: "trip-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

/** Vor dem Zeitraum der Reise -- vorausgewaehlt ist damit der Anreisetag. */
const TODAY = new Date(2026, 6, 10);
const TAG = "2026-07-18";

function programmpunkt(
  id: string,
  title: string,
  startAt: string,
  endAt: string,
  position = { lat: 40.634, lng: 14.6027 },
): Activity {
  return {
    id,
    tripId: TRIP.id,
    type: "sehenswuerdigkeit",
    title,
    shortText: "",
    longText: "",
    startAt: `${TAG}T${startAt}`,
    endAt: `${TAG}T${endAt}`,
    position,
  };
}

/** Zwei Programmpunkte mit einer Luecke von 20 Minuten dazwischen. */
const DOM = programmpunkt("activity-1", "Dom von Amalfi", "10:00", "12:30");
const MITTAGESSEN = programmpunkt(
  "activity-2",
  "Mittagessen bei La Marinella",
  "12:50",
  "14:00",
);
/** Ein Programmpunkt ohne hinterlegte Position (siehe req-006). */
const OHNE_POSITION: Activity = {
  ...programmpunkt("activity-3", "Stadtbummel in Positano", "12:50", "14:00"),
  position: undefined,
};

const VORHANDENER: Transfer = {
  id: "transfer-vorhanden",
  tripId: TRIP.id,
  fromActivityId: DOM.id,
  toActivityId: MITTAGESSEN.id,
  mode: "bus",
  title: "Bus zum Hafen",
  durationMin: 10,
  distanceKm: 1.1,
};

interface ServerStand {
  /** Die Route, die der Routing-Dienst meldet; null heisst: er ist stumm. */
  strecke: { km: number; minuten: number } | null;
}

/**
 * Die Schnittstellen, wie die Route-Handler sie beantworten (siehe
 * app/api/transfers/route.ts): der Vorschlag kommt aus derselben
 * Domaenenlogik wie auf dem Server.
 */
function mockServer({ strecke }: ServerStand = { strecke: null }) {
  const anfragen: {
    url: string;
    method: string;
    body: Record<string, unknown>;
  }[] = [];
  let laufendeNummer = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = String(init?.method ?? "GET");
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      anfragen.push({ url: String(url), method, body });

      if (String(url).includes("/api/transfers/vorschlag")) {
        if (!strecke) {
          return Response.json({ vorschlag: null, grund: "dienst_stumm" });
        }
        return Response.json({
          vorschlag: transferVorschlag(
            { distanzKm: strecke.km, dauerMinuten: strecke.minuten },
            strecke.km,
          ),
        });
      }

      if (String(url).includes("/api/programmpunkte")) {
        if (method === "DELETE") {
          return Response.json({ activity: { ...DOM, id: String(body.id) } });
        }
        const times = movedActivityTimes(DOM, TRIP, String(body.startAt));
        return Response.json({ activity: { ...DOM, ...times } });
      }

      if (method === "DELETE") {
        return Response.json({ transfer: { ...VORHANDENER, id: body.id } });
      }

      if (method === "PATCH") {
        return Response.json({
          transfer: { ...VORHANDENER, ...body, id: String(body.id) },
        });
      }

      laufendeNummer += 1;
      return Response.json(
        {
          transfer: {
            id: `transfer-${laufendeNummer}`,
            tripId: TRIP.id,
            ...body,
          },
        },
        { status: 201 },
      );
    }),
  );

  return { anfragen };
}

/** Die Planungsansicht mitsamt den Listen, die sonst in PlanView liegen. */
function Planung({
  activities,
  transfers = [],
}: {
  activities: Activity[];
  transfers?: Transfer[];
}) {
  const [aktuelleActivities, setActivities] = useState(activities);
  const [aktuelleTransfers, setTransfers] = useState(transfers);

  return (
    <PlanungView
      trip={TRIP}
      pois={[]}
      activities={aktuelleActivities}
      transfers={aktuelleTransfers}
      today={TODAY}
      onActivityPlanned={() => {}}
      onActivityRemoved={(activity) => {
        setActivities((liste) => liste.filter((a) => a.id !== activity.id));
        // Mit dem Programmpunkt geht der Weg von ihm oder zu ihm (req-052).
        setTransfers((liste) =>
          liste.filter(
            (t) =>
              t.fromActivityId !== activity.id &&
              t.toActivityId !== activity.id,
          ),
        );
      }}
      onActivityRescheduled={(activity) =>
        setActivities((liste) =>
          liste.map((a) => (a.id === activity.id ? activity : a)),
        )
      }
      onTransferSaved={(transfer) =>
        setTransfers((liste) =>
          liste.some((t) => t.id === transfer.id)
            ? liste.map((t) => (t.id === transfer.id ? transfer : t))
            : [...liste, transfer],
        )
      }
      onTransferRemoved={(transfer) =>
        setTransfers((liste) => liste.filter((t) => t.id !== transfer.id))
      }
    />
  );
}

/** Das "+" in der Luecke zwischen zwei Programmpunkten (req-052). */
function plus(from: Activity, to: Activity) {
  return screen.queryByTestId(`add-transfer-${from.id}-${to.id}`);
}

/** Oeffnet das Formular ueber das "+" der Luecke und wartet auf den Vorschlag. */
async function formularOeffnen(from: Activity, to: Activity) {
  fireEvent.click(plus(from, to)!);
  await screen.findByTestId("transfer-form");
  await waitFor(() =>
    expect(screen.queryByTestId("transfer-form-holt")).toBeNull(),
  );
}

function feld(name: string): HTMLInputElement {
  return screen.getByLabelText(name) as HTMLInputElement;
}

function verkehrsmittel(): HTMLSelectElement {
  return screen.getByLabelText("Verkehrsmittel") as HTMLSelectElement;
}

async function speichern() {
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
  await waitFor(() => expect(screen.queryByTestId("transfer-form")).toBeNull());
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Transfer anlegen (req-052)", () => {
  it("bietet in der Luecke zwischen zwei Programmpunkten ein „+“", () => {
    mockServer();
    render(<Planung activities={[DOM, MITTAGESSEN]} />);

    expect(plus(DOM, MITTAGESSEN)).toBeTruthy();
  });

  it("schlaegt im Formular bereits ein Verkehrsmittel vor", async () => {
    mockServer({ strecke: { km: 0.8, minuten: 3 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);

    await formularOeffnen(DOM, MITTAGESSEN);

    expect(verkehrsmittel().value).toBeTruthy();
  });

  it("schlaegt bei 800 m „zu Fuß“ vor", async () => {
    mockServer({ strecke: { km: 0.8, minuten: 3 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);

    await formularOeffnen(DOM, MITTAGESSEN);

    expect(verkehrsmittel().value).toBe("fuss");
    expect(feld("Strecke (km)").value).toBe("0,8");
  });

  it("schlaegt bei 12 km „Auto“ vor", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);

    await formularOeffnen(DOM, MITTAGESSEN);

    expect(verkehrsmittel().value).toBe("auto");
    expect(feld("Dauer (Min)").value).toBe("20");
  });

  it("schlaegt Dauer und Strecke beim Wechsel auf die Fähre neu vor", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);
    await formularOeffnen(DOM, MITTAGESSEN);
    const vorher = feld("Dauer (Min)").value;

    fireEvent.change(verkehrsmittel(), { target: { value: "faehre" } });

    expect(verkehrsmittel().value).toBe("faehre");
    expect(feld("Dauer (Min)").value).not.toBe(vorher);
  });

  it("uebernimmt eine von Hand geaenderte Dauer an den Block", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);
    await formularOeffnen(DOM, MITTAGESSEN);

    fireEvent.change(feld("Dauer (Min)"), { target: { value: "45" } });
    await speichern();

    expect(
      screen.getByTestId("transfer-block-transfer-1").textContent,
    ).toContain("45 Min");
  });

  it("legt den Block zwischen die beiden Programmpunkte", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);
    await formularOeffnen(DOM, MITTAGESSEN);

    await speichern();

    const block = screen.getByTestId("transfer-block-transfer-1");
    const oben = Number.parseFloat(block.style.top);
    const domBlock = screen.getByTestId(`activity-block-${DOM.id}`);
    const zielBlock = screen.getByTestId(`activity-block-${MITTAGESSEN.id}`);
    expect(oben).toBeGreaterThanOrEqual(
      Number.parseFloat(domBlock.style.top) +
        Number.parseFloat(domBlock.style.height),
    );
    expect(oben).toBeLessThan(Number.parseFloat(zielBlock.style.top));
  });
});

describe("Fahrrad als achtes Verkehrsmittel (req-059)", () => {
  it("stellt „Fahrrad“ in der Auswahl der Verkehrsmittel zur Wahl", async () => {
    mockServer({ strecke: { km: 3, minuten: 6 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);

    await formularOeffnen(DOM, MITTAGESSEN);

    expect(
      within(verkehrsmittel()).getByRole("option", { name: "Fahrrad" }),
    ).toBeTruthy();
  });
});

describe("Transfer, dessen Fahrzeit nicht in die Luecke passt (req-052)", () => {
  it("legt ihn trotzdem an und weist auf die knappe Zeit hin", async () => {
    // Zwischen beiden Programmpunkten liegen 20 Minuten.
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);
    await formularOeffnen(DOM, MITTAGESSEN);

    fireEvent.change(feld("Dauer (Min)"), { target: { value: "40" } });
    expect(screen.getByTestId("transfer-form-zeit").textContent).toContain(
      "40 Min",
    );
    await speichern();

    expect(
      screen.getByTestId("transfer-block-transfer-1").textContent,
    ).toContain("Zeit reicht nicht");
  });

  it("verschiebt den naechsten Programmpunkt nicht", async () => {
    const { anfragen } = mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);
    const vorher = screen.getByTestId(`activity-block-${MITTAGESSEN.id}`).style
      .top;
    await formularOeffnen(DOM, MITTAGESSEN);

    fireEvent.change(feld("Dauer (Min)"), { target: { value: "40" } });
    await speichern();

    expect(
      screen.getByTestId(`activity-block-${MITTAGESSEN.id}`).style.top,
    ).toBe(vorher);
    // Umgeplant wird nichts von selbst -- kein Programmpunkt wurde angefasst.
    expect(
      anfragen.some((anfrage) => anfrage.url.includes("/api/programmpunkte")),
    ).toBe(false);
  });
});

describe("Transfer ohne Vorschlag (req-052)", () => {
  it("nennt den Grund, wenn einem Programmpunkt die Position fehlt", async () => {
    const { anfragen } = mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, OHNE_POSITION]} />);

    await formularOeffnen(DOM, OHNE_POSITION);

    expect(screen.getByTestId("transfer-form-hinweis").textContent).toContain(
      OHNE_POSITION.title,
    );
    expect(feld("Dauer (Min)").value).toBe("");
    expect(feld("Strecke (km)").value).toBe("");
    expect(anfragen.some((anfrage) => anfrage.url.includes("vorschlag"))).toBe(
      false,
    );
  });

  it("laesst die Angaben ohne Position selbst eintragen und speichern", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(<Planung activities={[DOM, OHNE_POSITION]} />);
    await formularOeffnen(DOM, OHNE_POSITION);

    fireEvent.change(verkehrsmittel(), { target: { value: "bus" } });
    fireEvent.change(feld("Dauer (Min)"), { target: { value: "15" } });
    fireEvent.change(feld("Strecke (km)"), { target: { value: "3,5" } });
    await speichern();

    expect(
      screen.getByTestId("transfer-block-transfer-1").textContent,
    ).toContain("15 Min · 3,5 km");
  });

  it("nennt den Grund, wenn der Routing-Dienst nicht erreichbar ist", async () => {
    mockServer({ strecke: null });
    render(<Planung activities={[DOM, MITTAGESSEN]} />);

    await formularOeffnen(DOM, MITTAGESSEN);

    expect(screen.getByTestId("transfer-form-hinweis").textContent).toContain(
      "Routing-Dienst",
    );

    fireEvent.change(feld("Dauer (Min)"), { target: { value: "25" } });
    fireEvent.change(feld("Strecke (km)"), { target: { value: "9" } });
    await speichern();

    expect(
      screen.getByTestId("transfer-block-transfer-1").textContent,
    ).toContain("25 Min");
  });
});

describe("Vorhandener Transfer (req-052)", () => {
  it("oeffnet ihn ueber das „+“ zum Aendern, statt einen zweiten anzulegen", async () => {
    const { anfragen } = mockServer({ strecke: { km: 12, minuten: 20 } });
    render(
      <Planung activities={[DOM, MITTAGESSEN]} transfers={[VORHANDENER]} />,
    );

    await formularOeffnen(DOM, MITTAGESSEN);
    expect(feld("Bezeichnung").value).toBe(VORHANDENER.title);

    fireEvent.change(feld("Dauer (Min)"), { target: { value: "18" } });
    await speichern();

    expect(screen.getAllByTestId(/^transfer-block-/)).toHaveLength(1);
    expect(
      screen.getByTestId(`transfer-block-${VORHANDENER.id}`).textContent,
    ).toContain("18 Min");
    expect(
      anfragen.filter(
        (anfrage) =>
          anfrage.method === "POST" && anfrage.url.includes("/api/transfers"),
      ),
    ).toHaveLength(0);
  });

  it("laesst sich ueber seinen Block oeffnen und entfernen", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(
      <Planung activities={[DOM, MITTAGESSEN]} transfers={[VORHANDENER]} />,
    );

    fireEvent.click(screen.getByTestId(`transfer-block-${VORHANDENER.id}`));
    await screen.findByTestId("transfer-form");
    fireEvent.click(screen.getByRole("button", { name: "Entfernen" }));

    await waitFor(() =>
      expect(
        screen.queryByTestId(`transfer-block-${VORHANDENER.id}`),
      ).toBeNull(),
    );
  });

  it("verschwindet mit einem der beiden Programmpunkte", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(
      <Planung activities={[DOM, MITTAGESSEN]} transfers={[VORHANDENER]} />,
    );

    fireEvent.click(screen.getByTestId(`remove-activity-${MITTAGESSEN.id}`));

    await waitFor(() =>
      expect(
        screen.queryByTestId(`activity-block-${MITTAGESSEN.id}`),
      ).toBeNull(),
    );
    expect(screen.queryByTestId(`transfer-block-${VORHANDENER.id}`)).toBeNull();
  });

  it("bleibt zwischen beiden, wenn einer auf eine andere Uhrzeit gezogen wird", async () => {
    mockServer({ strecke: { km: 12, minuten: 20 } });
    render(
      <Planung activities={[DOM, MITTAGESSEN]} transfers={[VORHANDENER]} />,
    );

    // Der Dom wandert eine Stunde nach vorn; die Reihenfolge bleibt.
    fireEvent.dragStart(screen.getByTestId(`activity-block-${DOM.id}`));
    fireEvent(
      screen.getByTestId("timeline-grid"),
      new MouseEvent("drop", { bubbles: true, cancelable: true, clientY: 48 }),
    );

    await waitFor(() =>
      expect(screen.getByTestId(`activity-block-${DOM.id}`).style.top).not.toBe(
        "",
      ),
    );
    expect(screen.getByTestId(`transfer-block-${VORHANDENER.id}`)).toBeTruthy();
  });
});

describe("Knopf „Transfers“ (req-052)", () => {
  it("zeigt alle Transfers des gewaehlten Reisetages", async () => {
    const zweiter: Transfer = {
      ...VORHANDENER,
      id: "transfer-zweiter",
      fromActivityId: MITTAGESSEN.id,
      toActivityId: "activity-4",
      title: "Fahrt zum Aussichtspunkt",
      mode: "auto",
    };
    const dritter = programmpunkt(
      "activity-4",
      "Aussichtspunkt",
      "15:00",
      "16:00",
    );
    mockServer();
    render(
      <Planung
        activities={[DOM, MITTAGESSEN, dritter]}
        transfers={[VORHANDENER, zweiter]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Transfers" }));

    const liste = screen.getByTestId("transfer-list");
    expect(within(liste).getByText(VORHANDENER.title)).toBeTruthy();
    expect(within(liste).getByText(zweiter.title)).toBeTruthy();
  });

  it("nennt in der Liste, wenn die Zeit eines Transfers nicht reicht", () => {
    mockServer();
    render(
      <Planung
        activities={[DOM, MITTAGESSEN]}
        transfers={[{ ...VORHANDENER, durationMin: 40 }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Transfers" }));

    expect(
      within(screen.getByTestId("transfer-list")).getByText(
        "Zeit reicht nicht",
      ),
    ).toBeTruthy();
  });
});
