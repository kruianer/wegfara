import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountUser, OpenInvitation } from "@/lib/db/account-users";
import { ACCOUNT_ADMIN_ERRORS } from "@/lib/participants/account-admin";
import { NutzerView } from "./nutzer-view";

const BETREIBER: AccountUser = {
  id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
  name: "Uwe Kremmel",
  nickname: null,
  email: "uwe@kremmel.org",
  accountAdmin: true,
  loginEnabled: true,
  joinedAt: "2026-01-04T10:00:00.000Z",
  lastSignInAt: "2026-09-03T18:00:00.000Z",
};

const CLARA: AccountUser = {
  id: "1a2b3c4d-0000-4000-8000-000000000002",
  name: "Clara Berger",
  nickname: null,
  email: "clara@example.com",
  accountAdmin: false,
  loginEnabled: false,
  joinedAt: "2026-09-04T10:00:00.000Z",
  lastSignInAt: null,
};

const OFFEN: OpenInvitation = {
  participantId: CLARA.id,
  name: "Clara Berger",
  email: "clara@example.com",
  expiresAt: "2026-09-11T10:00:00.000Z",
};

/**
 * Die Schnittstellen antworten wie app/api/nutzer/route.ts und
 * app/api/nutzer/einladungen/route.ts -- dort werden sie gegen die echte
 * Datenbank geprueft. Hier zaehlt, was der Bereich daraus macht.
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

function zeige(
  users: AccountUser[],
  invitations: OpenInvitation[],
  weitere: { status: number; payload: unknown }[] = [],
  onParticipantRemoved = () => {},
) {
  const fetchMock = antwortet([
    { status: 200, payload: { users, invitations } },
    ...weitere,
  ]);
  render(
    <NutzerView
      selfParticipantId={BETREIBER.id}
      onParticipantRemoved={onParticipantRemoved}
    />,
  );
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Bereich Nutzer (req-038)", () => {
  it("zeigt Name, E-Mail, Kennzeichnung, Beitritt und letzte Anmeldung", async () => {
    zeige([BETREIBER, CLARA], []);

    await screen.findByText("Clara Berger");
    const karte = screen.getByRole("region", { name: "Personen" });

    expect(karte).toHaveTextContent("uwe@kremmel.org");
    expect(karte).toHaveTextContent("04.01.2026");
    expect(karte).toHaveTextContent("03.09.2026");
    expect(
      screen.getByRole("checkbox", { name: "Bereichs-Admin: Uwe Kremmel" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Bereichs-Admin: Clara Berger" }),
    ).not.toBeChecked();
  });

  it("zeigt eine noch nie angemeldete Person mit einem Gedankenstrich", async () => {
    zeige([CLARA], []);

    await screen.findByText("Clara Berger");
    expect(screen.getByRole("region", { name: "Personen" })).toHaveTextContent(
      "—",
    );
  });

  it("zeigt offene Einladungen mit Ablaufdatum und Zurückziehen", async () => {
    zeige([BETREIBER, CLARA], [OFFEN]);

    const karte = await screen.findByRole("region", {
      name: "Offene Einladungen",
    });

    expect(karte).toHaveTextContent("clara@example.com");
    expect(karte).toHaveTextContent("11.09.2026");
    expect(
      within(karte).getByRole("button", {
        name: "Einladung zurückziehen: Clara Berger",
      }),
    ).toBeInTheDocument();
  });

  it("nimmt eine Einladung zurück", async () => {
    const user = userEvent.setup();
    zeige([BETREIBER, CLARA], [OFFEN], [{ status: 200, payload: {} }]);

    await user.click(
      await screen.findByRole("button", {
        name: "Einladung zurückziehen: Clara Berger",
      }),
    );

    await waitFor(() =>
      expect(screen.getByText("Keine offene Einladung.")).toBeInTheDocument(),
    );
  });

  it("laedt per E-Mail ein und zeigt den Link genau einmal", async () => {
    const user = userEvent.setup();
    zeige(
      [BETREIBER],
      [],
      [
        {
          status: 201,
          payload: {
            participant: { id: CLARA.id },
            invitation: {
              participantId: CLARA.id,
              url: "https://dev.wegfara.com/einladung?token=geheim",
              qr: { size: 25, path: "M0 0h1v1h-1z" },
              expiresAt: "2026-09-11T10:00:00.000Z",
            },
          },
        },
        {
          status: 200,
          payload: { users: [BETREIBER, CLARA], invitations: [OFFEN] },
        },
      ],
    );

    await screen.findByText("Uwe Kremmel");
    await user.click(screen.getByRole("button", { name: /Einladen/ }));
    const formular = screen.getByRole("form", { name: "Nutzer einladen" });
    await user.type(
      within(formular).getByLabelText("E-Mail-Adresse"),
      "clara@example.com",
    );
    await user.type(within(formular).getByLabelText("Name"), "Clara Berger");
    await user.click(
      within(formular).getByRole("button", { name: "Einladen" }),
    );

    const panel = await screen.findByTestId("invitation-panel");
    expect(panel).toHaveTextContent(
      "https://dev.wegfara.com/einladung?token=geheim",
    );
  });

  it("nennt die Rückmeldung, wenn die Adresse fehlt", async () => {
    const user = userEvent.setup();
    zeige(
      [BETREIBER],
      [],
      [
        {
          status: 400,
          payload: { errors: { email: "Diese Adresse wird gebraucht." } },
        },
      ],
    );

    await screen.findByText("Uwe Kremmel");
    await user.click(screen.getByRole("button", { name: /Einladen/ }));
    const formular = screen.getByRole("form", { name: "Nutzer einladen" });
    await user.type(within(formular).getByLabelText("Name"), "Clara Berger");
    await user.click(
      within(formular).getByRole("button", { name: "Einladen" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Diese Adresse wird gebraucht.",
    );
  });

  it("entfernt eine Person erst nach Rückfrage und meldet das nach oben", async () => {
    const user = userEvent.setup();
    const entfernt = vi.fn();
    zeige([BETREIBER, CLARA], [], [{ status: 200, payload: {} }], entfernt);

    await user.click(
      await screen.findByRole("button", {
        name: "Person entfernen: Clara Berger",
      }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "Person entfernen",
    });
    expect(dialog).toHaveTextContent("sofort abgemeldet");
    await user.click(
      within(dialog).getByRole("button", { name: "Endgültig entfernen" }),
    );

    await waitFor(() => expect(entfernt).toHaveBeenCalledWith(CLARA.id));
    expect(screen.queryByText("Clara Berger")).toBeNull();
  });

  it("bietet zur eigenen Person kein Entfernen an", async () => {
    zeige([BETREIBER, CLARA], []);

    await screen.findByText("Clara Berger");
    expect(
      screen.queryByRole("button", {
        name: "Person entfernen: Uwe Kremmel",
      }),
    ).toBeNull();
  });

  it("nennt den Grund, wenn der letzte Bereichs-Admin bleiben muss", async () => {
    const user = userEvent.setup();
    zeige(
      [BETREIBER, CLARA],
      [],
      [
        {
          status: 409,
          payload: {
            error: "lastAdmin",
            message: ACCOUNT_ADMIN_ERRORS.lastAdmin,
          },
        },
      ],
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Person entfernen: Clara Berger",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Endgültig entfernen" }),
    );

    expect(await screen.findByTestId("nutzer-notice")).toHaveTextContent(
      ACCOUNT_ADMIN_ERRORS.lastAdmin,
    );
  });

  it("entzieht dem letzten Bereichs-Admin die Kennzeichnung nicht", async () => {
    const user = userEvent.setup();
    const fetchMock = zeige([BETREIBER, CLARA], []);

    await screen.findByText("Clara Berger");
    await user.click(
      screen.getByRole("checkbox", { name: "Bereichs-Admin: Uwe Kremmel" }),
    );

    expect(await screen.findByTestId("nutzer-notice")).toHaveTextContent(
      ACCOUNT_ADMIN_ERRORS.lastAdmin,
    );
    // Nur das Laden der Liste -- gespeichert wurde nichts.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
