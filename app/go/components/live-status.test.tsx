import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Activity } from "@/lib/activities/types";
import type { Standortlage } from "@/lib/live-status/types";
import { LiveStatus } from "./live-status";

const REISE = "d5fda5ea-65e7-4b47-8096-62618599a288";

const MITTAGESSEN: Activity = {
  id: "activity-1",
  tripId: REISE,
  type: "restaurant",
  title: "Mittagessen Positano",
  shortText: "",
  longText: "",
  startAt: "2026-07-20T13:30",
  endAt: "2026-07-20T15:00",
  position: { lat: 40.6281, lng: 14.4842 },
};

const FRUEHSTUECK: Activity = {
  ...MITTAGESSEN,
  id: "activity-2",
  title: "Frühstück im Hotel",
  startAt: "2026-07-20T09:00",
  endAt: "2026-07-20T10:00",
};

const OHNE_STANDORT: Standortlage = { ort: null, verzug: { art: "keiner" } };

function serverAntwortet(lage: Standortlage) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => lage })),
  );
}

function zeige(
  jetzt: string,
  activities: Activity[] = [FRUEHSTUECK, MITTAGESSEN],
) {
  render(<LiveStatus tripId={REISE} activities={activities} jetzt={jetzt} />);
}

beforeEach(() => {
  serverAntwortet(OHNE_STANDORT);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LiveStatus (req-051)", () => {
  it("zeigt die Zeile mit der aktuellen Uhrzeit", async () => {
    zeige("2026-07-20T14:10");

    expect(
      await screen.findByText("LIVE-STATUS · 14:10 UHR"),
    ).toBeInTheDocument();
  });

  it("nennt unter 'Laut Plan' den laufenden Programmpunkt", async () => {
    zeige("2026-07-20T14:10");

    expect(await screen.findByText("Laut Plan")).toBeInTheDocument();
    expect(screen.getByText("Mittagessen Positano")).toBeInTheDocument();
  });

  it("nennt unter 'Laut GPS' den Ort der geteilten Position", async () => {
    serverAntwortet({ ort: "Praiano", verzug: { art: "im_zeitplan" } });

    zeige("2026-07-20T14:10");

    expect(await screen.findByText("Laut GPS")).toBeInTheDocument();
    expect(screen.getByText("Praiano")).toBeInTheDocument();
  });

  it("zeigt den Verzug in der Status-Pille", async () => {
    serverAntwortet({
      ort: "Praiano",
      verzug: { art: "verspaetet", minuten: 25 },
    });

    zeige("2026-07-20T14:10");

    expect(await screen.findByText("25 Min zu spät")).toBeInTheDocument();
  });

  it("zeigt 'Im Zeitplan', wenn die Gruppe da ist", async () => {
    serverAntwortet({ ort: "Positano", verzug: { art: "im_zeitplan" } });

    zeige("2026-07-20T14:10");

    expect(await screen.findByText("Im Zeitplan")).toBeInTheDocument();
  });

  it("zeigt ohne geteilte Position kein 'Laut GPS' und keinen Verzug", async () => {
    zeige("2026-07-20T14:10");

    expect(await screen.findByText("Laut Plan")).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText("Laut GPS")).not.toBeInTheDocument();
    expect(screen.queryByText(/zu spät|Im Zeitplan/)).not.toBeInTheDocument();
  });

  it("nennt den naechsten Programmpunkt mit seiner Uhrzeit, wenn keiner laeuft", async () => {
    serverAntwortet({ ort: "Praiano", verzug: { art: "im_zeitplan" } });

    zeige("2026-07-20T07:00");

    expect(await screen.findByText("Frühstück im Hotel")).toBeInTheDocument();
    expect(screen.getByText("ab 09:00")).toBeInTheDocument();
  });

  it("zeigt keinen Verzug, wenn gerade kein Programmpunkt laeuft", async () => {
    serverAntwortet({
      ort: "Praiano",
      verzug: { art: "verspaetet", minuten: 25 },
    });

    zeige("2026-07-20T07:00");

    expect(await screen.findByText("Praiano")).toBeInTheDocument();
    expect(screen.queryByText("25 Min zu spät")).not.toBeInTheDocument();
  });

  it("weist darauf hin, wenn sich der Verzug nicht ermitteln laesst", async () => {
    serverAntwortet({ ort: "Praiano", verzug: { art: "unbekannt" } });

    zeige("2026-07-20T14:10");

    expect(await screen.findByText(/nicht ermittel/i)).toBeInTheDocument();
    expect(screen.getByText("Mittagessen Positano")).toBeInTheDocument();
    expect(screen.getByText("Praiano")).toBeInTheDocument();
  });

  it("fragt Ort und Verzug fuer die geoeffnete Reise ab", async () => {
    zeige("2026-07-20T14:10");

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/live-status?reise=${REISE}`,
        expect.anything(),
      ),
    );
  });

  it("sagt es, wenn heute nichts mehr geplant ist", async () => {
    zeige("2026-07-20T22:00");

    expect(await screen.findByText(/Nichts mehr/)).toBeInTheDocument();
  });
});
