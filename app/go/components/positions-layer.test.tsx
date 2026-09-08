import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionsLayer } from "./positions-layer";
import { MapLibreMap as MockMap, Marker } from "@/tests/mocks/maplibre-gl";
import type { MapLibreMap } from "maplibre-gl";
import type { BenanntePosition } from "@/lib/positions/lade-positionen";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const ladePositionenMock = vi.hoisted(() => vi.fn());
const sendePositionMock = vi.hoisted(() => vi.fn());
const setzePositionTeilenMock = vi.hoisted(() => vi.fn());
const holeStandortMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/positions/lade-positionen", () => ({
  ladePositionen: ladePositionenMock,
}));
vi.mock("@/lib/positions/sende-position", () => ({
  sendePosition: sendePositionMock,
}));
vi.mock("@/lib/positions/setze-teilen", () => ({
  setzePositionTeilen: setzePositionTeilenMock,
}));
vi.mock("@/lib/positions/geolocation", () => ({
  holeStandort: holeStandortMock,
}));

const REISE = "d5fda5ea-65e7-4b47-8096-62618599a288";

function position(overrides: Partial<BenanntePosition> = {}): BenanntePosition {
  return {
    tripId: REISE,
    participantId: "person-1",
    name: "Anna",
    lat: 40.6114,
    lng: 14.6896,
    ort: null,
    recordedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  ladePositionenMock.mockReset().mockResolvedValue([]);
  sendePositionMock.mockReset().mockResolvedValue(undefined);
  setzePositionTeilenMock.mockReset().mockResolvedValue(undefined);
  holeStandortMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderLayer(
  props: Partial<{
    map: MapLibreMap | null;
    tripId: string;
    berechtigt: boolean;
    initialGeteilt: boolean;
  }> = {},
) {
  return render(
    <PositionsLayer
      map={props.map ?? null}
      tripId={props.tripId ?? REISE}
      berechtigt={props.berechtigt ?? true}
      initialGeteilt={props.initialGeteilt ?? false}
    />,
  );
}

describe("PositionsLayer (req-050)", () => {
  it("zeigt den Schalter zunaechst ausgeschaltet", async () => {
    renderLayer({ initialGeteilt: false });

    expect(
      await screen.findByRole("switch", { name: "Meine Position teilen" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("zeigt den Schalter eingeschaltet, wenn die Freigabe schon besteht", async () => {
    holeStandortMock.mockResolvedValue({ ok: true, lat: 1, lng: 2 });
    renderLayer({ initialGeteilt: true });

    expect(
      await screen.findByRole("switch", { name: "Meine Position teilen" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("schaltet beim Antippen ein, holt den Standort und sendet ihn", async () => {
    const user = userEvent.setup();
    holeStandortMock.mockResolvedValue({
      ok: true,
      lat: 40.6114,
      lng: 14.6896,
    });
    renderLayer({ berechtigt: true });

    await user.click(
      screen.getByRole("switch", { name: "Meine Position teilen" }),
    );

    expect(setzePositionTeilenMock).toHaveBeenCalledWith(REISE, true);
    await waitFor(() =>
      expect(sendePositionMock).toHaveBeenCalledWith(REISE, 40.6114, 14.6896),
    );
  });

  it("sendet nichts, wenn die Reise gerade nicht berechtigt ist", async () => {
    const user = userEvent.setup();
    holeStandortMock.mockResolvedValue({
      ok: true,
      lat: 40.6114,
      lng: 14.6896,
    });
    renderLayer({ berechtigt: false });

    await user.click(
      screen.getByRole("switch", { name: "Meine Position teilen" }),
    );

    expect(setzePositionTeilenMock).toHaveBeenCalledWith(REISE, true);
    await waitFor(() => expect(holeStandortMock).toHaveBeenCalled());
    expect(sendePositionMock).not.toHaveBeenCalled();
  });

  it("zeigt einen Hinweis und schaltet sich selbst aus, wenn der Standort abgelehnt wurde", async () => {
    const user = userEvent.setup();
    holeStandortMock.mockResolvedValue({ ok: false, grund: "abgelehnt" });
    renderLayer({ berechtigt: true });

    await user.click(
      screen.getByRole("switch", { name: "Meine Position teilen" }),
    );

    expect(await screen.findByText(/abgelehnt/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Meine Position teilen" }),
      ).toHaveAttribute("aria-checked", "false"),
    );
    expect(setzePositionTeilenMock).toHaveBeenLastCalledWith(REISE, false);
    expect(sendePositionMock).not.toHaveBeenCalled();
  });

  it("blendet die Positionen der Gruppe aus, sobald die Anzeige ausgeschaltet wird", async () => {
    const user = userEvent.setup();
    holeStandortMock.mockResolvedValue({ ok: true, lat: 1, lng: 2 });
    renderLayer({ initialGeteilt: true, berechtigt: true });
    await waitFor(() => expect(sendePositionMock).toHaveBeenCalled());

    await user.click(
      screen.getByRole("button", { name: "Positionen ausblenden" }),
    );

    expect(
      await screen.findByRole("button", { name: "Positionen einblenden" }),
    ).toBeInTheDocument();
  });

  it("zeigt einen Punkt mit Name und Alter je geteilter Position", async () => {
    ladePositionenMock.mockResolvedValue([
      position({
        name: "Anna",
        recordedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
      }),
    ]);
    const map = new MockMap({
      container: document.createElement("div"),
      center: [0, 0],
    }) as unknown as MapLibreMap;

    renderLayer({ map });

    await waitFor(() => expect(Marker.instances.length).toBeGreaterThan(0));
    const marker = Marker.instances.at(-1)!;
    expect(marker.getElement().textContent).toContain("Anna");
    expect(marker.getElement().textContent).toMatch(/vor 2 Min/);
  });

  it("zeigt keinen Punkt, wenn die Anzeige ausgeblendet ist", async () => {
    ladePositionenMock.mockResolvedValue([position()]);
    const user = userEvent.setup();
    const map = new MockMap({
      container: document.createElement("div"),
      center: [0, 0],
    }) as unknown as MapLibreMap;
    renderLayer({ map });
    await waitFor(() => expect(Marker.instances.length).toBeGreaterThan(0));

    await user.click(
      screen.getByRole("button", { name: "Positionen ausblenden" }),
    );

    await waitFor(() => expect(map.getContainer().children.length).toBe(0));
  });
});
