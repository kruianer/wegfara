import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant, TripRole } from "@/lib/trip-participants/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import { MitreisendeView, type Mitreisender } from "./mitreisende-view";

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

const UWE: Mitreisender = {
  id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
  name: "Uwe Kremmel",
  nickname: null,
  loginEnabled: true,
};
const ANNA: Mitreisender = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
  name: "Anna Lindqvist-Mayrhofer",
  nickname: null,
  loginEnabled: false,
};
const CLARA: Mitreisender = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f2222",
  name: "Clara Berger",
  nickname: "Clari",
  loginEnabled: true,
};
const DAVID: Mitreisender = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f3333",
  name: "David Oberhuber",
  nickname: null,
  loginEnabled: false,
};
const BEN: Mitreisender = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f4444",
  name: "Ben Hartmann",
  nickname: null,
  loginEnabled: false,
};

function zuordnung(person: Mitreisender, role: TripRole): TripParticipant {
  return { tripId: SUEDITALIEN.id, participantId: person.id, role };
}

const VIER = [
  zuordnung(UWE, "reiseleiter"),
  zuordnung(ANNA, "teilnehmer"),
  zuordnung(CLARA, "teilnehmer"),
  zuordnung(DAVID, "teilnehmer"),
];

/** Antwortet auf jede Zuordnung mit dem, was gesendet wurde. */
function antwortetWieGesendet(): ReturnType<typeof vi.fn> {
  return vi.fn(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body ?? "{}"));
    return {
      ok: true,
      status: 200,
      json: async () => ({ tripParticipant: body, status: "ok" }),
    };
  });
}

function ansicht(tripParticipants: TripParticipant[] = VIER) {
  return render(
    <MitreisendeView
      trip={SUEDITALIEN}
      participants={[UWE, ANNA, CLARA, DAVID, BEN]}
      tripParticipants={tripParticipants}
    />,
  );
}

function zeile(name: string): HTMLElement {
  return screen.getByLabelText(`Rolle: ${name}`).closest("li") as HTMLElement;
}

beforeEach(() => {
  vi.stubGlobal("fetch", antwortetWieGesendet());
});

describe("„Wer fährt mit“ im Begleiter -- die Liste (req-087)", () => {
  it("nennt die Reise, die im Begleiter offen ist", () => {
    ansicht();

    expect(
      screen.getByRole("heading", { level: 1, name: "Wer fährt mit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Süditalien Rundreise")).toBeInTheDocument();
  });

  it("zeigt bei jeder der vier Personen Name, Rolle, Zugangshinweis und „Einladen“", () => {
    ansicht();

    const personen = screen.getAllByTestId("mitreisender");
    expect(personen).toHaveLength(4);

    const erwartet = [
      ["Uwe Kremmel", "Reiseleiter", "Zugang"],
      ["Anna Lindqvist-Mayrhofer", "Teilnehmer", "Kein Zugang"],
      ["Clari", "Teilnehmer", "Zugang"],
      ["David Oberhuber", "Teilnehmer", "Kein Zugang"],
    ] as const;
    erwartet.forEach(([name, rolle, zugang], index) => {
      const person = personen[index];
      expect(within(person).getByText(name)).toBeInTheDocument();
      const auswahl = within(person).getByLabelText(
        `Rolle: ${name}`,
      ) as HTMLSelectElement;
      expect(auswahl.selectedOptions[0].textContent).toBe(rolle);
      expect(within(person).getByText(zugang, { exact: true })).toBeVisible();
      expect(
        within(person).getByRole("button", { name: `Einladen: ${name}` }),
      ).toHaveTextContent("Einladen");
    });
  });

  it("zaehlt die Personen der Reise", () => {
    ansicht();

    expect(
      screen.getByRole("heading", { level: 2, name: "4 Personen" }),
    ).toBeInTheDocument();
  });

  it("listet wer nicht mitfaehrt nicht unter den Mitreisenden", () => {
    ansicht();

    expect(screen.queryByLabelText("Rolle: Ben Hartmann")).toBeNull();
  });

  it("sagt, wenn noch niemand eingeteilt ist", () => {
    ansicht([]);

    expect(
      screen.getByText("Für diese Reise ist noch niemand eingeteilt."),
    ).toBeInTheDocument();
  });

  it("aendert die Rolle ueber dieselbe Schnittstelle wie der Planer", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    ansicht();

    await user.selectOptions(
      within(zeile("Clari")).getByLabelText("Rolle: Clari"),
      "reiseleiter",
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/trip-participants",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          tripId: SUEDITALIEN.id,
          participantId: CLARA.id,
          role: "reiseleiter",
        }),
      }),
    );
    expect(
      (
        within(zeile("Clari")).getByLabelText(
          "Rolle: Clari",
        ) as HTMLSelectElement
      ).value,
    ).toBe("reiseleiter");
  });
});
