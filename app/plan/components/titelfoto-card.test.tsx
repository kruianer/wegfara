import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { Poi } from "@/lib/pois/types";
import type { Trip } from "@/lib/trips/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import { KI_BILD_SYMBOL_TITEL } from "@/lib/pois/ki-bild";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { TITELFOTO_VORGABE_HINWEIS } from "@/lib/trips/titelfoto";
import { ReisedetailsView } from "./reisedetails-view";
import { TitelfotoCard } from "./titelfoto-card";

const BASKENLAND: Trip = {
  id: "trip-baskenland",
  title: "Pintxos & Atlantik",
  startDate: "2027-05-18",
  endDate: "2027-05-23",
  mainPlace: { name: "Bilbao", lat: 43.263, lng: -2.935 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

function poi(id: string, number: number, name: string, photos: Poi["photos"]) {
  return {
    id,
    tripId: BASKENLAND.id,
    number,
    name,
    ort: "Bilbao",
    type: "sehenswuerdigkeit",
    position: { lat: 43.26, lng: -2.93 },
    status: "gesetzt",
    photos,
  } as Poi;
}

const GUGGENHEIM = poi("poi-gugg", 1, "Guggenheim", [
  { id: "foto-gugg", position: 1, source: "google" },
]);
const LAGUARDIA = poi("poi-lag", 11, "Laguardia", [
  { id: "foto-ki", position: 1, source: "ki" },
]);

afterEach(() => {
  vi.unstubAllGlobals();
});

function antwortMit(body: unknown, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

describe("Feld Titelfoto in den Reisedetails (req-103)", () => {
  it("steht in den Reisedetails mit den Fotos der Reise zur Wahl", () => {
    render(
      <ReisedetailsView
        trip={BASKENLAND}
        participants={[]}
        onTripSaved={vi.fn()}
        onCancelNewTrip={vi.fn()}
        onDeleteTrip={vi.fn()}
        onTripStateChanged={vi.fn()}
        pois={[GUGGENHEIM, LAGUARDIA]}
      />,
    );

    const feld = screen.getByRole("region", { name: "Titelfoto" });
    expect(
      within(feld).getByRole("button", { name: "Titelfoto: 1 · Guggenheim" }),
    ).toBeTruthy();
    expect(
      within(feld).getByRole("button", { name: "Titelfoto: 11 · Laguardia" }),
    ).toBeTruthy();
    expect(within(feld).getByText(TITELFOTO_VORGABE_HINWEIS)).toBeTruthy();
  });

  it("gibt es fuer eine noch nicht angelegte Reise nicht", () => {
    render(
      <ReisedetailsView
        trip={null}
        participants={[]}
        onTripSaved={vi.fn()}
        onCancelNewTrip={vi.fn()}
        onDeleteTrip={vi.fn()}
        onTripStateChanged={vi.fn()}
      />,
    );
    expect(screen.queryByRole("region", { name: "Titelfoto" })).toBeNull();
  });

  it("kennzeichnet ein KI-Bild im Gitter als solches", () => {
    render(
      <TitelfotoCard
        trip={BASKENLAND}
        pois={[GUGGENHEIM, LAGUARDIA]}
        titelfoto={null}
        hasAiKey={false}
        onChange={vi.fn()}
      />,
    );

    const ki = screen.getByTestId("titelfoto-wahl-foto-ki");
    expect(
      within(ki).getByRole("img", { name: KI_BILD_SYMBOL_TITEL }),
    ).toBeTruthy();
    const echt = screen.getByTestId("titelfoto-wahl-foto-gugg");
    expect(
      within(echt).queryByRole("img", { name: KI_BILD_SYMBOL_TITEL }),
    ).toBeNull();
  });

  it("speichert die Wahl des Guggenheim-Fotos und meldet sie", async () => {
    const titelfoto = {
      tripId: BASKENLAND.id,
      art: "poi" as const,
      photoId: "foto-gugg",
    };
    const fetchMock = antwortMit({ titelfoto });
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    render(
      <TitelfotoCard
        trip={BASKENLAND}
        pois={[GUGGENHEIM]}
        titelfoto={null}
        hasAiKey={false}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId("titelfoto-wahl-foto-gugg"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(titelfoto));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reise-titelfoto",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ tripId: BASKENLAND.id, photoId: "foto-gugg" }),
      }),
    );
  });

  it("zeigt das gewaehlte Foto als gewaehlt", () => {
    render(
      <TitelfotoCard
        trip={BASKENLAND}
        pois={[GUGGENHEIM, LAGUARDIA]}
        titelfoto={{ tripId: BASKENLAND.id, art: "poi", photoId: "foto-gugg" }}
        hasAiKey={false}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen
        .getByTestId("titelfoto-wahl-foto-gugg")
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByTestId("titelfoto-wahl-foto-ki").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("laedt ein eigenes Bild hoch", async () => {
    const titelfoto = {
      tripId: BASKENLAND.id,
      art: "eigen" as const,
      istKiBild: false,
      stand: "2026-10-28T10:00:00.000Z",
    };
    const fetchMock = antwortMit({ titelfoto }, 201);
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();
    render(
      <TitelfotoCard
        trip={BASKENLAND}
        pois={[]}
        titelfoto={null}
        hasAiKey={false}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId("titelfoto-datei"), {
      target: {
        files: [new File(["x"], "meer.jpg", { type: "image/jpeg" })],
      },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(titelfoto));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reise-titelfoto",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("zeigt ein eigenes KI-Titelbild mit seinem Zeichen", () => {
    render(
      <TitelfotoCard
        trip={BASKENLAND}
        pois={[]}
        titelfoto={{
          tripId: BASKENLAND.id,
          art: "eigen",
          istKiBild: true,
          stand: "2026-10-28T10:00:00.000Z",
        }}
        hasAiKey
        onChange={vi.fn()}
      />,
    );
    const eigenes = screen.getByTestId("titelfoto-eigenes");
    expect(
      within(eigenes).getByRole("img", { name: KI_BILD_SYMBOL_TITEL }),
    ).toBeTruthy();
  });

  it("sagt ohne Zugangsschluessel, dass er fehlt, statt zu erzeugen", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <TitelfotoCard
        trip={BASKENLAND}
        pois={[]}
        titelfoto={null}
        hasAiKey={false}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Titelbild von der KI erzeugen lassen",
      }),
    );

    expect(screen.getByRole("alert").textContent).toBe(
      apiKeyMissingHint("ki_suche"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nennt den Grund, wenn das Speichern scheitert, und laesst die Wahl", async () => {
    vi.stubGlobal("fetch", antwortMit({ error: "Kaputt." }, 500));
    const onChange = vi.fn();
    render(
      <TitelfotoCard
        trip={BASKENLAND}
        pois={[GUGGENHEIM]}
        titelfoto={null}
        hasAiKey={false}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId("titelfoto-wahl-foto-gugg"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Kaputt."),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
