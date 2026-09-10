import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoiForm } from "./poi-form";
import type { Poi, PoiPhoto } from "@/lib/pois/types";
import { MAX_POI_PHOTO_BYTES, POI_PHOTO_ERRORS } from "@/lib/pois/photo-upload";
import { POI_SHORT_TEXT_MAX_LENGTH } from "@/lib/pois/validate";

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: "trip-1",
    number: 4,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6491, lng: 14.6113 },
    status: "weiss_nicht",
    photos: [],
    ...overrides,
  };
}

function renderForm(
  props: {
    poi?: Poi | null;
    onSaved?: (poi: Poi) => void;
    onDelete?: (poi: Poi) => void;
    hasGoogleKey?: boolean;
  } = {},
) {
  return render(
    <PoiForm
      poi={props.poi === undefined ? poi() : props.poi}
      tripId="trip-1"
      picking={false}
      pickedPosition={null}
      onTogglePicking={() => {}}
      onSaved={props.onSaved ?? (() => {})}
      onCancel={() => {}}
      onDelete={props.onDelete ?? (() => {})}
      hasGoogleKey={props.hasGoogleKey ?? true}
    />,
  );
}

/** Das eine Suchfeld am Anfang des Formulars (req-048). */
function suchfeld(): HTMLElement {
  return screen.getByLabelText("Ort suchen oder Google-Maps-Link einfügen");
}

/** Beantwortet die Aufrufe der Schnittstellen nach ihrer Adresse. */
function stubApi(antworten: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string, init?: { body: string }) => {
    void init;
    const treffer = Object.entries(antworten).find(([pfad]) =>
      String(url).startsWith(pfad),
    );
    return { ok: Boolean(treffer), json: async () => treffer?.[1] ?? {} };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function bild(name = "bucht.jpg", size = 1024): File {
  const file = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PoiForm — Bilder (req-035)", () => {
  it("zeigt ein hinzugefügtes Bild in der Bildliste", async () => {
    const user = userEvent.setup();
    stubApi({ "/api/poi-fotos": { photos: [{ id: "foto-1", position: 1 }] } });
    renderForm();

    await user.upload(screen.getByLabelText("Bild hinzufügen"), bild());

    expect(
      screen.getByRole("img", { name: "Bild 1 von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("bietet neben der Datei auch die Kamera an", () => {
    renderForm();

    expect(screen.getByLabelText("Fotografieren")).toHaveAttribute(
      "capture",
      "environment",
    );
  });

  it("weist ein Bild über 20 MB ab, ohne die Schnittstelle zu rufen", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({});
    renderForm();

    await user.upload(
      screen.getByLabelText("Bild hinzufügen"),
      bild("gross.jpg", MAX_POI_PHOTO_BYTES + 1),
    );

    expect(screen.getByTestId("poi-foto-hinweis")).toHaveTextContent(
      POI_PHOTO_ERRORS.size,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("meldet die neue Reihenfolge, wenn das zweite Bild nach vorn rückt", async () => {
    const user = userEvent.setup();
    const neu: PoiPhoto[] = [
      { id: "foto-2", position: 1 },
      { id: "foto-1", position: 2 },
    ];
    stubApi({ "/api/poi-fotos": { photos: neu } });
    const onSaved = vi.fn();
    renderForm({
      poi: poi({
        photos: [
          { id: "foto-1", position: 1 },
          { id: "foto-2", position: 2 },
        ],
      }),
      onSaved,
    });

    await user.click(screen.getByRole("button", { name: "Bild 2 nach vorn" }));

    // Das erste Bild der Liste erscheint in der POI-Zeile -- die Liste
    // erfährt die neue Reihenfolge über onSaved.
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ photos: neu }),
    );
    expect(
      screen.getByRole("img", { name: "Bild 1 von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-2");
  });

  it("entfernt ein Bild aus der Bildliste", async () => {
    const user = userEvent.setup();
    stubApi({ "/api/poi-fotos": { photos: [] } });
    renderForm({ poi: poi({ photos: [{ id: "foto-1", position: 1 }] }) });

    await user.click(screen.getByRole("button", { name: "Bild 1 entfernen" }));

    expect(
      screen.queryByRole("img", { name: "Bild 1 von Villa Rufolo" }),
    ).not.toBeInTheDocument();
  });

  it("bietet beim Anlegen noch keine Bilder an", () => {
    renderForm({ poi: null });

    expect(screen.queryByLabelText("Bild hinzufügen")).not.toBeInTheDocument();
    expect(screen.getByText(/sobald der POI angelegt ist/)).toBeInTheDocument();
  });
});

describe("PoiForm — Ortssuche im Suchfeld (req-048)", () => {
  /** Ein Ortsvorschlag, wie ihn die Ortssuche liefert. */
  function stubPlaceSearch(overrides: Record<string, unknown> = {}) {
    return stubApi({
      "/api/place-search": {
        places: [
          {
            name: "Villa Rufolo",
            context: "Kampanien, Italien",
            lat: 40.6465,
            lng: 14.6127,
            address: "Via Santa Chiara 26, 84010 Ravello, Italien",
            art: "tourism/attraction",
            ...overrides,
          },
        ],
      },
    });
  }

  it("füllt Name, Typ, Adresse und Position aus einem Vorschlag", async () => {
    const user = userEvent.setup();
    stubPlaceSearch();
    renderForm({ poi: null });

    await user.type(suchfeld(), "Villa Rufolo Ravello");
    await user.click(await screen.findByText("Villa Rufolo"));

    expect(screen.getByLabelText("Name")).toHaveValue("Villa Rufolo");
    expect(screen.getByLabelText("Typ")).toHaveDisplayValue("Sehenswürdigkeit");
    expect(screen.getByLabelText("Adresse")).toHaveValue(
      "Via Santa Chiara 26, 84010 Ravello, Italien",
    );
    expect(screen.getByTestId("poi-form-position")).toHaveTextContent(
      "40.64650, 14.61270",
    );
    // Der Ort kommt nicht aus dem Vorschlag -- er wird beim Speichern
    // abgeleitet (req-041).
    expect(screen.getByLabelText("Ort")).toHaveValue("");
  });

  it("überschreibt einen bereits eingetippten Namen", async () => {
    const user = userEvent.setup();
    stubPlaceSearch();
    renderForm({ poi: null });

    await user.type(screen.getByLabelText("Name"), "Mein Lieblingsort");
    await user.type(suchfeld(), "Villa Rufolo Ravello");
    await user.click(
      within(await screen.findByLabelText("Ortsvorschläge")).getByText(
        "Villa Rufolo",
      ),
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Villa Rufolo");
  });

  it("übernimmt meine Änderung an einem gefüllten Feld", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({
      "/api/place-search": {
        places: [
          {
            name: "Villa Rufolo",
            context: "Kampanien, Italien",
            lat: 40.6465,
            lng: 14.6127,
            address: "Via Santa Chiara 26, 84010 Ravello, Italien",
            art: "tourism/attraction",
          },
        ],
      },
      "/api/pois": { poi: poi() },
    });
    renderForm({ poi: null });

    await user.type(suchfeld(), "Villa Rufolo Ravello");
    await user.click(await screen.findByText("Villa Rufolo"));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Gärten der Villa Rufolo");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    const gespeichert = fetchMock.mock.calls
      .filter(([url]) => String(url).startsWith("/api/pois"))
      .map(([, init]) => JSON.parse((init as { body: string }).body))[0];
    expect(gespeichert.name).toBe("Gärten der Villa Rufolo");
    // Der Name ist jetzt von Hand geändert, die übrigen Felder nicht.
    expect(gespeichert.autoFilled).toEqual(["type", "position", "address"]);
  });

  it("lässt den Typ stehen, wenn OpenStreetMap keine Einordnung kennt", async () => {
    const user = userEvent.setup();
    stubPlaceSearch({ name: "Praiano", art: "" });
    renderForm({ poi: poi({ type: "strand" }) });

    await user.type(suchfeld(), "Praiano");
    await user.click(await screen.findByText("Praiano"));

    expect(screen.getByLabelText("Typ")).toHaveDisplayValue("Strand");
  });
});

describe("PoiForm — Google-Maps-Link im Suchfeld (req-048)", () => {
  const LINK = "https://maps.app.goo.gl/aBcD1234";

  const VILLA_RUFOLO = {
    placeId: "ChIJVillaRufolo",
    name: "Villa Rufolo",
    type: "restaurant",
    position: { lat: 40.6491, lng: 14.6113 },
    address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    web: "https://villarufolo.com",
    phone: "+39 089 857621",
    openingHours: "Montag: 09:00–20:00",
    shortText: "Gärten mit Meerblick",
    longText: "Ein Palast aus dem 13. Jahrhundert.",
    bewertung: 4.6,
    bewertungAnzahl: 1240,
    photoNames: ["places/x/photos/a"],
  };

  function stubLookup(antwort: unknown) {
    return stubApi({
      "/api/ort-aus-link": antwort,
      "/api/place-search": { places: [] },
      "/api/pois": { poi: poi() },
    });
  }

  it("füllt die Felder aus dem abgerufenen Ort", async () => {
    const user = userEvent.setup();
    stubLookup({ result: "gefunden", ort: VILLA_RUFOLO });
    renderForm({ poi: null });

    await user.type(suchfeld(), LINK);

    expect(
      await screen.findByTestId("poi-suche-uebernommen"),
    ).toHaveTextContent("Villa Rufolo");
    expect(screen.getByLabelText("Name")).toHaveValue("Villa Rufolo");
    expect(screen.getByLabelText("Adresse")).toHaveValue(
      "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    );
    expect(screen.getByTestId("poi-form-position")).toHaveTextContent(
      "40.64910, 14.61130",
    );
    expect(screen.getByLabelText("Typ")).toHaveDisplayValue("Restaurant");
    expect(screen.getByLabelText("Kurztext")).toHaveValue(
      "Gärten mit Meerblick",
    );
  });

  it("zeigt zu einem Link keine Vorschlagsliste", async () => {
    const user = userEvent.setup();
    stubLookup({ result: "gefunden", ort: VILLA_RUFOLO });
    renderForm({ poi: null });

    await user.type(suchfeld(), LINK);
    await screen.findByTestId("poi-suche-uebernommen");

    expect(screen.queryByLabelText("Ortsvorschläge")).not.toBeInTheDocument();
  });

  it("schickt den Ort bei Google beim Speichern mit", async () => {
    const user = userEvent.setup();
    const fetchMock = stubLookup({ result: "gefunden", ort: VILLA_RUFOLO });
    renderForm({ poi: null });

    await user.type(suchfeld(), LINK);
    await screen.findByTestId("poi-suche-uebernommen");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    const gespeichert = fetchMock.mock.calls
      .map(([url, init]) => ({
        url: String(url),
        body: JSON.parse((init as { body: string }).body),
      }))
      .find((call) => call.url.startsWith("/api/pois"))!.body;
    expect(gespeichert.google).toEqual({
      placeId: "ChIJVillaRufolo",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      photoNames: ["places/x/photos/a"],
    });
    // Nichts davon habe ich selbst getippt (req-048).
    expect(gespeichert.autoFilled).toContain("name");
    expect(gespeichert.autoFilled).toContain("shortText");
  });

  it("füllt beim Ändern eines bestehenden POI dessen Felder neu", async () => {
    const user = userEvent.setup();
    stubLookup({ result: "gefunden", ort: VILLA_RUFOLO });
    renderForm({ poi: poi({ name: "Alter Name", shortText: "Alter Text" }) });

    await user.type(suchfeld(), LINK);
    await screen.findByTestId("poi-suche-uebernommen");

    expect(screen.getByLabelText("Name")).toHaveValue("Villa Rufolo");
    expect(screen.getByLabelText("Kurztext")).toHaveValue(
      "Gärten mit Meerblick",
    );
  });

  /**
   * Der eingefügte Link aus bug-026: er wird am Stück eingefügt, nicht
   * getippt -- und muss sofort erkennbar in Arbeit sein.
   */
  it("zeigt sofort nach dem Einfügen, dass nachgeschlagen wird", async () => {
    const user = userEvent.setup();
    stubLookup({ result: "gefunden", ort: VILLA_RUFOLO });
    renderForm({ poi: null });

    await user.click(suchfeld());
    await user.paste("https://maps.app.goo.gl/AtmT9iWJpmweLMYk8");

    expect(await screen.findByTestId("poi-suche-laeuft")).toBeInTheDocument();
    await screen.findByTestId("poi-suche-uebernommen");
  });

  it("nennt den abgewiesenen Zugangsschlüssel als Grund", async () => {
    const user = userEvent.setup();
    stubLookup({ result: "fehler", reason: "zugang_abgelehnt" });
    renderForm({ poi: null });

    await user.click(suchfeld());
    await user.paste("https://maps.app.goo.gl/AtmT9iWJpmweLMYk8");

    expect(await screen.findByTestId("poi-suche-fehler")).toHaveTextContent(
      "Zugangsschlüssel",
    );
    expect(screen.queryByTestId("poi-suche-laeuft")).not.toBeInTheDocument();
  });

  /**
   * Antwortet die Schnittstelle anders als erwartet, darf das Feld nicht
   * still bleiben (bug-021, bug-026) -- vorher lief das Übernehmen dabei auf
   * einen Fehler, und am Feld stand nichts.
   */
  it("bleibt bei einer unerwarteten Antwort nicht still", async () => {
    const user = userEvent.setup();
    stubLookup({});
    renderForm({ poi: null });

    await user.click(suchfeld());
    await user.paste("https://maps.app.goo.gl/AtmT9iWJpmweLMYk8");

    expect(await screen.findByTestId("poi-suche-fehler")).toHaveTextContent(
      "Die Abfrage bei Google ist fehlgeschlagen.",
    );
  });

  it("nennt den Grund, wenn der Abruf scheitert, und lässt die Felder stehen", async () => {
    const user = userEvent.setup();
    stubLookup({ result: "fehler", reason: "ort_nicht_gefunden" });
    renderForm({ poi: poi({ type: "restaurant" }) });

    await user.type(suchfeld(), LINK);

    expect(await screen.findByTestId("poi-suche-fehler")).toHaveTextContent(
      "Zu diesem Link ließ sich kein Ort finden.",
    );
    expect(screen.getByLabelText("Typ")).toHaveDisplayValue("Restaurant");
    expect(screen.getByLabelText("Name")).toHaveValue("Villa Rufolo");
    // Das Formular bleibt zum Weiterarbeiten offen.
    expect(screen.getByRole("button", { name: "Speichern" })).toBeEnabled();
  });
});

describe("PoiForm — Suchfeld ohne Zugangsschlüssel (req-028)", () => {
  const LINK = "https://maps.app.goo.gl/aBcD1234";

  it("weist am Feld darauf hin und fragt nicht bei Google an", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ "/api/place-search": { places: [] } });
    renderForm({ poi: null, hasGoogleKey: false });

    await user.type(suchfeld(), LINK);

    expect(
      await screen.findByTestId("poi-suche-kein-schluessel"),
    ).toHaveTextContent("Zugangsschlüssel");
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).startsWith("/api/ort-aus-link"),
      ),
    ).toBe(false);
  });

  it("sucht weiterhin nach einem Begriff", async () => {
    const user = userEvent.setup();
    stubApi({
      "/api/place-search": {
        places: [
          {
            name: "Villa Rufolo",
            context: "Kampanien, Italien",
            lat: 40.6465,
            lng: 14.6127,
            address: "",
            art: "tourism/attraction",
          },
        ],
      },
    });
    renderForm({ poi: null, hasGoogleKey: false });

    await user.type(suchfeld(), "Villa Rufolo Ravello");

    expect(
      within(await screen.findByLabelText("Ortsvorschläge")).getByText(
        "Villa Rufolo",
      ),
    ).toBeInTheDocument();
  });
});

describe("PoiForm — Ort (req-041)", () => {
  it("zeigt den abgeleiteten Ort, lässt ihn aber nicht beschreiben", async () => {
    const user = userEvent.setup();
    renderForm({ poi: poi({ ort: "Ravello" }) });

    const feld = screen.getByLabelText("Ort");
    expect(feld).toHaveAttribute("readonly");

    await user.type(feld, "Amalfi");

    expect(feld).toHaveValue("Ravello");
  });

  it("lässt das Feld beim neuen POI leer", () => {
    renderForm({ poi: null });

    expect(screen.getByLabelText("Ort")).toHaveValue("");
  });
});

describe("PoiForm — Reihenfolge der Felder (req-048)", () => {
  it("beginnt mit dem Suchfeld — vor dem Namen", () => {
    renderForm({ poi: null });

    const beschriftungen = [...document.querySelectorAll("label, span")].map(
      (element) => element.textContent,
    );
    const stellen = [
      "Ort suchen oder Google-Maps-Link einfügen",
      "Name",
      "Typ",
      "Status",
      "Kurztext",
      "Langtext",
      "Adresse",
      "Ort",
      "Position",
    ].map((feld) => beschriftungen.indexOf(feld));

    expect(stellen.every((stelle) => stelle >= 0)).toBe(true);
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen);
  });
});

describe("PoiForm — Kurztext und Langtext (req-044)", () => {
  it("zeigt die Texte eines vorhandenen POI", () => {
    renderForm({
      poi: poi({
        shortText: "Gärten mit Meerblick",
        longText: "Ein Palast aus dem 13. Jahrhundert.",
      }),
    });

    expect(screen.getByLabelText("Kurztext")).toHaveValue(
      "Gärten mit Meerblick",
    );
    expect(screen.getByLabelText("Langtext")).toHaveValue(
      "Ein Palast aus dem 13. Jahrhundert.",
    );
  });

  it("beginnt beim Anlegen mit leeren Texten", () => {
    renderForm({ poi: null });

    expect(screen.getByLabelText("Kurztext")).toHaveValue("");
    expect(screen.getByLabelText("Langtext")).toHaveValue("");
  });

  it("schickt beide Texte beim Speichern mit", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ "/api/pois": { poi: poi() } });
    renderForm();

    await user.type(screen.getByLabelText("Kurztext"), "Gärten mit Meerblick");
    await user.type(screen.getByLabelText("Langtext"), "Zwei Stunden reichen.");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(init.body)).toMatchObject({
      shortText: "Gärten mit Meerblick",
      longText: "Zwei Stunden reichen.",
    });
  });

  it("nimmt einen Kurztext mit 200 Zeichen an", async () => {
    const user = userEvent.setup();
    stubApi({ "/api/pois": { poi: poi() } });
    renderForm();

    const genau = "a".repeat(POI_SHORT_TEXT_MAX_LENGTH);
    await user.type(screen.getByLabelText("Kurztext"), genau);

    expect(screen.getByLabelText("Kurztext")).toHaveValue(genau);
  });

  it("lässt das 201. Zeichen des Kurztextes nicht ins Feld", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByLabelText("Kurztext"),
      "a".repeat(POI_SHORT_TEXT_MAX_LENGTH + 1),
    );

    expect(
      (screen.getByLabelText("Kurztext") as HTMLInputElement).value,
    ).toHaveLength(POI_SHORT_TEXT_MAX_LENGTH);
  });

  it("weist einen zu langen Kurztext beim Speichern ab", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ "/api/pois": { poi: poi() } });
    // So lang kommt er nur an der Tastatur vorbei ins Feld -- etwa aus einem
    // Stand, der vor der Grenze entstanden ist.
    renderForm({
      poi: poi({ shortText: "a".repeat(POI_SHORT_TEXT_MAX_LENGTH + 1) }),
    });

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      `Der Kurztext darf höchstens ${POI_SHORT_TEXT_MAX_LENGTH} Zeichen haben.`,
    );
  });

  it("lässt den Langtext ohne Grenze zu", async () => {
    const user = userEvent.setup();
    stubApi({ "/api/pois": { poi: poi() } });
    renderForm();

    const langtext = screen.getByLabelText("Langtext");
    expect(langtext).not.toHaveAttribute("maxlength");

    await user.click(screen.getByRole("button", { name: "Speichern" }));
    expect(screen.queryByTestId("poi-save-error")).not.toBeInTheDocument();
  });
});

describe("PoiForm — Position auf der Karte setzen (req-044)", () => {
  it("zeigt den Schalter ausgeschaltet, solange nicht gewartet wird", () => {
    renderForm();

    expect(
      screen.getByRole("button", { name: "Position auf der Karte setzen" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("meldet das Umschalten nach außen", async () => {
    const user = userEvent.setup();
    const onTogglePicking = vi.fn();
    render(
      <PoiForm
        poi={poi()}
        tripId="trip-1"
        picking={false}
        pickedPosition={null}
        onTogglePicking={onTogglePicking}
        onSaved={() => {}}
        onCancel={() => {}}
        onDelete={() => {}}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Position auf der Karte setzen" }),
    );

    expect(onTogglePicking).toHaveBeenCalled();
  });

  it("zeigt den eingeschalteten Schalter als gedrückt", () => {
    render(
      <PoiForm
        poi={poi()}
        tripId="trip-1"
        picking
        pickedPosition={null}
        onTogglePicking={() => {}}
        onSaved={() => {}}
        onCancel={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Position auf der Karte setzen" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

describe("PoiForm — Speichern (req-035)", () => {
  it("zeigt einen Hinweis, wenn das Speichern fehlschlägt", async () => {
    const user = userEvent.setup();
    stubApi({});
    renderForm();

    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(screen.getByTestId("poi-save-error")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Villa Rufolo");
  });

  it("öffnet die Rückfrage vor dem Entfernen", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderForm({ onDelete });

    await user.click(screen.getByRole("button", { name: "POI löschen" }));

    expect(onDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "poi-1" }),
    );
  });
});

describe("PoiForm — eingefügte Webadresse ohne Google-Maps (req-048)", () => {
  it("nennt am Feld, dass es kein Google-Maps-Link ist, und sucht nicht danach", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ "/api/place-search": { places: [] } });
    renderForm({ poi: null });

    await user.type(suchfeld(), "https://example.com/villa-rufolo");

    expect(await screen.findByTestId("poi-suche-fehler")).toHaveTextContent(
      "Das ist kein Google-Maps-Link.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
