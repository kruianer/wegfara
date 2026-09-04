import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { ReisedetailsView } from "./reisedetails-view";

const UWE: Participant = {
  id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
  accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
  name: "Uwe Kremmel",
  nickname: null,
  email: "uwe@kremmel.org",
  phone: null,
  iban: null,
  loginEnabled: true,
  accountAdmin: true,
};

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "Wanderschuhe mitnehmen.",
  state: "in_planung",
};

/** Die Reise braucht immer einen Reiseleiter (req-021). */
const UWE_FUEHRT: TripParticipant = {
  tripId: SUEDITALIEN.id,
  participantId: UWE.id,
  role: "reiseleiter",
};

function zeige(trip: Trip | null = SUEDITALIEN) {
  render(
    <ReisedetailsView
      trip={trip}
      participants={[UWE]}
      tripParticipants={[UWE_FUEHRT]}
      onTripSaved={vi.fn()}
      onCancelNewTrip={vi.fn()}
      onDeleteTrip={vi.fn()}
      onTripStateChanged={vi.fn()}
    />,
  );
}

/**
 * Der Bereich "Reisedetails" (req-033, zuvor "Einstellungen") zeigt alles
 * zur geoeffneten Reise an einer Stelle. Was zum Account gehoert, steht seit
 * req-032 im Bereich "Account" -- hier nicht, auch nicht zusaetzlich.
 */
describe("ReisedetailsView (req-033)", () => {
  it('zeigt die Karte "Eckdaten der Reise" mit Titel und Beschreibung', () => {
    zeige();

    expect(
      screen.getByRole("region", { name: "Eckdaten der Reise" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Titel")).toHaveValue("Süditalien Rundreise");
    expect(screen.getByLabelText("Beschreibung")).toHaveValue(
      "Wanderschuhe mitnehmen.",
    );
  });

  it('zeigt die Karte "Wer fährt mit"', () => {
    zeige();

    expect(
      screen.getByRole("region", { name: "Wer fährt mit" }),
    ).toBeInTheDocument();
  });

  it("lässt den Zustand der Reise dort setzen", () => {
    zeige();

    expect(
      screen.getByLabelText("Zustand: Süditalien Rundreise"),
    ).toHaveDisplayValue("In Planung");
  });

  it('zeigt die Karte "Zugangsschlüssel" nicht', () => {
    zeige();

    expect(
      screen.queryByRole("region", { name: "Zugangsschlüssel" }),
    ).not.toBeInTheDocument();
  });

  it('zeigt die Karte "Reiseteilnehmer" des Accounts nicht', () => {
    zeige();

    expect(
      screen.queryByRole("region", { name: "Reiseteilnehmer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Teilnehmer hinzufügen" }),
    ).not.toBeInTheDocument();
  });

  it("traegt genau diese beiden Karten", () => {
    zeige();

    const karten = screen
      .getAllByRole("region")
      .map((bereich) => bereich.getAttribute("aria-label"));
    expect(karten).toEqual([
      "Reisedetails",
      "Eckdaten der Reise",
      "Wer fährt mit",
    ]);
  });
});

/**
 * Eine neue Reise entsteht erst mit dem Speichern (req-033, Constraints) --
 * bis dahin gibt es nichts, dem jemand zugeordnet oder dessen Zustand
 * gesetzt werden koennte.
 */
describe("ReisedetailsView, neue Reise (req-033)", () => {
  it("zeigt leere Felder", () => {
    zeige(null);

    expect(screen.getByLabelText("Titel")).toHaveValue("");
    expect(screen.getByLabelText("Hauptort")).toHaveValue("");
    expect(screen.getByLabelText("Beginn")).toHaveValue("");
    expect(screen.getByLabelText("Ende")).toHaveValue("");
    expect(screen.getByLabelText("Beschreibung")).toHaveValue("");
  });

  it("bietet den Zustand noch nicht an", () => {
    zeige(null);

    expect(screen.queryByText("Zustand")).not.toBeInTheDocument();
  });

  it('zeigt die Karte "Wer fährt mit" noch nicht', () => {
    zeige(null);

    expect(
      screen.queryByRole("region", { name: "Wer fährt mit" }),
    ).not.toBeInTheDocument();
  });

  it("bietet kein Löschen an", () => {
    zeige(null);

    expect(
      screen.queryByRole("button", { name: "Reise löschen" }),
    ).not.toBeInTheDocument();
  });
});
