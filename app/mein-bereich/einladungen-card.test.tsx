import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OpenInvitation } from "@/lib/db/account-users";
import type { Participant } from "@/lib/participants/types";
import { USER_ERRORS } from "@/lib/users/request-users";
import { EinladungenCard } from "./einladungen-card";

const CLARA_ID = "1a2b3c4d-0000-4000-8000-000000000002";

const OFFEN: OpenInvitation = {
  participantId: CLARA_ID,
  name: "Clara Berger",
  email: "clara@example.com",
  expiresAt: "2026-09-11T10:00:00.000Z",
};

const CLARA: Participant = {
  id: CLARA_ID,
  accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
  name: "Clara Berger",
  nickname: null,
  email: "clara@example.com",
  phone: null,
  iban: null,
  loginEnabled: false,
  accountAdmin: false,
};

const ZUGANGSLINK = {
  participantId: CLARA_ID,
  url: "https://dev.wegfara.com/einladung?token=geheim",
  qr: { size: 25, path: "M0 0h1v1h-1z" },
  expiresAt: "2026-09-11T10:00:00.000Z",
};

/**
 * Die Schnittstelle antwortet wie app/api/nutzer/einladungen/route.ts --
 * dort wird sie gegen die echte Datenbank geprueft. Hier zaehlt, was die
 * Karte daraus macht.
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
  invitations: OpenInvitation[] = [],
  antworten: { status: number; payload: unknown }[] = [],
  onParticipantInvited: (participant: Participant) => void = () => {},
) {
  const fetchMock = antwortet(antworten);
  render(
    <EinladungenCard
      invitations={invitations}
      onParticipantInvited={onParticipantInvited}
    />,
  );
  return fetchMock;
}

async function ladeEin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Einladen/ }));
  const formular = screen.getByRole("form", { name: "Nutzer einladen" });
  await user.type(
    within(formular).getByLabelText("E-Mail-Adresse"),
    "clara@example.com",
  );
  await user.type(within(formular).getByLabelText("Name"), "Clara Berger");
  await user.click(within(formular).getByRole("button", { name: "Einladen" }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Karte Einladungen (req-038, req-043)", () => {
  it("zeigt offene Einladungen mit Ablaufdatum und Zurückziehen", () => {
    zeige([OFFEN]);

    const karte = screen.getByRole("region", { name: "Einladungen" });
    expect(karte).toHaveTextContent("clara@example.com");
    expect(karte).toHaveTextContent("11.09.2026");
    expect(
      within(karte).getByRole("button", {
        name: "Einladung zurückziehen: Clara Berger",
      }),
    ).toBeInTheDocument();
  });

  it("sagt, wenn keine Einladung offen ist", () => {
    zeige([]);

    expect(screen.getByText("Keine offene Einladung.")).toBeInTheDocument();
  });

  it("nimmt eine Einladung zurück", async () => {
    const user = userEvent.setup();
    zeige([OFFEN], [{ status: 200, payload: {} }]);

    await user.click(
      screen.getByRole("button", {
        name: "Einladung zurückziehen: Clara Berger",
      }),
    );

    await waitFor(() =>
      expect(screen.getByText("Keine offene Einladung.")).toBeInTheDocument(),
    );
  });

  it("nennt den Grund, wenn das Zurückziehen fehlschlägt", async () => {
    const user = userEvent.setup();
    zeige([OFFEN], [{ status: 500, payload: {} }]);

    await user.click(
      screen.getByRole("button", {
        name: "Einladung zurückziehen: Clara Berger",
      }),
    );

    expect(await screen.findByTestId("nutzer-notice")).toHaveTextContent(
      USER_ERRORS.withdrawFailed,
    );
  });

  /** req-043: der Zugangslink erscheint als Text und als QR-Code. */
  it("lädt per E-Mail ein und zeigt den Link als Text und als QR-Code", async () => {
    const user = userEvent.setup();
    zeige(
      [],
      [
        {
          status: 201,
          payload: { participant: CLARA, invitation: ZUGANGSLINK },
        },
      ],
    );

    await ladeEin(user);

    const panel = await screen.findByTestId("invitation-panel");
    expect(within(panel).getByTestId("invitation-link")).toHaveTextContent(
      ZUGANGSLINK.url,
    );
    expect(
      within(panel).getByLabelText("QR-Code der Einladung für Clara Berger"),
    ).toBeInTheDocument();
  });

  it("reiht die neue Einladung in die offenen ein", async () => {
    const user = userEvent.setup();
    zeige(
      [],
      [
        {
          status: 201,
          payload: { participant: CLARA, invitation: ZUGANGSLINK },
        },
      ],
    );

    await ladeEin(user);

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Einladung zurückziehen: Clara Berger",
        }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Keine offene Einladung.")).toBeNull();
  });

  /** Eine neue Einladung entwertet die vorherige (req-023). */
  it("führt zu derselben Person nur eine offene Einladung", async () => {
    const user = userEvent.setup();
    zeige(
      [OFFEN],
      [
        {
          status: 201,
          payload: { participant: CLARA, invitation: ZUGANGSLINK },
        },
      ],
    );

    await ladeEin(user);

    await waitFor(() =>
      expect(
        screen.getAllByRole("button", {
          name: "Einladung zurückziehen: Clara Berger",
        }),
      ).toHaveLength(1),
    );
  });

  it("meldet die eingeladene Person nach oben", async () => {
    const user = userEvent.setup();
    const eingeladen = vi.fn();
    zeige(
      [],
      [
        {
          status: 201,
          payload: { participant: CLARA, invitation: ZUGANGSLINK },
        },
      ],
      eingeladen,
    );

    await ladeEin(user);

    await waitFor(() => expect(eingeladen).toHaveBeenCalledWith(CLARA));
  });

  it("nennt die Rückmeldung, wenn die Adresse fehlt", async () => {
    const user = userEvent.setup();
    zeige(
      [],
      [
        {
          status: 400,
          payload: { errors: { email: "Diese Adresse wird gebraucht." } },
        },
      ],
    );

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
});
