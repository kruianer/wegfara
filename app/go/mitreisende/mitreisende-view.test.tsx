import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant, TripRole } from "@/lib/trip-participants/types";
import type { Invitation } from "@/lib/invitations/types";
import { qrCodeFor } from "@/lib/qr/qr-code";
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

const EINLADUNGS_URL = "https://wegfara.example/einladung?token=abc123";
const EINLADUNG: Invitation = {
  participantId: ANNA.id,
  url: EINLADUNGS_URL,
  qr: qrCodeFor(EINLADUNGS_URL),
  expiresAt: "2026-09-10T12:00:00.000Z",
};

/** Antwortet wie app/api/einladungen/route.ts. */
function antwortetMitEinladung(): ReturnType<typeof vi.fn> {
  return vi.fn(async (url: string) => {
    if (url === "/api/einladungen") {
      return {
        ok: true,
        status: 201,
        json: async () => ({
          invitation: EINLADUNG,
          mail: { status: "keineAdresse" },
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

describe("„Wer fährt mit“ im Begleiter -- Einladen (req-087)", () => {
  async function ladeAnnaEin() {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortetMitEinladung());
    const copyToClipboard = vi.fn(async () => {});
    render(
      <MitreisendeView
        trip={SUEDITALIEN}
        participants={[UWE, ANNA]}
        tripParticipants={VIER}
        copyToClipboard={copyToClipboard}
      />,
    );
    await user.click(
      within(zeile("Anna Lindqvist-Mayrhofer")).getByRole("button", {
        name: "Einladen: Anna Lindqvist-Mayrhofer",
      }),
    );
    return { user, copyToClipboard };
  }

  it("zeigt bei Anna ohne Zugang QR-Code und Link", async () => {
    await ladeAnnaEin();

    const flaeche = await screen.findByTestId("invitation-panel");
    expect(zeile("Anna Lindqvist-Mayrhofer")).toContainElement(flaeche);
    expect(
      within(flaeche).getByRole("img", {
        name: "QR-Code der Einladung für Anna Lindqvist-Mayrhofer",
      }),
    ).toBeInTheDocument();
    expect(within(flaeche).getByTestId("invitation-link")).toHaveTextContent(
      EINLADUNGS_URL,
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/einladungen",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("kopiert den Link mit „Link kopieren“", async () => {
    const { user, copyToClipboard } = await ladeAnnaEin();

    await user.click(
      await screen.findByRole("button", { name: "Link kopieren" }),
    );

    expect(copyToClipboard).toHaveBeenCalledWith(EINLADUNGS_URL);
    expect(
      screen.getByText("Der Link liegt in der Zwischenablage."),
    ).toBeInTheDocument();
  });

  it("sagt, dass keine E-Mail hinausging, wenn keine Adresse hinterlegt ist", async () => {
    await ladeAnnaEin();

    expect(await screen.findByTestId("invitation-mail")).toBeInTheDocument();
  });

  it("schliesst die Einladung wieder", async () => {
    const { user } = await ladeAnnaEin();

    await user.click(await screen.findByRole("button", { name: "Schließen" }));

    expect(screen.queryByTestId("invitation-panel")).toBeNull();
  });
});

describe("„Wer fährt mit“ im Begleiter -- hinzufügen (req-087)", () => {
  it("bietet Ben, der zum Account gehoert, unter „Fährt nicht mit“ an", () => {
    ansicht();

    const abseits = screen.getByRole("region", { name: "Fährt nicht mit" });
    expect(within(abseits).getByText("Ben Hartmann")).toBeInTheDocument();
    expect(
      within(abseits).getByRole("button", {
        name: "Zur Reise hinzufügen: Ben Hartmann",
      }),
    ).toHaveTextContent("Mitfahren");
  });

  it("stellt Ben nach dem Hinzufuegen als Teilnehmer in die Liste", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    ansicht();

    await user.click(
      screen.getByRole("button", {
        name: "Zur Reise hinzufügen: Ben Hartmann",
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/trip-participants",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          tripId: SUEDITALIEN.id,
          participantId: BEN.id,
          role: "teilnehmer",
        }),
      }),
    );
    expect(await screen.findAllByTestId("mitreisender")).toHaveLength(5);
    expect(
      (screen.getByLabelText("Rolle: Ben Hartmann") as HTMLSelectElement).value,
    ).toBe("teilnehmer");
    expect(
      screen.queryByRole("region", { name: "Fährt nicht mit" }),
    ).not.toBeInTheDocument();
  });

  it("laesst Ben draussen, wenn das Speichern scheitert", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      })),
    );
    ansicht();

    await user.click(
      screen.getByRole("button", {
        name: "Zur Reise hinzufügen: Ben Hartmann",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die Zuordnung konnte nicht gespeichert werden.",
    );
    expect(screen.queryByLabelText("Rolle: Ben Hartmann")).toBeNull();
  });
});

describe("„Wer fährt mit“ im Begleiter -- mindestens ein Reiseleiter (req-087)", () => {
  it("lehnt ab, wenn sich der einzige Reiseleiter zum Teilnehmer macht", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    ansicht();

    await user.selectOptions(
      screen.getByLabelText("Rolle: Uwe Kremmel"),
      "teilnehmer",
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Die Reise braucht mindestens einen Reiseleiter.",
    );
    expect(
      (screen.getByLabelText("Rolle: Uwe Kremmel") as HTMLSelectElement).value,
    ).toBe("reiseleiter");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("nennt den Grund auch, wenn erst die Schnittstelle ablehnt", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ error: "lastLeader" }),
      })),
    );
    // Hier weiss die Ansicht von einem zweiten Reiseleiter, den es auf dem
    // Server nicht mehr gibt -- etwa weil ihn im Planer jemand herabgestuft
    // hat.
    ansicht([...VIER.slice(0, 2), zuordnung(CLARA, "reiseleiter")]);

    await user.selectOptions(
      screen.getByLabelText("Rolle: Uwe Kremmel"),
      "teilnehmer",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die Reise braucht mindestens einen Reiseleiter.",
    );
    expect(
      (screen.getByLabelText("Rolle: Uwe Kremmel") as HTMLSelectElement).value,
    ).toBe("reiseleiter");
  });

  it("laesst den einzigen Reiseleiter nicht aus der Reise entfernen", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    ansicht();

    await user.click(
      screen.getByRole("button", {
        name: "Aus der Reise entfernen: Uwe Kremmel",
      }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Die Reise braucht mindestens einen Reiseleiter.",
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("„Wer fährt mit“ im Begleiter -- entfernen (req-087)", () => {
  it("fragt mit Namen und Reise zurueck und nimmt die Person erst dann heraus", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    ansicht();

    await user.click(
      screen.getByRole("button", { name: "Aus der Reise entfernen: Clari" }),
    );

    const rueckfrage = screen.getByRole("alertdialog", {
      name: "Aus der Reise entfernen",
    });
    expect(rueckfrage).toHaveTextContent(
      "„Clari“ fährt bei „Süditalien Rundreise“ nicht mehr mit.",
    );
    expect(fetch).not.toHaveBeenCalled();

    await user.click(
      within(rueckfrage).getByRole("button", { name: "Entfernen" }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/trip-participants",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({
          tripId: SUEDITALIEN.id,
          participantId: CLARA.id,
        }),
      }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByLabelText("Rolle: Clari")).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Fährt nicht mit" })).getByText(
        "Clari",
      ),
    ).toBeInTheDocument();
  });

  it("laesst die Person bei „Abbrechen“ in der Reise", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    ansicht();

    await user.click(
      screen.getByRole("button", { name: "Aus der Reise entfernen: Clari" }),
    );
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByLabelText("Rolle: Clari")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
