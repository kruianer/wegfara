import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApiKeyState } from "@/lib/api-keys/types";
import { API_KEY_ERRORS } from "@/lib/api-keys/save-api-key";
import { ZugangsschluesselCard } from "./zugangsschluessel-card";

const NICHTS_GESETZT: ApiKeyState[] = [
  { kind: "ki_suche", lastFour: null },
  { kind: "google", lastFour: null },
];

const KI_GESETZT: ApiKeyState[] = [
  { kind: "ki_suche", lastFour: "a3f9" },
  { kind: "google", lastFour: null },
];

/**
 * Die Schnittstelle antwortet wie app/api/zugangsschluessel/route.ts -- dort
 * wird sie gegen die echte Datenbank geprueft. Hier zaehlt, was die Karte
 * daraus macht. Ein Schluessel kommt nie zurueck, nur sein Zustand.
 */
function antwortet(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

function zeige(keys: ApiKeyState[], onChange = () => {}) {
  render(<ZugangsschluesselCard keys={keys} onChange={onChange} />);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Karte Zugangsschlüssel (req-028)", () => {
  it("zeigt einen nicht hinterlegten Schlüssel als „Nicht gesetzt“", () => {
    zeige(NICHTS_GESETZT);

    const karte = screen.getByRole("region", { name: "Zugangsschlüssel" });
    expect(karte).toHaveTextContent("KI-Suche");
    expect(karte).toHaveTextContent("Import aus Google");
    expect(screen.getAllByText("Nicht gesetzt")).toHaveLength(2);
  });

  it("zeigt einen hinterlegten Schlüssel mit seinen letzten vier Zeichen", () => {
    zeige(KI_GESETZT);

    expect(screen.getByText("Gesetzt (…a3f9)")).toBeInTheDocument();
  });

  it("verbirgt die Eingabe wie ein Kennwortfeld", async () => {
    const user = userEvent.setup();
    zeige(NICHTS_GESETZT);

    await user.click(screen.getAllByRole("button", { name: "Setzen" })[0]);

    const feld = screen.getByLabelText("Zugangsschlüssel für KI-Suche");
    expect(feld).toHaveAttribute("type", "password");
  });

  it("hinterlegt einen Schlüssel und meldet danach seine letzten vier Zeichen", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { keys: KI_GESETZT });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    zeige(NICHTS_GESETZT, onChange);

    await user.click(screen.getAllByRole("button", { name: "Setzen" })[0]);
    await user.type(
      screen.getByLabelText("Zugangsschlüssel für KI-Suche"),
      "sk-test-a3f9",
    );
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(KI_GESETZT));
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      kind: "ki_suche",
      key: "sk-test-a3f9",
    });
  });

  /** Ersetzen ist möglich, Auslesen nicht (req-028). */
  it("zeigt einen hinterlegten Schlüssel nirgends vollständig", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortet(200, { keys: KI_GESETZT }));
    zeige(KI_GESETZT);

    await user.click(screen.getByRole("button", { name: "Ersetzen" }));

    const feld = screen.getByLabelText("Zugangsschlüssel für KI-Suche");
    expect(feld).toHaveValue("");
    expect(document.body.textContent).not.toContain("sk-test-a3f9");
  });

  it("entfernt einen Schlüssel", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { keys: NICHTS_GESETZT });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    zeige(KI_GESETZT, onChange);

    await user.click(
      screen.getByRole("button", {
        name: "Zugangsschlüssel entfernen: KI-Suche",
      }),
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(NICHTS_GESETZT));
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; body: string },
    ];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ kind: "ki_suche" });
  });

  it("bietet zu einem nicht gesetzten Schlüssel kein Entfernen an", () => {
    zeige(NICHTS_GESETZT);

    expect(
      screen.queryByRole("button", {
        name: "Zugangsschlüssel entfernen: KI-Suche",
      }),
    ).not.toBeInTheDocument();
  });

  it("nennt den Grund, wenn das Speichern fehlschlägt", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortet(503, { error: "keine Verschluesselung" }));
    const onChange = vi.fn();
    zeige(NICHTS_GESETZT, onChange);

    await user.click(screen.getAllByRole("button", { name: "Setzen" })[0]);
    await user.type(
      screen.getByLabelText("Zugangsschlüssel für KI-Suche"),
      "sk-test-a3f9",
    );
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByTestId("zugangsschluessel-notice"),
    ).toHaveTextContent(API_KEY_ERRORS.failed);
    expect(onChange).not.toHaveBeenCalled();
  });
});
