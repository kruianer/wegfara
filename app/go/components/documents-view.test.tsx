import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TripDocument } from "@/lib/documents/types";
import { DOCUMENT_ERRORS } from "@/lib/documents/validate";
import { DocumentsView } from "./documents-view";

const TRIP_ID = "reise-1";
const PERSONEN = [{ id: "person-1", name: "Uwe Kremmel", nickname: "Uwe" }];

function dokument(overrides: Partial<TripDocument> = {}): TripDocument {
  return {
    id: "dok-1",
    tripId: TRIP_ID,
    name: "Bahnticket.jpg",
    contentType: "image/jpeg",
    sizeBytes: 412 * 1024,
    pageCount: null,
    poiId: null,
    transferId: null,
    uploadedById: "person-1",
    createdAt: new Date(2026, 8, 4, 9, 0).toISOString(),
    ...overrides,
  };
}

function zeige(
  documents: TripDocument[],
  onDocumentSaved: (document: TripDocument) => void = () => {},
) {
  render(
    <DocumentsView
      tripId={TRIP_ID}
      documents={documents}
      participants={PERSONEN}
      onDocumentSaved={onDocumentSaved}
    />,
  );
}

function antwortet(status: number, payload: unknown) {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

describe("Bereich Dokumente des Begleiters (req-034)", () => {
  it("bietet eine Schaltfläche zum Fotografieren an, die die Kamera öffnet", () => {
    zeige([]);

    const kamera = screen.getByLabelText("Fotografieren");
    expect(kamera).toHaveAttribute("capture", "environment");
    expect(kamera).toHaveAttribute("accept", "image/*");
  });

  it('zeigt ohne Dokumente „Noch keine Dokumente abgelegt"', () => {
    zeige([]);

    expect(
      screen.getByText("Noch keine Dokumente abgelegt"),
    ).toBeInTheDocument();
  });

  it("zeigt die Dokumente als einspaltige Liste mit Größe, Datum und Person", () => {
    zeige([dokument()]);

    expect(
      screen.getByRole("button", { name: "Dokument ansehen: Bahnticket.jpg" }),
    ).toBeInTheDocument();
    expect(screen.getByText("412 KB · 04.09.2026 · Uwe")).toBeInTheDocument();
  });

  it("legt ein aufgenommenes Foto bei der Reise ab", async () => {
    const user = userEvent.setup();
    const abgelegt = dokument();
    const fetchMock = antwortet(201, { document: abgelegt });
    vi.stubGlobal("fetch", fetchMock);
    const onDocumentSaved = vi.fn();
    zeige([], onDocumentSaved);

    await user.upload(
      screen.getByLabelText("Fotografieren"),
      new File([new Uint8Array(2048)], "foto.jpg", { type: "image/jpeg" }),
    );

    await waitFor(() => expect(onDocumentSaved).toHaveBeenCalledWith(abgelegt));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: FormData },
    ];
    expect(url).toBe("/api/dokumente");
    expect(init.method).toBe("POST");
    expect(init.body.get("tripId")).toBe(TRIP_ID);
  });

  it("legt eine Datei mit 25 MB NICHT ab und nennt den Grund", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(201, {});
    vi.stubGlobal("fetch", fetchMock);
    zeige([]);

    await user.upload(
      screen.getByLabelText("Fotografieren"),
      new File([new Uint8Array(25 * 1024 * 1024)], "gross.jpg", {
        type: "image/jpeg",
      }),
    );

    expect(await screen.findByTestId("dokument-hinweis")).toHaveTextContent(
      DOCUMENT_ERRORS.size,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("zeigt ein Dokument formatfüllend über der Seite und schließt beim Klick daneben", async () => {
    const user = userEvent.setup();
    zeige([dokument()]);

    await user.click(
      screen.getByRole("button", { name: "Dokument ansehen: Bahnticket.jpg" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Bahnticket.jpg" }),
    ).toBeInTheDocument();
    await user.click(screen.getByTestId("dokument-ansicht-hintergrund"));

    expect(
      screen.queryByRole("dialog", { name: "Bahnticket.jpg" }),
    ).not.toBeInTheDocument();
  });
});
