import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

/**
 * Das Ende folgt dem Beginn (req-067): das heutige Datum ist fuer das Ende
 * einer Reise nie die richtige Antwort -- es liegt vor dem Beginn. Sobald ein
 * Beginn dasteht und das Ende leer ist, wird es auf Beginn plus sieben Tage
 * vorbelegt.
 */
describe("Vorbelegtes Ende in den Reisedetails (req-067)", () => {
  function beginnFeld(): HTMLInputElement {
    return screen.getByLabelText("Beginn") as HTMLInputElement;
  }

  function endeFeld(): HTMLInputElement {
    return screen.getByLabelText("Ende") as HTMLInputElement;
  }

  function trageEin(feld: HTMLInputElement, datum: string) {
    fireEvent.change(feld, { target: { value: datum } });
  }

  /** Der Erste desselben Monats im naechsten Jahr -- nie der heutige Monat. */
  function beginnFernVonHeute(): string {
    const heute = new Date();
    const monat = String(heute.getMonth() + 1).padStart(2, "0");
    return `${heute.getFullYear() + 1}-${monat}-01`;
  }

  function monatVon(datum: string): string {
    return datum.slice(0, 7);
  }

  it("belegt das leere Ende mit dem Beginn plus sieben Tagen vor", () => {
    zeige(null);

    trageEin(beginnFeld(), "2027-03-01");

    expect(endeFeld()).toHaveValue("2027-03-08");
  });

  /**
   * Der Kalender eines Datumsfeldes klappt im Monat seines Wertes auf. Steht
   * dort der Vorschlag, ist der heutige Monat aus dem Spiel -- niemand
   * scrollt mehr von heute aus Monate weit.
   */
  it("stellt das Ende auf den Monat des Vorschlags, nicht auf den heutigen", () => {
    zeige(null);
    const beginn = beginnFernVonHeute();

    trageEin(beginnFeld(), beginn);

    const heutigerMonat = new Date().toISOString().slice(0, 7);
    expect(endeFeld().value).not.toBe("");
    expect(monatVon(endeFeld().value)).toBe(monatVon(beginn));
    expect(monatVon(endeFeld().value)).not.toBe(heutigerMonat);
  });
});

/**
 * Der Vorschlag ist nur ein Vorschlag (req-067): er erscheint allein,
 * solange das Ende leer ist. Ein selbst eingetragenes Ende wird nie
 * ersetzt -- auch dann nicht, wenn der Beginn nachtraeglich wechselt.
 */
describe("Selbst eingetragenes Ende in den Reisedetails (req-067)", () => {
  function beginnFeld(): HTMLInputElement {
    return screen.getByLabelText("Beginn") as HTMLInputElement;
  }

  function endeFeld(): HTMLInputElement {
    return screen.getByLabelText("Ende") as HTMLInputElement;
  }

  function trageEin(feld: HTMLInputElement, datum: string) {
    fireEvent.change(feld, { target: { value: datum } });
  }

  it("laesst es stehen, wenn der Beginn danach geaendert wird", () => {
    zeige(null);
    trageEin(beginnFeld(), "2027-03-01");
    trageEin(endeFeld(), "2027-03-20");

    trageEin(beginnFeld(), "2027-04-10");

    expect(endeFeld()).toHaveValue("2027-03-20");
  });

  it("ersetzt es nicht durch den Beginn plus sieben Tage", () => {
    zeige(null);
    trageEin(endeFeld(), "2027-03-31");

    trageEin(beginnFeld(), "2027-03-01");

    expect(endeFeld()).toHaveValue("2027-03-31");
    expect(endeFeld()).not.toHaveValue("2027-03-08");
  });
});

/**
 * Der Vorschlag laesst sich wie jedes Datum aendern (req-067) -- was dann
 * dasteht, ist meine Eingabe und nichts anderes. Sie geht auch so ins
 * Speichern, nicht etwa der Vorschlag.
 */
describe("Geaendertes Ende in den Reisedetails (req-067)", () => {
  const FLORENZ = {
    name: "Florenz",
    context: "Toskana, Italien",
    lat: 43.7696,
    lng: 11.2558,
    address: "",
    art: "place/city",
  };

  function beginnFeld(): HTMLInputElement {
    return screen.getByLabelText("Beginn") as HTMLInputElement;
  }

  function endeFeld(): HTMLInputElement {
    return screen.getByLabelText("Ende") as HTMLInputElement;
  }

  function trageEin(feld: HTMLInputElement, datum: string) {
    fireEvent.change(feld, { target: { value: datum } });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uebernimmt meine Eingabe anstelle des Vorschlags", () => {
    zeige(null);
    trageEin(beginnFeld(), "2027-03-01");
    expect(endeFeld()).toHaveValue("2027-03-08");

    trageEin(endeFeld(), "2027-03-15");

    expect(endeFeld()).toHaveValue("2027-03-15");
  });

  it("speichert meine Eingabe, nicht den Vorschlag", async () => {
    const user = userEvent.setup();
    const angefragt: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        angefragt.push({
          url,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        if (url.startsWith("/api/place-search")) {
          return new Response(JSON.stringify({ places: [FLORENZ] }));
        }
        return new Response(
          JSON.stringify({ trip: { ...SUEDITALIEN }, tripParticipant: null }),
        );
      }),
    );
    zeige(null);

    await user.type(screen.getByLabelText("Titel"), "Toskana im Frühling");
    // Der Hauptort entsteht ausschliesslich ueber die Ortssuche (req-017).
    await user.type(screen.getByLabelText("Hauptort"), "Florenz");
    await user.click(await screen.findByRole("button", { name: /Florenz/ }));
    trageEin(beginnFeld(), "2027-03-01");
    trageEin(endeFeld(), "2027-03-15");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    const gespeichert = angefragt.find(
      (anfrage) => anfrage.url === "/api/trips",
    );
    expect(gespeichert?.body).toMatchObject({
      startDate: "2027-03-01",
      endDate: "2027-03-15",
    });
  });
});

/**
 * Der Vorschlag gehoert zum Anlegen (req-067). Eine bestehende Reise hat
 * ihr Ende laengst -- wer an ihrem Beginn dreht, findet es unveraendert
 * wieder; die Pruefung aus req-033 bleibt daneben bestehen.
 */
describe("Bestehende Reise, Beginn geaendert (req-067)", () => {
  it("laesst das gefuellte Ende unveraendert", () => {
    zeige();
    const beginn = screen.getByLabelText("Beginn");
    expect(screen.getByLabelText("Ende")).toHaveValue(SUEDITALIEN.endDate);

    fireEvent.change(beginn, { target: { value: "2026-07-20" } });

    expect(beginn).toHaveValue("2026-07-20");
    expect(screen.getByLabelText("Ende")).toHaveValue(SUEDITALIEN.endDate);
  });

  /** Auch ein Beginn nach dem Ende ruehrt es nicht an -- er wird beim
   *  Speichern zurueckgewiesen (req-033), nicht stillschweigend verschoben. */
  it("verschiebt es auch dann nicht, wenn der Beginn dahinter rutscht", () => {
    zeige();

    fireEvent.change(screen.getByLabelText("Beginn"), {
      target: { value: "2026-08-01" },
    });

    expect(screen.getByLabelText("Ende")).toHaveValue(SUEDITALIEN.endDate);
  });
});

/**
 * Wie lang die Reise wird, steht schon beim Eintragen da (bug-050). Vorher
 * fiel die Zahl der Tage erst im Planer auf -- und dann stand die Reise
 * laengst falsch in der Datenbank.
 */
describe("Laenge der Reise in den Reisedetails (bug-050)", () => {
  function trageZeitraumEin(startDate: string, endDate: string) {
    fireEvent.change(screen.getByLabelText("Beginn"), {
      target: { value: startDate },
    });
    fireEvent.change(screen.getByLabelText("Ende"), {
      target: { value: endDate },
    });
  }

  it("nennt die Zahl der Tage zum eingetragenen Zeitraum", () => {
    zeige(null);

    trageZeitraumEin("2026-10-25", "2026-10-26");

    expect(screen.getByTestId("reise-laenge")).toHaveTextContent(
      "Die Reise umfasst 2 Tage.",
    );
  });

  /** Der Fall aus bug-050: beim Ende rutscht die Jahreszahl mit. */
  it("zeigt die 367 Tage, sobald das Jahr des Endes verrutscht", () => {
    zeige(null);
    trageZeitraumEin("2026-10-25", "2026-10-26");

    fireEvent.change(screen.getByLabelText("Ende"), {
      target: { value: "2027-10-26" },
    });

    expect(screen.getByTestId("reise-laenge")).toHaveTextContent("367 Tage");
  });

  it("nennt auch die Laenge einer bestehenden Reise", () => {
    zeige();

    expect(screen.getByTestId("reise-laenge")).toHaveTextContent("6 Tage");
  });

  it("nennt nichts, solange der Zeitraum unvollstaendig ist", () => {
    zeige(null);

    expect(screen.queryByTestId("reise-laenge")).not.toBeInTheDocument();
  });

  it("nennt nichts, wenn das Ende vor dem Beginn liegt", () => {
    zeige(null);

    trageZeitraumEin("2027-05-12", "2027-05-05");

    expect(screen.queryByTestId("reise-laenge")).not.toBeInTheDocument();
  });
});

/**
 * Eine Reise ueber ein Jahr entsteht nicht mehr unbemerkt (bug-050): vor dem
 * Speichern kommt die Rueckfrage. Sie blockiert nicht -- wer wirklich so
 * lange faehrt, bestaetigt und speichert.
 */
describe("Rueckfrage bei ungewoehnlich langer Reise (bug-050)", () => {
  const FLORENZ = {
    name: "Florenz",
    context: "Toskana, Italien",
    lat: 43.7696,
    lng: 11.2558,
    address: "",
    art: "place/city",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Sammelt, was an /api/trips geschickt wurde. */
  function stubApi() {
    const angefragt: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        angefragt.push({
          url,
          body: init?.body ? JSON.parse(String(init.body)) : null,
        });
        if (url.startsWith("/api/place-search")) {
          return new Response(JSON.stringify({ places: [FLORENZ] }));
        }
        return new Response(
          JSON.stringify({ trip: { ...SUEDITALIEN }, tripParticipant: null }),
        );
      }),
    );
    return {
      gespeichert: () => angefragt.filter((a) => a.url === "/api/trips"),
    };
  }

  async function trageReiseEin(
    user: ReturnType<typeof userEvent.setup>,
    startDate: string,
    endDate: string,
  ) {
    await user.type(screen.getByLabelText("Titel"), "Toskana 2027");
    // Der Hauptort entsteht ausschliesslich ueber die Ortssuche (req-017).
    await user.type(screen.getByLabelText("Hauptort"), "Florenz");
    await user.click(await screen.findByRole("button", { name: /Florenz/ }));
    fireEvent.change(screen.getByLabelText("Beginn"), {
      target: { value: startDate },
    });
    fireEvent.change(screen.getByLabelText("Ende"), {
      target: { value: endDate },
    });
    await user.click(screen.getByRole("button", { name: "Speichern" }));
  }

  it("speichert die Reise aus bug-050 nicht stillschweigend", async () => {
    const user = userEvent.setup();
    const api = stubApi();
    zeige(null);

    await trageReiseEin(user, "2026-10-25", "2027-10-26");

    const rueckfrage = screen.getByRole("alertdialog", {
      name: "Ungewöhnlich lange Reise",
    });
    expect(rueckfrage).toBeInTheDocument();
    expect(api.gespeichert()).toHaveLength(0);
  });

  it("nennt in der Rueckfrage die Zahl der Tage", async () => {
    const user = userEvent.setup();
    stubApi();
    zeige(null);

    await trageReiseEin(user, "2026-10-25", "2027-10-26");

    expect(screen.getByTestId("lange-reise-tage")).toHaveTextContent(
      "367 Tage",
    );
  });

  it("speichert nach „Zeitraum ändern“ nichts und laesst die Eingaben stehen", async () => {
    const user = userEvent.setup();
    const api = stubApi();
    zeige(null);
    await trageReiseEin(user, "2026-10-25", "2027-10-26");

    await user.click(screen.getByRole("button", { name: "Zeitraum ändern" }));

    expect(
      screen.queryByRole("alertdialog", { name: "Ungewöhnlich lange Reise" }),
    ).not.toBeInTheDocument();
    expect(api.gespeichert()).toHaveLength(0);
    expect(screen.getByLabelText("Ende")).toHaveValue("2027-10-26");
  });

  it("speichert nach „Trotzdem speichern“ mit der Bestaetigung", async () => {
    const user = userEvent.setup();
    const api = stubApi();
    zeige(null);
    await trageReiseEin(user, "2026-10-25", "2027-10-26");

    await user.click(
      screen.getByRole("button", { name: "Trotzdem speichern" }),
    );

    expect(api.gespeichert()).toHaveLength(1);
    expect(api.gespeichert()[0].body).toMatchObject({
      startDate: "2026-10-25",
      endDate: "2027-10-26",
      langeReiseBestaetigt: true,
    });
  });

  it("fragt bei einer gewoehnlich langen Reise nicht nach", async () => {
    const user = userEvent.setup();
    const api = stubApi();
    zeige(null);

    await trageReiseEin(user, "2026-10-25", "2026-10-26");

    expect(
      screen.queryByRole("alertdialog", { name: "Ungewöhnlich lange Reise" }),
    ).not.toBeInTheDocument();
    expect(api.gespeichert()).toHaveLength(1);
    expect(api.gespeichert()[0].body).not.toHaveProperty(
      "langeReiseBestaetigt",
    );
  });
});
