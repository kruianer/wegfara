import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BACKUPS_API } from "@/lib/backup/paths";
import type { BackupEntry, BackupOverview } from "@/lib/backup/types";
import { BackupsCard, LOW_SPACE_WARNING } from "./backups-card";
import { RESTORE_NOT_CONFIRMED } from "./backup-restore-dialog";

const VON_HAND: BackupEntry = {
  id: "20260907_101500_von_hand",
  version: 1,
  createdAt: "2026-09-07T10:15:00.000Z",
  source: "von_hand",
  environment: "prod",
  rowCount: 120,
  imageCount: 3,
  sizeBytes: 5 * 1024 * 1024,
};

const VOR_DEPLOY: BackupEntry = {
  ...VON_HAND,
  id: "20260906_080000_vor_deploy",
  createdAt: "2026-09-06T08:00:00.000Z",
  source: "vor_deploy",
  sizeBytes: 4 * 1024 * 1024,
};

const AUS_DEV: BackupEntry = {
  ...VON_HAND,
  id: "20260905_090000_von_hand",
  createdAt: "2026-09-05T09:00:00.000Z",
  environment: "dev",
};

function uebersicht(overrides: Partial<BackupOverview> = {}): BackupOverview {
  return {
    environment: "prod",
    entries: [VON_HAND, VOR_DEPLOY],
    usedBytes: 9 * 1024 * 1024,
    freeBytes: 200 * 1024 ** 3,
    lowSpace: false,
    ...overrides,
  };
}

/**
 * Die Schnittstellen antworten wie app/api/backups/* -- dort werden sie
 * gegen die echte Ablage geprueft. Hier zaehlt, was die Oberflaeche daraus
 * macht.
 */
function antwortet(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

function zeige(overview = uebersicht(), navigate = vi.fn()) {
  render(<BackupsCard overview={overview} navigate={navigate} />);
  return navigate;
}

function karte() {
  return screen.getByRole("region", { name: "Backups" });
}

describe("BackupsCard (req-053)", () => {
  it("listet die Backups mit Zeitpunkt, Groesse und Herkunft", async () => {
    zeige();

    const liste = karte();
    expect(within(liste).getByText(/07\.09\.2026/)).toBeInTheDocument();
    expect(within(liste).getByText(/5 MB/)).toBeInTheDocument();
    expect(within(liste).getByText(/von Hand/)).toBeInTheDocument();
  });

  it("nennt zu einem Backup des Deploys die Herkunft „vor Deploy“", async () => {
    zeige();

    expect(within(karte()).getByText(/vor Deploy/)).toBeInTheDocument();
  });

  it("zeigt die neuesten zuerst -- in der Reihenfolge des Servers", () => {
    zeige();

    const zeitpunkte = within(karte())
      .getAllByRole("button", { name: /^Wiederherstellen: / })
      .map((button) => button.getAttribute("aria-label"));
    expect(zeitpunkte[0]).toContain("07.09.2026");
    expect(zeitpunkte[1]).toContain("06.09.2026");
  });

  it("nennt belegten und freien Platz", () => {
    zeige();

    expect(screen.getByTestId("backup-space")).toHaveTextContent("9 MB");
    expect(screen.getByTestId("backup-space")).toHaveTextContent("200 GB");
  });

  it("warnt bei weniger als 10 GB frei", () => {
    zeige(uebersicht({ freeBytes: 9 * 1024 ** 3, lowSpace: true }));

    expect(screen.getByTestId("backup-low-space")).toHaveTextContent(
      LOW_SPACE_WARNING,
    );
  });

  it("warnt bei 200 GB frei nicht", () => {
    zeige();

    expect(screen.queryByTestId("backup-low-space")).toBeNull();
  });

  it("nimmt nach „Backup erstellen“ die Liste des Servers", async () => {
    const neu: BackupEntry = {
      ...VON_HAND,
      id: "20260908_120000_von_hand",
      createdAt: "2026-09-08T12:00:00.000Z",
    };
    const fetchMock = antwortet(200, uebersicht({ entries: [neu, VON_HAND] }));
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Backup erstellen" }),
    );

    await waitFor(() =>
      expect(within(karte()).getByText(/08\.09\.2026/)).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(BACKUPS_API, { method: "POST" });
    vi.unstubAllGlobals();
  });

  it("meldet, wenn das Backup nicht angelegt werden konnte", async () => {
    vi.stubGlobal("fetch", antwortet(500, {}));
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Backup erstellen" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("backup-notice")).toBeInTheDocument(),
    );
    vi.unstubAllGlobals();
  });

  it("loescht einen Eintrag auf Wunsch", async () => {
    const fetchMock = antwortet(200, uebersicht({ entries: [VOR_DEPLOY] }));
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: /^Löschen: 07\.09\.2026/ }),
    );

    await waitFor(() =>
      expect(within(karte()).queryByText(/07\.09\.2026/)).toBeNull(),
    );
    expect(fetchMock.mock.calls[0][0]).toContain(VON_HAND.id);
    vi.unstubAllGlobals();
  });

  it("sagt es, solange nichts gesichert wurde", () => {
    zeige(uebersicht({ entries: [], usedBytes: 0 }));

    expect(
      within(karte()).getByText("Noch kein Backup vorhanden."),
    ).toBeInTheDocument();
  });
});

describe("Sicherheitsabfrage vor der Wiederherstellung (req-053)", () => {
  /** Oeffnet die Abfrage zum juengsten Backup der Liste. */
  async function oeffneAbfrage(overview = uebersicht({ entries: [VON_HAND] })) {
    const navigate = zeige(overview);
    await userEvent.click(
      screen.getByRole("button", { name: /^Wiederherstellen: / }),
    );
    return { navigate };
  }

  it("nennt Zeitpunkt und Herkunft des Backups", async () => {
    await oeffneAbfrage();

    expect(screen.getByTestId("backup-restore-target")).toHaveTextContent(
      /07\.09\.2026/,
    );
    expect(screen.getByTestId("backup-restore-target")).toHaveTextContent(
      /von Hand/,
    );
  });

  it("hat das Häkchen „Vorher den jetzigen Stand sichern“ vorausgewählt", async () => {
    await oeffneAbfrage();

    expect(
      screen.getByRole("checkbox", {
        name: /Vorher den jetzigen Stand sichern/,
      }),
    ).toBeChecked();
  });

  it("stellt ohne das eingetippte Wort nichts wieder her", async () => {
    const fetchMock = antwortet(200, {});
    vi.stubGlobal("fetch", fetchMock);
    await oeffneAbfrage();

    await userEvent.click(
      within(
        screen.getByRole("alertdialog", { name: "Backup wiederherstellen" }),
      ).getByRole("button", { name: "Wiederherstellen" }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("backup-restore-error")).toHaveTextContent(
      RESTORE_NOT_CONFIRMED,
    );
    vi.unstubAllGlobals();
  });

  it("stellt nach dem eingetippten Wort wieder her und fuehrt zur Anmeldung", async () => {
    const fetchMock = antwortet(200, {});
    vi.stubGlobal("fetch", fetchMock);
    const { navigate } = await oeffneAbfrage();

    await userEvent.type(
      screen.getByLabelText(/Zum Bestätigen/),
      "wiederherstellen",
    );
    await userEvent.click(
      within(
        screen.getByRole("alertdialog", { name: "Backup wiederherstellen" }),
      ).getByRole("button", { name: "Wiederherstellen" }),
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/anmeldung"));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      bestaetigung: "wiederherstellen",
      vorherSichern: true,
    });
    vi.unstubAllGlobals();
  });

  it("gibt das abgewaehlte Häkchen weiter", async () => {
    const fetchMock = antwortet(200, {});
    vi.stubGlobal("fetch", fetchMock);
    await oeffneAbfrage();

    await userEvent.click(
      screen.getByRole("checkbox", {
        name: /Vorher den jetzigen Stand sichern/,
      }),
    );
    await userEvent.type(
      screen.getByLabelText(/Zum Bestätigen/),
      "wiederherstellen",
    );
    await userEvent.click(
      within(
        screen.getByRole("alertdialog", { name: "Backup wiederherstellen" }),
      ).getByRole("button", { name: "Wiederherstellen" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse((init as { body: string }).body).vorherSichern).toBe(
      false,
    );
    vi.unstubAllGlobals();
  });

  it("warnt ausdruecklich vor einem Backup aus einer anderen Umgebung", async () => {
    zeige(uebersicht({ entries: [AUS_DEV], environment: "prod" }));

    await userEvent.click(
      screen.getByRole("button", { name: /^Wiederherstellen: / }),
    );

    const warnung = screen.getByTestId("backup-environment-warning");
    expect(warnung).toHaveTextContent("dev");
    expect(warnung).toHaveTextContent("prod");
    expect(warnung).toHaveTextContent(/Zugangsschlüssel/);
  });

  it("warnt bei einem Backup derselben Umgebung nicht", async () => {
    await oeffneAbfrage();

    expect(screen.queryByTestId("backup-environment-warning")).toBeNull();
  });

  it("meldet eine fehlgeschlagene Wiederherstellung", async () => {
    vi.stubGlobal("fetch", antwortet(500, {}));
    const { navigate } = await oeffneAbfrage();

    await userEvent.type(
      screen.getByLabelText(/Zum Bestätigen/),
      "wiederherstellen",
    );
    await userEvent.click(
      within(
        screen.getByRole("alertdialog", { name: "Backup wiederherstellen" }),
      ).getByRole("button", { name: "Wiederherstellen" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("backup-restore-error")).toBeInTheDocument(),
    );
    expect(navigate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
