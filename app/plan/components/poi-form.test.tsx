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
    />,
  );
}

/** Beantwortet die Aufrufe der Schnittstellen nach ihrer Adresse. */
function stubApi(antworten: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
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

describe("PoiForm — Ortssuche (req-035)", () => {
  it("übernimmt Adresse und Position aus einem Vorschlag (req-041)", async () => {
    const user = userEvent.setup();
    stubApi({
      "/api/place-search": {
        places: [
          {
            name: "Villa Rufolo",
            context: "Kampanien, Italien",
            lat: 40.6465,
            lng: 14.6127,
            address: "Via Santa Chiara 26, 84010 Ravello, Italien",
          },
        ],
      },
    });
    renderForm({ poi: null });

    await user.type(screen.getByLabelText("Position"), "Villa Rufolo Ravello");
    await user.click(await screen.findByText("Villa Rufolo"));

    expect(screen.getByTestId("poi-form-position")).toHaveTextContent(
      "40.64650, 14.61270",
    );
    expect(screen.getByLabelText("Adresse")).toHaveValue(
      "Via Santa Chiara 26, 84010 Ravello, Italien",
    );
    // Der Name war noch leer und wird deshalb ergänzt.
    expect(screen.getByLabelText("Name")).toHaveValue("Villa Rufolo");
    // Der Ort kommt nicht mehr aus dem Vorschlag -- er wird beim Speichern
    // abgeleitet (req-041).
    expect(screen.getByLabelText("Ort")).toHaveValue("");
  });

  it("lässt einen bereits eingetippten Namen stehen", async () => {
    const user = userEvent.setup();
    stubApi({
      "/api/place-search": {
        places: [
          {
            name: "Praiano",
            context: "Kampanien, Italien",
            lat: 40.6117,
            lng: 14.5289,
            address: "",
          },
        ],
      },
    });
    renderForm({ poi: null });

    await user.type(screen.getByLabelText("Name"), "Bucht bei Praiano");
    await user.type(screen.getByLabelText("Position"), "Praiano");
    await user.click(
      within(await screen.findByLabelText("Ortsvorschläge")).getByText(
        "Praiano",
      ),
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Bucht bei Praiano");
    expect(screen.getByTestId("poi-form-position")).toHaveTextContent(
      "40.61170, 14.52890",
    );
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

describe("PoiForm — Reihenfolge der Felder (req-044)", () => {
  it("führt Name, Typ, Status, Kurztext, Langtext, Adresse, Ort, Position", () => {
    renderForm({ poi: null });

    const beschriftungen = [...document.querySelectorAll("label, span")].map(
      (element) => element.textContent,
    );
    const stellen = [
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
