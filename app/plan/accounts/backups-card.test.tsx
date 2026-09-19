import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BACKUPS_API } from "@/lib/backup/paths";
import { BACKUP_ERRORS } from "@/lib/backup/request-backups";
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

  it("traegt zu jedem Backup einen Weg zum Herunterladen", async () => {
    // req-071: der Link zeigt auf die Adresse dieses Backups und laedt
    // herunter, statt die Seite zu verlassen.
    zeige();

    const link = within(karte()).getByRole("link", {
      name: /^Herunterladen: 07\.09\.2026/,
    });
    expect(link).toHaveAttribute(
      "href",
      `${BACKUPS_API}/${VON_HAND.id}/herunterladen`,
    );
    expect(link).toHaveAttribute("download");
  });

  it("nennt im Dateinamen des Links Umgebung und Zeitpunkt (req-071)", () => {
    zeige();

    const link = within(karte()).getByRole("link", {
      name: /^Herunterladen: 07\.09\.2026/,
    });
    expect(link.getAttribute("download")).toContain("prod");
    expect(link.getAttribute("download")).toContain("20260907_101500");
  });

  it("sagt es, solange nichts gesichert wurde", () => {
    zeige(uebersicht({ entries: [], usedBytes: 0 }));

    expect(
      within(karte()).getByText("Noch kein Backup vorhanden."),
    ).toBeInTheDocument();
  });
});

describe("Hochladen einer heruntergeladenen Datei (req-071)", () => {
  const HOCHGELADEN: BackupEntry = {
    ...VON_HAND,
    id: "20260901_070000_von_hand",
    createdAt: "2026-09-01T07:00:00.000Z",
  };

  function zipDatei(name = "wegfara-backup-prod-20260901_070000_von_hand.zip") {
    return new File([new Uint8Array([80, 75, 5, 6])], name, {
      type: "application/zip",
    });
  }

  function feld() {
    return within(karte()).getByLabelText("Backup hochladen");
  }

  it("nimmt eine Datei entgegen und zeigt danach die Liste des Servers", async () => {
    const fetchMock = antwortet(
      200,
      uebersicht({ entries: [VON_HAND, HOCHGELADEN] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    await userEvent.upload(feld(), zipDatei());

    await waitFor(() =>
      expect(within(karte()).getByText(/01\.09\.2026/)).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls[0][0]).toBe(`${BACKUPS_API}/hochladen`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    vi.unstubAllGlobals();
  });

  it("schickt die Datei selbst, ohne sie zu kopieren", async () => {
    const fetchMock = antwortet(200, uebersicht());
    vi.stubGlobal("fetch", fetchMock);
    zeige();
    const datei = zipDatei();

    await userEvent.upload(feld(), datei);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0][1] as { body: unknown }).body).toBe(datei);
    vi.unstubAllGlobals();
  });

  it("nennt den Grund des Servers, wenn die Datei kein ZIP ist", async () => {
    vi.stubGlobal(
      "fetch",
      antwortet(400, { error: "Die Datei ist kein ZIP-Archiv." }),
    );
    zeige();

    await userEvent.upload(feld(), zipDatei("urlaub.jpg"));

    await waitFor(() =>
      expect(screen.getByTestId("backup-notice")).toHaveTextContent(
        "Die Datei ist kein ZIP-Archiv.",
      ),
    );
    // Die Liste bleibt, wie sie war.
    expect(within(karte()).getByText(/07\.09\.2026/)).toBeInTheDocument();
    expect(within(karte()).queryByText(/01\.09\.2026/)).toBeNull();
    vi.unstubAllGlobals();
  });

  it("nennt den fehlenden Bestandteil", async () => {
    vi.stubGlobal(
      "fetch",
      antwortet(400, { error: "Im Archiv fehlt „datenbank.json“." }),
    );
    zeige();

    await userEvent.upload(feld(), zipDatei());

    await waitFor(() =>
      expect(screen.getByTestId("backup-notice")).toHaveTextContent(
        "Im Archiv fehlt „datenbank.json“.",
      ),
    );
    vi.unstubAllGlobals();
  });

  it("meldet auch einen Fehler ohne Begruendung, statt ihn zu verschlucken", async () => {
    vi.stubGlobal("fetch", antwortet(500, {}));
    zeige();

    await userEvent.upload(feld(), zipDatei());

    await waitFor(() =>
      expect(screen.getByTestId("backup-notice")).toHaveTextContent(
        BACKUP_ERRORS.upload,
      ),
    );
    vi.unstubAllGlobals();
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
