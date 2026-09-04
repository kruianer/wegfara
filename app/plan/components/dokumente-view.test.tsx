import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trip } from "@/lib/trips/types";
import type { Poi } from "@/lib/pois/types";
import type { Transfer } from "@/lib/transfers/types";
import type { TripDocument } from "@/lib/documents/types";
import { DOCUMENT_ERRORS } from "@/lib/documents/validate";
import { DokumenteView } from "./dokumente-view";

const REISE: Trip = {
  id: "reise-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};

const VILLA_RUFOLO: Poi = {
  id: "poi-1",
  tripId: REISE.id,
  number: 1,
  name: "Villa Rufolo",
  ort: "Ravello",
  type: "sehenswuerdigkeit",
  position: { lat: 40.649, lng: 14.612 },
  status: "weiss_nicht",
};

const MIETWAGEN: Transfer = {
  id: "transfer-1",
  tripId: REISE.id,
  fromActivityId: "a1",
  toActivityId: "a2",
  mode: "auto",
  title: "Mietwagen",
  durationMin: 45,
  distanceKm: 32,
};

const PERSONEN = [{ id: "person-1", name: "Uwe Kremmel", nickname: "Uwe" }];

function dokument(overrides: Partial<TripDocument> = {}): TripDocument {
  return {
    id: "dok-1",
    tripId: REISE.id,
    name: "Flugticket.pdf",
    contentType: "application/pdf",
    sizeBytes: 412 * 1024,
    pageCount: 2,
    poiId: null,
    transferId: null,
    uploadedById: "person-1",
    createdAt: new Date(2026, 8, 4, 9, 0).toISOString(),
    ...overrides,
  };
}

function zeige(
  documents: TripDocument[],
  handlers: {
    onDocumentSaved?: (document: TripDocument) => void;
    onDocumentRemoved?: (document: TripDocument) => void;
  } = {},
) {
  return render(
    <DokumenteView
      trip={REISE}
      documents={documents}
      pois={[VILLA_RUFOLO]}
      transfers={[MIETWAGEN]}
      participants={PERSONEN}
      onDocumentSaved={handlers.onDocumentSaved ?? (() => {})}
      onDocumentRemoved={handlers.onDocumentRemoved ?? (() => {})}
    />,
  );
}

/** Die Schnittstelle antwortet wie app/api/dokumente/route.ts. */
function antwortet(status: number, payload: unknown) {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

function datei(name: string, type: string, groesse = 2048): File {
  return new File([new Uint8Array(groesse)], name, { type });
}

describe("Bereich Dokumente des Planers (req-034)", () => {
  it('zeigt ohne Dokumente „Noch keine Dokumente abgelegt"', () => {
    zeige([]);

    expect(
      screen.getByText("Noch keine Dokumente abgelegt"),
    ).toBeInTheDocument();
  });

  it("zeigt ein abgelegtes Dokument als Karte", () => {
    zeige([dokument()]);

    expect(
      screen.getByRole("button", { name: "Dokument ansehen: Flugticket.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Noch keine Dokumente abgelegt"),
    ).not.toBeInTheDocument();
  });

  it("zeigt auf der Karte Größe und Datum", () => {
    zeige([dokument()]);

    expect(screen.getByText("412 KB · 04.09.2026 · Uwe")).toBeInTheDocument();
  });

  it("zeigt das Kürzel der Dateiendung auf dem Dateisymbol", () => {
    zeige([dokument()]);

    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("legt eine gewählte PDF-Datei ab und zeigt sie danach in der Liste", async () => {
    const user = userEvent.setup();
    const abgelegt = dokument();
    const fetchMock = antwortet(201, { document: abgelegt });
    vi.stubGlobal("fetch", fetchMock);
    const onDocumentSaved = vi.fn();
    zeige([], { onDocumentSaved });

    await user.upload(
      screen.getByLabelText("Dokument hochladen"),
      datei("Flugticket.pdf", "application/pdf"),
    );

    await waitFor(() => expect(onDocumentSaved).toHaveBeenCalledWith(abgelegt));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: FormData },
    ];
    expect(url).toBe("/api/dokumente");
    expect(init.method).toBe("POST");
    expect(init.body.get("tripId")).toBe(REISE.id);
  });

  it("legt eine Datei mit 25 MB NICHT ab und nennt den Grund", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(201, {});
    vi.stubGlobal("fetch", fetchMock);
    zeige([]);

    await user.upload(
      screen.getByLabelText("Dokument hochladen"),
      datei("gross.pdf", "application/pdf", 25 * 1024 * 1024),
    );

    expect(await screen.findByTestId("dokument-hinweis")).toHaveTextContent(
      DOCUMENT_ERRORS.size,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('legt eine Datei mit der Endung „.zip" NICHT ab und nennt den Grund', async () => {
    // Die Dateiwahl des Browsers bietet eine .zip-Datei gar nicht erst an
    // (accept) -- deshalb hier ohne diese Vorauswahl: geprüft wird der Fall
    // dahinter, dass eine solche Datei trotzdem ankommt.
    const user = userEvent.setup({ applyAccept: false });
    const fetchMock = antwortet(201, {});
    vi.stubGlobal("fetch", fetchMock);
    zeige([]);

    await user.upload(
      screen.getByLabelText("Dokument hochladen"),
      datei("unterlagen.zip", "application/zip"),
    );

    expect(await screen.findByTestId("dokument-hinweis")).toHaveTextContent(
      DOCUMENT_ERRORS.type,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bietet auch im Planer das Fotografieren an", () => {
    zeige([]);

    expect(screen.getByLabelText("Fotografieren")).toHaveAttribute(
      "capture",
      "environment",
    );
  });
});

describe("Vollbildansicht eines Dokuments (req-034)", () => {
  it("zeigt das Dokument formatfüllend über der Seite", async () => {
    const user = userEvent.setup();
    zeige([dokument()]);

    await user.click(
      screen.getByRole("button", { name: "Dokument ansehen: Flugticket.pdf" }),
    );

    const ansicht = screen.getByRole("dialog", { name: "Flugticket.pdf" });
    expect(ansicht).toBeInTheDocument();
    expect(within(ansicht).getByTitle("Flugticket.pdf")).toHaveAttribute(
      "src",
      "/api/dokumente/dok-1#page=1",
    );
  });

  it("blättert in einer mehrseitigen PDF-Datei", async () => {
    const user = userEvent.setup();
    zeige([dokument()]);

    await user.click(
      screen.getByRole("button", { name: "Dokument ansehen: Flugticket.pdf" }),
    );
    const ansicht = screen.getByRole("dialog", { name: "Flugticket.pdf" });
    expect(within(ansicht).getByText("Seite 1 von 2")).toBeInTheDocument();
    await user.click(within(ansicht).getByRole("button", { name: "Weiter" }));

    expect(within(ansicht).getByText("Seite 2 von 2")).toBeInTheDocument();
    expect(within(ansicht).getByTitle("Flugticket.pdf")).toHaveAttribute(
      "src",
      "/api/dokumente/dok-1#page=2",
    );
  });

  it("zeigt ein Bild als Bild", async () => {
    const user = userEvent.setup();
    zeige([
      dokument({
        name: "Ticket.jpg",
        contentType: "image/jpeg",
        pageCount: null,
      }),
    ]);

    await user.click(
      screen.getByRole("button", { name: "Dokument ansehen: Ticket.jpg" }),
    );

    expect(screen.getByRole("img", { name: "Ticket.jpg" })).toHaveAttribute(
      "src",
      "/api/dokumente/dok-1",
    );
  });

  it("schließt beim Klick daneben", async () => {
    const user = userEvent.setup();
    zeige([dokument()]);
    await user.click(
      screen.getByRole("button", { name: "Dokument ansehen: Flugticket.pdf" }),
    );

    await user.click(screen.getByTestId("dokument-ansicht-hintergrund"));

    expect(
      screen.queryByRole("dialog", { name: "Flugticket.pdf" }),
    ).not.toBeInTheDocument();
  });

  it('schließt über „Schließen"', async () => {
    const user = userEvent.setup();
    zeige([dokument()]);
    await user.click(
      screen.getByRole("button", { name: "Dokument ansehen: Flugticket.pdf" }),
    );

    await user.click(screen.getByRole("button", { name: "Schließen" }));

    expect(
      screen.queryByRole("dialog", { name: "Flugticket.pdf" }),
    ).not.toBeInTheDocument();
  });
});

describe("Verknüpfung und Filter (req-034)", () => {
  it("zeigt die Verknüpfung mit einem POI auf der Karte", () => {
    zeige([dokument({ poiId: VILLA_RUFOLO.id })]);

    expect(screen.getByText("POI · Villa Rufolo")).toBeInTheDocument();
  });

  it("zeigt die Verknüpfung mit einem Transfer auf der Karte", () => {
    zeige([dokument({ transferId: MIETWAGEN.id })]);

    expect(screen.getByText("Transfer · Mietwagen")).toBeInTheDocument();
  });

  it('zeigt bei „Ohne Verknüpfung" nur die unverknüpften', async () => {
    const user = userEvent.setup();
    zeige([
      dokument({ id: "dok-1", name: "Eintritt.pdf", poiId: VILLA_RUFOLO.id }),
      dokument({ id: "dok-2", name: "Vertrag.pdf", transferId: MIETWAGEN.id }),
      dokument({ id: "dok-3", name: "Flugticket.pdf" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Ohne Verknüpfung" }));

    expect(
      screen.getByRole("button", { name: "Dokument ansehen: Flugticket.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dokument ansehen: Eintritt.pdf" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dokument ansehen: Vertrag.pdf" }),
    ).not.toBeInTheDocument();
  });

  it("verknüpft ein Dokument nachträglich mit einem POI", async () => {
    const user = userEvent.setup();
    const verknuepft = dokument({ poiId: VILLA_RUFOLO.id });
    const fetchMock = antwortet(200, { document: verknuepft });
    vi.stubGlobal("fetch", fetchMock);
    const onDocumentSaved = vi.fn();
    zeige([dokument()], { onDocumentSaved });

    await user.click(
      screen.getByRole("button", { name: "Dokument ändern: Flugticket.pdf" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Verknüpfung"),
      `poi:${VILLA_RUFOLO.id}`,
    );
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(onDocumentSaved).toHaveBeenCalledWith(verknuepft),
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toMatchObject({
      id: "dok-1",
      poiId: VILLA_RUFOLO.id,
      transferId: null,
    });
  });
});

describe("Entfernen eines Dokuments (req-034)", () => {
  it("nennt in der Rückfrage den Namen des Dokuments", async () => {
    const user = userEvent.setup();
    zeige([dokument()]);

    await user.click(
      screen.getByRole("button", {
        name: "Dokument entfernen: Flugticket.pdf",
      }),
    );

    const rueckfrage = screen.getByRole("alertdialog", {
      name: "Dokument entfernen",
    });
    expect(rueckfrage).toHaveTextContent("Flugticket.pdf");
  });

  it("entfernt erst nach der Bestätigung", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    const onDocumentRemoved = vi.fn();
    const entfernt = dokument();
    zeige([entfernt], { onDocumentRemoved });

    await user.click(
      screen.getByRole("button", {
        name: "Dokument entfernen: Flugticket.pdf",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Endgültig entfernen" }),
    );

    await waitFor(() =>
      expect(onDocumentRemoved).toHaveBeenCalledWith(entfernt),
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ id: "dok-1" });
  });

  it("entfernt nichts, wer die Rückfrage abbricht", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    zeige([dokument()]);

    await user.click(
      screen.getByRole("button", {
        name: "Dokument entfernen: Flugticket.pdf",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("alertdialog", { name: "Dokument entfernen" }),
    ).not.toBeInTheDocument();
  });
});
