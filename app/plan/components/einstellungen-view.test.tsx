import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { EinstellungenView } from "./einstellungen-view";

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
  state: "in_planung",
};

/** Die Reise braucht immer einen Reiseleiter (req-021). */
const UWE_FUEHRT: TripParticipant = {
  tripId: SUEDITALIEN.id,
  participantId: UWE.id,
  role: "reiseleiter",
};

function zeige() {
  render(
    <EinstellungenView
      trip={SUEDITALIEN}
      participants={[UWE]}
      tripParticipants={[UWE_FUEHRT]}
    />,
  );
}

/**
 * Der Bereich "Einstellungen" traegt seit req-032 nur noch, was die
 * geoeffnete Reise betrifft. Die Personen des Accounts und die
 * Zugangsschluessel sind in den Bereich "Account" gewandert -- hier sind
 * sie nicht mehr, auch nicht zusaetzlich.
 */
describe("EinstellungenView (req-021, req-032)", () => {
  it('zeigt die Karte "Wer fährt mit"', () => {
    zeige();

    expect(
      screen.getByRole("region", { name: "Wer fährt mit" }),
    ).toBeInTheDocument();
  });

  it('zeigt die Karte "Zugangsschlüssel" nicht mehr', () => {
    zeige();

    expect(
      screen.queryByRole("region", { name: "Zugangsschlüssel" }),
    ).not.toBeInTheDocument();
  });

  it('zeigt die Karte "Reiseteilnehmer" nicht mehr', () => {
    zeige();

    expect(
      screen.queryByRole("region", { name: "Reiseteilnehmer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Teilnehmer hinzufügen" }),
    ).not.toBeInTheDocument();
  });

  it("traegt genau diese eine Karte", () => {
    zeige();

    const karten = screen
      .getAllByRole("region")
      .map((bereich) => bereich.getAttribute("aria-label"));
    expect(karten).toEqual(["Einstellungen", "Wer fährt mit"]);
  });
});
