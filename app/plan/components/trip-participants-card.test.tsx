import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant, TripRole } from "@/lib/trip-participants/types";
import { TRIP_PARTICIPANT_ERRORS } from "@/lib/trip-participants/rules";
import { TripParticipantsCard } from "./trip-participants-card";

const UWE: Participant = {
  id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
  accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
  name: "Uwe Kremmel",
  nickname: null,
  email: "uwe@kremmel.org",
  phone: null,
  iban: null,
  loginEnabled: true,
};

const CLARA: Participant = {
  ...UWE,
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
  name: "Clara Berger",
  email: null,
  loginEnabled: false,
};

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
};

function zuordnung(participant: Participant, role: TripRole): TripParticipant {
  return {
    tripId: SUEDITALIEN.id,
    participantId: participant.id,
    role,
  };
}

const UWE_FUEHRT = zuordnung(UWE, "reiseleiter");

/**
 * Die Schnittstelle antwortet wie app/api/trip-participants/route.ts -- dort
 * wird sie gegen die echte Datenbank geprueft. Hier zaehlt, was die Karte
 * daraus macht.
 */
function antwortet(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

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

/**
 * Die Karte haelt ihren Zustand nicht selbst -- im Planer liegt er in
 * PlanView. Diese Huelle uebernimmt das fuer den Test.
 */
function Karte({
  participants = [UWE, CLARA],
  tripParticipants = [UWE_FUEHRT],
}: {
  participants?: Participant[];
  tripParticipants?: TripParticipant[];
}) {
  const [assignments, setAssignments] = useState(tripParticipants);
  return (
    <TripParticipantsCard
      trip={SUEDITALIEN}
      participants={participants}
      tripParticipants={assignments}
      onChange={setAssignments}
    />
  );
}

function karte(): HTMLElement {
  return screen.getByRole("region", { name: "Wer fährt mit" });
}

function rolle(name: string): HTMLSelectElement {
  return within(karte()).getByLabelText(`Rolle: ${name}`) as HTMLSelectElement;
}

beforeEach(() => {
  vi.stubGlobal("fetch", antwortetWieGesendet());
});

describe("Karte „Wer fährt mit“ (req-021)", () => {
  it("zeigt alle Personen des Accounts", () => {
    render(<Karte />);

    expect(within(karte()).getByText("Uwe Kremmel")).toBeInTheDocument();
    expect(within(karte()).getByText("Clara Berger")).toBeInTheDocument();
  });

  it("nennt im Titel die Zahl der zugeordneten Personen", () => {
    render(
      <Karte tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "teilnehmer")]} />,
    );

    expect(
      within(karte()).getByRole("heading", { name: /Wer fährt mit/ }),
    ).toHaveTextContent("2 Personen");
  });

  it("zählt nur die Zugeordneten, nicht alle Personen des Accounts", () => {
    render(<Karte />);

    expect(
      within(karte()).getByRole("heading", { name: /Wer fährt mit/ }),
    ).toHaveTextContent("1 Person");
  });

  it("setzt die nicht zugeordneten Personen von den zugeordneten ab", () => {
    render(<Karte />);

    const abgesetzt = within(karte())
      .getByRole("heading", { name: "Fährt nicht mit" })
      .closest("div") as HTMLElement;
    expect(within(abgesetzt).getByText("Clara Berger")).toBeInTheDocument();
    expect(within(abgesetzt).queryByText("Uwe Kremmel")).toBeNull();
  });

  it("ordnet eine Person der Reise zu", async () => {
    const fetchMock = antwortetWieGesendet();
    vi.stubGlobal("fetch", fetchMock);
    render(<Karte />);

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Zur Reise hinzufügen: Clara Berger",
      }),
    );

    expect(await screen.findByLabelText("Rolle: Clara Berger")).toHaveValue(
      "teilnehmer",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/trip-participants",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("nennt nach dem Zuordnen die neue Zahl im Titel", async () => {
    render(<Karte />);

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Zur Reise hinzufügen: Clara Berger",
      }),
    );

    await waitFor(() =>
      expect(
        within(karte()).getByRole("heading", { name: /Wer fährt mit/ }),
      ).toHaveTextContent("2 Personen"),
    );
  });

  it("setzt die Rolle einer zugeordneten Person auf „Reiseleiter“", async () => {
    render(
      <Karte tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "teilnehmer")]} />,
    );

    await userEvent.selectOptions(rolle("Clara Berger"), "reiseleiter");

    await waitFor(() =>
      expect(rolle("Clara Berger")).toHaveValue("reiseleiter"),
    );
    expect(
      within(rolle("Clara Berger")).getByRole("option", {
        name: "Reiseleiter",
      }),
    ).toHaveProperty("selected", true);
  });

  it("lässt den einzigen Reiseleiter Reiseleiter bleiben", async () => {
    const fetchMock = antwortetWieGesendet();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <Karte tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "teilnehmer")]} />,
    );

    await userEvent.selectOptions(rolle("Uwe Kremmel"), "teilnehmer");

    expect(rolle("Uwe Kremmel")).toHaveValue("reiseleiter");
    expect(
      await within(karte()).findByText(TRIP_PARTICIPANT_ERRORS.lastLeader),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stuft einen von zwei Reiseleitern herab", async () => {
    render(
      <Karte
        tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "reiseleiter")]}
      />,
    );

    await userEvent.selectOptions(rolle("Uwe Kremmel"), "teilnehmer");

    await waitFor(() => expect(rolle("Uwe Kremmel")).toHaveValue("teilnehmer"));
  });

  it("lässt den einzigen Reiseleiter zugeordnet bleiben", async () => {
    const fetchMock = antwortetWieGesendet();
    vi.stubGlobal("fetch", fetchMock);
    render(<Karte />);

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Aus der Reise entfernen: Uwe Kremmel",
      }),
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(rolle("Uwe Kremmel")).toHaveValue("reiseleiter");
    expect(
      within(karte()).getByText(TRIP_PARTICIPANT_ERRORS.lastLeader),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nennt in der Rückfrage vor dem Entfernen den Namen der Person", async () => {
    render(
      <Karte tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "teilnehmer")]} />,
    );

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Aus der Reise entfernen: Clara Berger",
      }),
    );

    const rueckfrage = screen.getByRole("alertdialog");
    expect(rueckfrage).toHaveTextContent("Clara Berger");
    expect(rueckfrage).toHaveTextContent("Süditalien Rundreise");
  });

  it("nennt die Person in der Rückfrage beim Nicknamen (req-020)", async () => {
    const clari = { ...CLARA, nickname: "Clari" };
    render(
      <Karte
        participants={[UWE, clari]}
        tripParticipants={[UWE_FUEHRT, zuordnung(clari, "teilnehmer")]}
      />,
    );

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Aus der Reise entfernen: Clari",
      }),
    );

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Clari");
  });

  it("entfernt die Person erst nach der Bestätigung", async () => {
    render(
      <Karte tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "teilnehmer")]} />,
    );

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Aus der Reise entfernen: Clara Berger",
      }),
    );
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Entfernen",
      }),
    );

    await waitFor(() =>
      expect(
        within(karte()).queryByLabelText("Rolle: Clara Berger"),
      ).toBeNull(),
    );
    expect(
      within(karte()).getByRole("button", {
        name: "Zur Reise hinzufügen: Clara Berger",
      }),
    ).toBeInTheDocument();
  });

  it("lässt die Person zugeordnet, wenn die Rückfrage abgebrochen wird", async () => {
    const fetchMock = antwortetWieGesendet();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <Karte tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "teilnehmer")]} />,
    );

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Aus der Reise entfernen: Clara Berger",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(rolle("Clara Berger")).toHaveValue("teilnehmer");
  });

  it("weist hin, wenn die Schnittstelle den letzten Reiseleiter schützt", async () => {
    // Der Zustand der Karte kann veraltet sein -- die Datenbank entscheidet.
    vi.stubGlobal("fetch", antwortet(409, { error: "lastLeader" }));
    render(
      <Karte
        tripParticipants={[UWE_FUEHRT, zuordnung(CLARA, "reiseleiter")]}
      />,
    );

    await userEvent.selectOptions(rolle("Clara Berger"), "teilnehmer");

    expect(
      await within(karte()).findByText(TRIP_PARTICIPANT_ERRORS.lastLeader),
    ).toBeInTheDocument();
    expect(rolle("Clara Berger")).toHaveValue("reiseleiter");
  });

  it("weist hin, wenn die Zuordnung nicht gespeichert werden kann", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("kein Netz");
      }),
    );
    render(<Karte />);

    await userEvent.click(
      within(karte()).getByRole("button", {
        name: "Zur Reise hinzufügen: Clara Berger",
      }),
    );

    expect(
      await within(karte()).findByText(TRIP_PARTICIPANT_ERRORS.failed),
    ).toBeInTheDocument();
    expect(within(karte()).queryByLabelText("Rolle: Clara Berger")).toBeNull();
  });
});
