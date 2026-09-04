import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoiForm } from "./poi-form";
import type { Poi, PoiPhoto } from "@/lib/pois/types";
import { MAX_POI_PHOTO_BYTES, POI_PHOTO_ERRORS } from "@/lib/pois/photo-upload";

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
