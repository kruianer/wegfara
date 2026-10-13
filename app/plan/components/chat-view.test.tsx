import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import type { Poi } from "@/lib/pois/types";
import { DEFAULT_MAP_VISIBLE_STATUSES } from "@/lib/pois/status-meta";
import { VORGEWAEHLTES_CHAT_MODELL } from "@/lib/chat/modelle";
import { ChatView } from "./chat-view";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const MAIN_PLACE = { name: "Amalfi", lat: 40.6333, lng: 14.6027 };

const DOM: Poi = {
  id: "poi-1",
  tripId: TRIP_ID,
  number: 1,
  name: "Dom von Amalfi",
  ort: "Amalfi",
  type: "sehenswuerdigkeit",
  position: { lat: 40.6341, lng: 14.6027 },
  status: "gesetzt",
};

// Die Kartenansicht wartet nach dem Mounten einen Frame ab, bevor sie Groesse
// und Marker anlegt (siehe poi-map.tsx, bug-003).
async function flushMapReady() {
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
}

function zeige(windowWidth = 1280) {
  return render(
    <ChatView
      tripId={TRIP_ID}
      pois={[DOM]}
      mainPlace={MAIN_PLACE}
      windowWidth={windowWidth}
      searchArea={null}
      onSearchAreaChanged={vi.fn()}
      visibleMapStatuses={DEFAULT_MAP_VISIBLE_STATUSES}
      onToggleMapStatus={vi.fn()}
      hasAnthropicKey
      modell={VORGEWAEHLTES_CHAT_MODELL}
      onModellChange={vi.fn()}
    />,
  );
}

beforeEach(() => {
  // Die Schnittstelle des Chats aus dem Haus -- kein Test haengt im Netz
  // (stack.md, Testing).
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ nachrichten: [] })),
  );
});

/**
 * req-081: Der Bereich ist zweigeteilt wie der Bereich "POIs" -- links das
 * Chatfenster, rechts die vorhandene Karte der Reise mit ihren POIs.
 */
describe("Bereich Chat des Planers (req-081)", () => {
  it("stellt das Chatfenster links", async () => {
    zeige();
    await flushMapReady();

    const links = screen.getByTestId("split-pane-left");
    expect(
      within(links).getByRole("region", { name: "Chat" }),
    ).toBeInTheDocument();
    expect(
      within(links).getByRole("textbox", { name: "Nachricht" }),
    ).toBeInTheDocument();
  });

  it("stellt die Karte der Reise rechts", async () => {
    zeige();
    await flushMapReady();

    const rechts = screen.getByTestId("split-pane-right");
    expect(within(rechts).getByTestId("poi-map")).toBeInTheDocument();
  });

  it("zeigt die POIs der Reise auf der Karte", async () => {
    zeige();
    await flushMapReady();

    expect(
      screen.getByRole("button", { name: /Dom von Amalfi/ }),
    ).toBeInTheDocument();
  });

  /**
   * Auf 1280 px sind beide benutzbar: die geteilte Ansicht gibt jeder Spalte
   * die halbe Breite, und die Trennleiste laesst sie verschieben.
   */
  it("gibt auf 1280 px beiden Spalten Platz", async () => {
    zeige(1280);
    await flushMapReady();

    expect(screen.getByTestId("split-pane-left")).toHaveStyle({
      width: "640px",
    });
    expect(
      screen.getByRole("separator", { name: "Spaltenbreite anpassen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Liste ausblenden" }),
    ).toBeInTheDocument();
  });
});
