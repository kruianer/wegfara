import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PoiLinkImport } from "./poi-link-import";
import type { Poi } from "@/lib/pois/types";
import { importPoiFromGoogleLink } from "@/lib/pois/import-google-link";

vi.mock("@/lib/pois/import-google-link", async (original) => ({
  ...(await original<typeof import("@/lib/pois/import-google-link")>()),
  importPoiFromGoogleLink: vi.fn(),
}));

const mockedImport = vi.mocked(importPoiFromGoogleLink);

const LINK = "https://maps.app.goo.gl/aBcD1234";

function villaRufolo(): Poi {
  return {
    id: "poi-neu",
    tripId: "trip-1",
    number: 13,
    name: "Villa Rufolo",
    ort: "Ravello",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6491, lng: 14.6113 },
    status: "weiss_nicht",
    photos: [],
  };
}

beforeEach(() => {
  mockedImport.mockReset();
});

describe("PoiLinkImport (req-026)", () => {
  it("ist ohne eingefuegten Link nicht bedienbar", () => {
    render(<PoiLinkImport tripId="trip-1" onPoiImported={() => {}} />);

    expect(screen.getByRole("button", { name: "POI aus Link" })).toBeDisabled();
  });

  it("schickt den eingefuegten Link an den Server und meldet den POI weiter", async () => {
    const user = userEvent.setup();
    const onPoiImported = vi.fn();
    mockedImport.mockResolvedValue({
      result: "angelegt",
      poi: villaRufolo(),
    });
    render(<PoiLinkImport tripId="trip-1" onPoiImported={onPoiImported} />);

    await user.type(
      screen.getByRole("textbox", { name: "Google-Maps-Link" }),
      LINK,
    );
    await user.click(screen.getByRole("button", { name: "POI aus Link" }));

    expect(mockedImport).toHaveBeenCalledWith("trip-1", LINK);
    expect(onPoiImported).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Villa Rufolo" }),
    );
  });

  it("meldet in der Ergebniszeile, dass der POI angelegt wurde", async () => {
    const user = userEvent.setup();
    mockedImport.mockResolvedValue({
      result: "angelegt",
      poi: villaRufolo(),
    });
    render(<PoiLinkImport tripId="trip-1" onPoiImported={() => {}} />);

    await user.type(
      screen.getByRole("textbox", { name: "Google-Maps-Link" }),
      LINK,
    );
    await user.click(screen.getByRole("button", { name: "POI aus Link" }));

    expect(screen.getByTestId("poi-link-result")).toHaveTextContent(
      "Villa Rufolo" + '" angelegt.',
    );
  });

  it("meldet in der Ergebniszeile, dass der POI aufgefrischt wurde", async () => {
    const user = userEvent.setup();
    mockedImport.mockResolvedValue({
      result: "aufgefrischt",
      poi: villaRufolo(),
    });
    render(<PoiLinkImport tripId="trip-1" onPoiImported={() => {}} />);

    await user.type(
      screen.getByRole("textbox", { name: "Google-Maps-Link" }),
      LINK,
    );
    await user.click(screen.getByRole("button", { name: "POI aus Link" }));

    expect(screen.getByTestId("poi-link-result")).toHaveTextContent(
      "aufgefrischt.",
    );
  });

  it("nennt den Grund, wenn der Text kein Google-Maps-Link ist", async () => {
    const user = userEvent.setup();
    const onPoiImported = vi.fn();
    mockedImport.mockResolvedValue({
      result: "fehler",
      reason: "kein_google_link",
    });
    render(<PoiLinkImport tripId="trip-1" onPoiImported={onPoiImported} />);

    await user.type(
      screen.getByRole("textbox", { name: "Google-Maps-Link" }),
      "Villa Rufolo",
    );
    await user.click(screen.getByRole("button", { name: "POI aus Link" }));

    expect(screen.getByTestId("poi-link-result")).toHaveTextContent(
      "Das ist kein Google-Maps-Link.",
    );
    expect(onPoiImported).not.toHaveBeenCalled();
  });

  it("nennt den Grund, wenn die Abfrage bei Google fehlschlaegt", async () => {
    const user = userEvent.setup();
    mockedImport.mockResolvedValue({
      result: "fehler",
      reason: "abfrage_fehlgeschlagen",
    });
    render(<PoiLinkImport tripId="trip-1" onPoiImported={() => {}} />);

    await user.type(
      screen.getByRole("textbox", { name: "Google-Maps-Link" }),
      LINK,
    );
    await user.click(screen.getByRole("button", { name: "POI aus Link" }));

    expect(screen.getByTestId("poi-link-result")).toHaveTextContent(
      "Die Abfrage bei Google ist fehlgeschlagen.",
    );
  });

  it("sperrt das Feld waehrend der Abfrage und zeigt, dass gearbeitet wird", async () => {
    const user = userEvent.setup();
    let aufloesen: (wert: { result: "angelegt"; poi: Poi }) => void = () => {};
    mockedImport.mockReturnValue(
      new Promise((resolve) => {
        aufloesen = resolve;
      }),
    );
    render(<PoiLinkImport tripId="trip-1" onPoiImported={() => {}} />);
    const feld = screen.getByRole("textbox", { name: "Google-Maps-Link" });

    await user.type(feld, LINK);
    await user.click(screen.getByRole("button", { name: "POI aus Link" }));

    expect(feld).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Schlägt nach…" }),
    ).toBeDisabled();

    aufloesen({ result: "angelegt", poi: villaRufolo() });
  });
});
