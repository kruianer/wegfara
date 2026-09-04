import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trip } from "@/lib/trips/types";
import type { GuestAccess, GuestLink } from "@/lib/guests/types";
import { GastzugaengeView } from "./gastzugaenge-view";

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};

const AKTIV: GuestAccess = {
  id: "1a2b3c4d-0000-4000-8000-000000000001",
  tripId: SUEDITALIEN.id,
  tripTitle: "Süditalien Rundreise",
  purpose: "Nachbarin Eva",
  createdAt: "2026-09-04T10:00:00.000Z",
  expiresAt: "2026-09-11T10:00:00.000Z",
  lastUsedAt: "2026-09-05T08:30:00.000Z",
  revokedAt: null,
  status: "aktiv",
};

const LINK: GuestLink = {
  guestAccess: AKTIV,
  url: "https://dev.wegfara.com/gast?token=geheim",
  qr: { size: 25, path: "M0 0h1v1h-1z" },
};

/**
 * Die Schnittstelle antwortet wie app/api/gastzugaenge/route.ts -- dort wird
 * sie gegen die echte Datenbank geprueft. Hier zaehlt, was der Bereich
 * daraus macht.
 */
function antwortet(antworten: { status: number; payload: unknown }[]) {
  const fetchMock = vi.fn(async () => {
    const naechste = antworten.shift() ?? { status: 200, payload: {} };
    return {
      ok: naechste.status < 400,
      status: naechste.status,
      json: async () => naechste.payload,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function zeige(guestAccesses: GuestAccess[], weitere: unknown[] = []) {
  const antworten = [
    { status: 200, payload: { guestAccesses } },
    ...(weitere as { status: number; payload: unknown }[]),
  ];
  const fetchMock = antwortet(antworten);
  render(<GastzugaengeView trips={[SUEDITALIEN]} />);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Bereich Gastzugänge (req-038)", () => {
  it("zeigt je Zugang Zweck, Reise, Ablauf, letzte Verwendung und Status", async () => {
    zeige([AKTIV]);

    const zeile = await screen.findByText("Nachbarin Eva");
    const karte = screen.getByRole("region", { name: "Vergebene Zugänge" });

    expect(zeile).toBeInTheDocument();
    expect(karte).toHaveTextContent("Süditalien Rundreise");
    expect(karte).toHaveTextContent("11.09.2026");
    expect(karte).toHaveTextContent("05.09.2026");
    expect(karte).toHaveTextContent("Aktiv");
  });

  it("bietet zu einem aktiven Zugang das Widerrufen an", async () => {
    zeige([AKTIV]);

    expect(
      await screen.findByRole("button", {
        name: "Gastzugang widerrufen: Nachbarin Eva",
      }),
    ).toBeInTheDocument();
  });

  it("bietet zu einem widerrufenen Zugang kein Widerrufen mehr an", async () => {
    zeige([
      { ...AKTIV, status: "widerrufen", revokedAt: "2026-09-05T09:00:00.000Z" },
    ]);

    await screen.findByText("Nachbarin Eva");
    expect(
      screen.queryByRole("button", {
        name: "Gastzugang widerrufen: Nachbarin Eva",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("region", { name: "Vergebene Zugänge" }),
    ).toHaveTextContent("Widerrufen");
  });

  it("setzt den Zugang nach dem Widerrufen auf widerrufen", async () => {
    const user = userEvent.setup();
    zeige(
      [AKTIV],
      [
        {
          status: 200,
          payload: {
            guestAccess: {
              ...AKTIV,
              status: "widerrufen",
              revokedAt: "2026-09-05T09:00:00.000Z",
            },
          },
        },
      ],
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Gastzugang widerrufen: Nachbarin Eva",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Vergebene Zugänge" }),
      ).toHaveTextContent("Widerrufen"),
    );
  });

  it("zeigt den Link nach dem Erstellen als Text und als QR-Code -- mit dem Hinweis, dass er nur jetzt sichtbar ist", async () => {
    const user = userEvent.setup();
    zeige([], [{ status: 201, payload: { link: LINK } }]);

    await waitFor(() =>
      expect(screen.getByText("Noch kein Gastzugang.")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /Gastzugang erstellen/ }),
    );
    const formular = screen.getByRole("form", { name: "Gastzugang erstellen" });
    await user.type(within(formular).getByLabelText("Zweck"), "Nachbarin Eva");
    await user.click(
      within(formular).getByRole("button", { name: "Gastzugang erstellen" }),
    );

    const panel = await screen.findByTestId("guest-link-panel");
    expect(panel).toHaveTextContent(
      "https://dev.wegfara.com/gast?token=geheim",
    );
    expect(panel).toHaveTextContent("nur jetzt sichtbar");
    expect(
      screen.getByRole("img", {
        name: "QR-Code des Gastzugangs: Nachbarin Eva",
      }),
    ).toBeInTheDocument();
  });

  it("bietet 7 Tage als Vorgabe und nichts ueber 90 Tage an", async () => {
    const user = userEvent.setup();
    zeige([]);

    await waitFor(() =>
      expect(screen.getByText("Noch kein Gastzugang.")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /Gastzugang erstellen/ }),
    );

    const dauer = screen.getByLabelText<HTMLSelectElement>("Dauer");
    expect(dauer.value).toBe(String(7 * 24));
    const angebote = Array.from(dauer.options).map((option) =>
      Number(option.value),
    );
    expect(Math.max(...angebote)).toBe(90 * 24);
    expect(Math.min(...angebote)).toBe(1);
  });

  it("erstellt nichts ohne Zweck", async () => {
    const user = userEvent.setup();
    const fetchMock = zeige([]);

    await waitFor(() =>
      expect(screen.getByText("Noch kein Gastzugang.")).toBeInTheDocument(),
    );
    await user.click(
      screen.getByRole("button", { name: /Gastzugang erstellen/ }),
    );
    const formular = screen.getByRole("form", { name: "Gastzugang erstellen" });
    await user.click(
      within(formular).getByRole("button", { name: "Gastzugang erstellen" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Zweck");
    // Nur das Laden der Liste, kein Erstellen.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
