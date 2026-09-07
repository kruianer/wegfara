import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { ReisedetailsView } from "./reisedetails-view";
import {
  INTERESSE_LABEL,
  LEERE_PRAEFERENZEN,
  PRAEFERENZ_TEXT_MAX_LENGTH,
} from "@/lib/trips/praeferenzen";

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
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
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
 * Das Reisetempo (req-056) steht bei den Eckdaten: es steuert, wie voll die
 * KI einen Tag plant. Von Hand verplant der Reiseleiter POIs weiterhin, wie
 * er will.
 */
describe("Reisetempo in den Reisedetails (req-056)", () => {
  it("zeigt das gewaehlte Reisetempo der Reise", () => {
    zeige({ ...SUEDITALIEN, tempo: "entspannt" });

    expect(screen.getByLabelText("Reisetempo")).toHaveValue("entspannt");
  });

  it("stellt genau die drei Tempi zur Wahl, mit ihren Zahlen dahinter", () => {
    zeige();

    const auswahl = screen.getByLabelText("Reisetempo");
    expect(
      [...auswahl.querySelectorAll("option")].map(
        (option) => option.textContent,
      ),
    ).toEqual([
      "Entspannt — 6 Stunden am Tag, höchstens 2 gleiche POI-Typen",
      "Ausgewogen — 10 Stunden am Tag, höchstens 3 gleiche POI-Typen",
      "Dicht — 12 Stunden am Tag, höchstens 4 gleiche POI-Typen",
    ]);
  });

  it("steht bei einer neuen Reise auf „Ausgewogen“", () => {
    zeige(null);

    expect(screen.getByLabelText("Reisetempo")).toHaveDisplayValue(
      /^Ausgewogen/,
    );
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

/**
 * Die Praeferenzen in den Reisedetails (req-057): worauf die Gruppe Wert
 * legt. Alle vier sind freiwillig und wirken ausschliesslich auf die
 * KI-Suche.
 */
describe("Praeferenzen in den Reisedetails (req-057)", () => {
  it("bietet die acht Interessen zum Ankreuzen", () => {
    zeige();

    for (const label of Object.values(INTERESSE_LABEL)) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("laesst „Natur & Wandern“ ankreuzen", async () => {
    const user = userEvent.setup();
    zeige();

    await user.click(screen.getByLabelText("Natur & Wandern"));

    expect(screen.getByLabelText("Natur & Wandern")).toBeChecked();
  });

  it("zeigt ein gespeichertes Interesse wieder angekreuzt", () => {
    zeige({
      ...SUEDITALIEN,
      praeferenzen: { ...LEERE_PRAEFERENZEN, interessen: ["natur_wandern"] },
    });

    expect(screen.getByLabelText("Natur & Wandern")).toBeChecked();
    expect(screen.getByLabelText("Nachtleben")).not.toBeChecked();
  });

  it("zeigt die gespeicherten Saetze wieder", () => {
    zeige({
      ...SUEDITALIEN,
      praeferenzen: {
        ...LEERE_PRAEFERENZEN,
        wertAuf: "Wir mögen es ruhig.",
        nichtWollen: "keine Museen",
      },
    });

    expect(screen.getByLabelText("Worauf legen wir Wert")).toHaveValue(
      "Wir mögen es ruhig.",
    );
    expect(screen.getByLabelText("Was wir nicht wollen")).toHaveValue(
      "keine Museen",
    );
  });

  it("steht bei einer neuen Reise auf der Mindestbewertung 0", () => {
    zeige(null);

    expect(screen.getByLabelText("Mindestbewertung")).toHaveValue("0");
    expect(screen.getByLabelText("Mindestbewertung")).toHaveDisplayValue(
      "0 — keine Einschränkung",
    );
  });

  it("stellt die Mindestbewertung in Halbschritten bis 5 zur Wahl", () => {
    zeige();

    const auswahl = screen.getByLabelText("Mindestbewertung");
    const werte = [...auswahl.querySelectorAll("option")].map((o) => o.value);
    expect(werte).toEqual([
      "0",
      "0.5",
      "1",
      "1.5",
      "2",
      "2.5",
      "3",
      "3.5",
      "4",
      "4.5",
      "5",
    ]);
  });

  it("zeigt eine gespeicherte Mindestbewertung wieder", () => {
    zeige({
      ...SUEDITALIEN,
      praeferenzen: { ...LEERE_PRAEFERENZEN, mindestbewertung: 4 },
    });

    expect(screen.getByLabelText("Mindestbewertung")).toHaveDisplayValue(
      "4,0 von 5",
    );
  });

  it(`nimmt ${PRAEFERENZ_TEXT_MAX_LENGTH} Zeichen bei „Worauf legen wir Wert“ an`, async () => {
    const user = userEvent.setup();
    zeige();
    const feld = screen.getByLabelText("Worauf legen wir Wert");

    await user.click(feld);
    await user.paste("x".repeat(PRAEFERENZ_TEXT_MAX_LENGTH));
    await user.tab();

    expect(feld).toHaveValue("x".repeat(PRAEFERENZ_TEXT_MAX_LENGTH));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  /**
   * Die Eingabe wird schon beim Verlassen des Feldes zurueckgewiesen -- das
   * Feld nimmt gar nicht erst mehr Zeichen an, und die Rueckmeldung nennt
   * die Grenze (req-057, Akzeptanzkriterien).
   */
  it(`weist ${PRAEFERENZ_TEXT_MAX_LENGTH + 1} Zeichen zurueck`, async () => {
    const user = userEvent.setup();
    zeige();
    const feld = screen.getByLabelText("Worauf legen wir Wert");

    await user.click(feld);
    await user.paste("x".repeat(PRAEFERENZ_TEXT_MAX_LENGTH + 1));
    await user.tab();

    expect((feld as HTMLTextAreaElement).value.length).toBe(
      PRAEFERENZ_TEXT_MAX_LENGTH,
    );
  });
});
