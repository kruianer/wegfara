import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bewertungsrunde } from "./bewertungsrunde";
import type { Poi } from "@/lib/pois/types";
import type { Bewertungsrunde as Runde, Stimme } from "@/lib/bewertungen/types";

/**
 * Die laufende Bewertungsrunde im Begleiter (req-054): hier gibt der
 * Teilnehmer seine Stimme ab und sieht die der anderen.
 */

const PERSONEN = [
  { id: "anna", name: "Anna" },
  { id: "bert", name: "Bert" },
  { id: "clara", name: "Clara" },
];

const RUNDE: Runde = {
  id: "runde-1",
  tripId: "trip-1",
  status: "laeuft",
  poiIds: ["poi-1", "poi-2"],
  startedAt: "2026-09-07T10:00:00.000Z",
  endedAt: null,
};

function poi(id: string, name: string): Poi {
  return {
    id,
    tripId: "trip-1",
    number: 1,
    name,
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.649, lng: 14.612 },
    status: "weiss_nicht",
  };
}

const POIS = [poi("poi-1", "Villa Rufolo"), poi("poi-2", "Pompeji")];

function stimme(
  participantId: string,
  wahl: Stimme["wahl"],
  poiId = "poi-1",
): Stimme {
  return { roundId: "runde-1", poiId, participantId, wahl };
}

function runde(stimmen: Stimme[] = []) {
  return render(
    <Bewertungsrunde
      runde={RUNDE}
      pois={POIS}
      stimmen={stimmen}
      personen={PERSONEN}
      selfParticipantId="anna"
    />,
  );
}

/** Antwortet auf /api/stimmen mit der gespeicherten Stimme. */
function antwortetMit(gespeichert: Stimme) {
  const fetchMock = vi.fn(
    async () =>
      ({
        ok: true,
        json: async () => ({ stimme: gespeichert }),
      }) as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Bewertungsrunde im Begleiter (req-054)", () => {
  it("zeigt die POIs der Runde", () => {
    runde();

    expect(screen.getByText("Villa Rufolo")).toBeInTheDocument();
    expect(screen.getByText("Pompeji")).toBeInTheDocument();
  });

  it("bietet je POI die fuenf Stimmen an", () => {
    runde();

    const auswahl = screen.getByRole("group", { name: "Stimme zu Pompeji" });
    for (const label of [
      "Will ich unbedingt",
      "Wäre schön",
      "Wenn wir Zeit haben",
      "Lieber nicht",
      "Ohne mich",
    ]) {
      expect(
        within(auswahl).getByRole("button", { name: label }),
      ).toBeVisible();
    }
  });

  it("speichert die eigene Stimme", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortetMit(stimme("anna", "unbedingt"));
    runde();

    await user.click(
      within(
        screen.getByRole("group", { name: "Stimme zu Villa Rufolo" }),
      ).getByRole("button", { name: "Will ich unbedingt" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/stimmen",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          roundId: "runde-1",
          poiId: "poi-1",
          wahl: "unbedingt",
        }),
      }),
    );
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("group", { name: "Stimme zu Villa Rufolo" }),
        ).getByRole("button", { name: "Will ich unbedingt" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("wechselt eine abgegebene Stimme auf „Ohne mich“", async () => {
    const user = userEvent.setup();
    antwortetMit(stimme("anna", "ohne_mich"));
    runde([stimme("anna", "waere_schoen")]);

    await user.click(
      within(
        screen.getByRole("group", { name: "Stimme zu Villa Rufolo" }),
      ).getByRole("button", { name: "Ohne mich" }),
    );

    await waitFor(() => {
      const auswahl = screen.getByRole("group", {
        name: "Stimme zu Villa Rufolo",
      });
      expect(
        within(auswahl).getByRole("button", { name: "Ohne mich" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        within(auswahl).getByRole("button", { name: "Wäre schön" }),
      ).toHaveAttribute("aria-pressed", "false");
    });
  });

  it("zeigt alle Stimmen mit Namen und wer noch fehlt", () => {
    runde([stimme("anna", "unbedingt"), stimme("bert", "wenn_zeit")]);

    const eintrag = screen.getByTestId("bewertung-poi-1");
    expect(eintrag).toHaveTextContent("Anna — Will ich unbedingt");
    expect(eintrag).toHaveTextContent("Bert — Wenn wir Zeit haben");
    expect(eintrag).toHaveTextContent("Fehlt noch: Clara");
  });

  it("nennt am POI, wer nicht dabei ist", () => {
    runde([stimme("bert", "ohne_mich")]);

    expect(screen.getByTestId("bewertung-poi-1")).toHaveTextContent(
      "Nicht dabei: Bert",
    );
  });
});
