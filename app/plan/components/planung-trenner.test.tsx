import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanungView } from "./planung-view";
import type { Trip } from "@/lib/trips/types";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import {
  KARTE_MIN_BREITE_PX,
  POI_AUSWAHL_BREITE_PX,
  TRENNER_BREITE_PX,
  ZEITSTRAHL_MIN_BREITE_PX,
} from "@/lib/design/stil";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Zwei Trenner in der Planung (req-109): zwischen POI-Auswahl und Zeitstrahl
 * und zwischen Zeitstrahl und Karte.
 */

const TRIP: Trip = {
  id: "trip-1",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

const TODAY = new Date(2026, 6, 10);

/** Die Seitenleiste des Planers steht links neben der Planung. */
const SEITENLEISTE_PX = 60;

/**
 * jsdom misst nichts: die Reihe der drei Spalten bekommt die Breite, die sie
 * im Fenster haette -- alles andere bleibt bei 0.
 */
function messeReihe(fensterbreite: number) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.dataset.testid === "planung-reihe"
        ? fensterbreite - SEITENLEISTE_PX
        : 0;
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPlanung(
  fensterbreite: number,
  extra: Partial<React.ComponentProps<typeof PlanungView>> = {},
) {
  messeReihe(fensterbreite);
  return render(
    <PlanungView
      trip={TRIP}
      pois={[]}
      activities={[]}
      transfers={[]}
      today={TODAY}
      windowWidth={fensterbreite}
      {...extra}
    />,
  );
}

function linkerTrenner() {
  return screen.getByRole("separator", {
    name: "Breite von POI-Auswahl und Zeitstrahl anpassen",
  });
}

function rechterTrenner() {
  return screen.getByRole("separator", {
    name: "Breite von Zeitstrahl und Karte anpassen",
  });
}

function breite(testId: string) {
  return Number.parseFloat(screen.getByTestId(testId).style.width);
}

function auswahlBreite() {
  return breite("planung-spalte-auswahl");
}

function zeitstrahlBreite() {
  return breite("planung-spalte-zeitstrahl");
}

/** Was der Karte bleibt: die Reihe ohne die beiden Spalten und die Trenner. */
function kartenBreite(fensterbreite: number) {
  const trenner = screen.queryAllByRole("separator").length;
  return (
    fensterbreite -
    SEITENLEISTE_PX -
    auswahlBreite() -
    zeitstrahlBreite() -
    trenner * TRENNER_BREITE_PX
  );
}

function zeiger(pointerType: string, clientX: number) {
  return { pointerId: 7, pointerType, clientX, clientY: 300 };
}

/** Ein Zug am Trenner um `versatz` px, losgelassen am Fenster. */
function ziehe(trenner: HTMLElement, versatz: number, pointerType = "mouse") {
  fireEvent.pointerDown(trenner, zeiger(pointerType, 600));
  fireEvent.pointerMove(window, zeiger(pointerType, 600 + versatz));
  fireEvent.pointerUp(window, zeiger(pointerType, 600 + versatz));
}

describe("Zwei Trenner in der Planung (req-109)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it.each([1280, 1920])(
    "stellt bei %i px zwei Trenner: vor und hinter dem Zeitstrahl",
    (fensterbreite) => {
      renderPlanung(fensterbreite);

      expect(screen.getAllByRole("separator")).toHaveLength(2);
      const auswahl = screen.getByTestId("planung-spalte-auswahl");
      const zeitstrahl = screen.getByTestId("planung-spalte-zeitstrahl");
      expect(auswahl.nextElementSibling).toBe(linkerTrenner());
      expect(linkerTrenner().nextElementSibling).toBe(zeitstrahl);
      expect(zeitstrahl.nextElementSibling).toBe(rechterTrenner());
      expect(rechterTrenner().nextElementSibling).toContainElement(
        screen.getByTestId("day-route-map"),
      );
    },
  );

  it("nennt sich der Vorlesehilfe als senkrechter Trenner mit seiner Aufgabe", () => {
    renderPlanung(1280);

    for (const trenner of [linkerTrenner(), rechterTrenner()]) {
      expect(trenner).toHaveAttribute("aria-orientation", "vertical");
      expect(trenner.getAttribute("aria-label")).toMatch(/anpassen$/);
    }
  });

  it("stellt die Spalten ungezogen wie bisher: 340, 412, Rest", () => {
    renderPlanung(1280);

    expect(auswahlBreite()).toBe(340);
    expect(zeitstrahlBreite()).toBe(412);
  });

  it("stellt unter 1180 px keine Trenner und bleibt bei der schmalen Ordnung (req-088)", () => {
    renderPlanung(1024);

    expect(screen.queryAllByRole("separator")).toHaveLength(0);
    expect(screen.getByTestId("planung-daneben")).toBeInTheDocument();
    expect(screen.queryByTestId("planung-spalte-auswahl")).toBeNull();
  });

  it("macht am rechten Trenner nach rechts den Zeitstrahl breiter und die Karte schmaler", () => {
    renderPlanung(1280);
    const karteVorher = kartenBreite(1280);

    ziehe(rechterTrenner(), 100);

    expect(zeitstrahlBreite()).toBe(512);
    expect(kartenBreite(1280)).toBe(karteVorher - 100);
    expect(auswahlBreite()).toBe(340);
  });

  it("macht am linken Trenner nach rechts die Auswahl breiter und den Zeitstrahl schmaler", () => {
    renderPlanung(1920);
    ziehe(rechterTrenner(), 300);
    const karteVorher = kartenBreite(1920);

    ziehe(linkerTrenner(), 160);

    expect(auswahlBreite()).toBe(500);
    expect(zeitstrahlBreite()).toBe(552);
    expect(kartenBreite(1920)).toBe(karteVorher);
  });

  it.each([
    ["linken", linkerTrenner, 5000],
    ["linken", linkerTrenner, -5000],
    ["rechten", rechterTrenner, 5000],
    ["rechten", rechterTrenner, -5000],
  ])(
    "haelt beim Zug am %s Trenner die Summe der Spalten bei der Fensterbreite (%i px)",
    (_, trenner, versatz) => {
      renderPlanung(1280);

      ziehe(trenner(), versatz);

      expect(kartenBreite(1280)).toBeGreaterThanOrEqual(KARTE_MIN_BREITE_PX);
      expect(auswahlBreite()).toBeGreaterThanOrEqual(340);
      expect(zeitstrahlBreite()).toBeGreaterThanOrEqual(412);
    },
  );

  it("laesst die POI-Auswahl nicht schmaler werden als 340 px", () => {
    renderPlanung(1920);
    ziehe(rechterTrenner(), 300);
    ziehe(linkerTrenner(), 200);

    ziehe(linkerTrenner(), -5000);

    expect(auswahlBreite()).toBe(POI_AUSWAHL_BREITE_PX.offen);
  });

  it("laesst den Zeitstrahl nicht schmaler werden als 412 px", () => {
    renderPlanung(1920);
    ziehe(rechterTrenner(), 300);

    ziehe(rechterTrenner(), -5000);
    expect(zeitstrahlBreite()).toBe(ZEITSTRAHL_MIN_BREITE_PX);

    ziehe(rechterTrenner(), 300);
    ziehe(linkerTrenner(), 5000);
    expect(zeitstrahlBreite()).toBe(ZEITSTRAHL_MIN_BREITE_PX);
  });

  it("laesst der Karte ihre Mindestbreite", () => {
    renderPlanung(1920);

    ziehe(rechterTrenner(), 5000);

    expect(kartenBreite(1920)).toBe(KARTE_MIN_BREITE_PX);
  });

  it.each(["touch", "pen"])(
    "verschiebt den Trenner auch mit %s (bug-031)",
    (pointerType) => {
      renderPlanung(1280);

      ziehe(rechterTrenner(), 80, pointerType);

      expect(zeitstrahlBreite()).toBe(492);
    },
  );

  it("zieht waehrend des Zuges mit und rechnet jeden Schritt vom Anfassen aus", () => {
    renderPlanung(1920);

    fireEvent.pointerDown(rechterTrenner(), zeiger("touch", 600));
    fireEvent.pointerMove(window, zeiger("touch", 700));
    expect(zeitstrahlBreite()).toBe(512);
    fireEvent.pointerMove(window, zeiger("touch", 650));
    expect(zeitstrahlBreite()).toBe(462);
  });
});

describe("Trenner und Zuklapp-Griff (req-109, req-099)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  function zuklappen() {
    fireEvent.click(screen.getByRole("button", { name: "Auswahl zuklappen" }));
  }

  function aufklappen() {
    fireEvent.click(screen.getByRole("button", { name: "Auswahl aufklappen" }));
  }

  it("nimmt zugeklappt den linken Trenner fort und stellt den Streifen 44 px breit", () => {
    renderPlanung(1280);

    zuklappen();

    expect(screen.getAllByRole("separator")).toEqual([rechterTrenner()]);
    expect(auswahlBreite()).toBe(POI_AUSWAHL_BREITE_PX.zu);
    expect(auswahlBreite()).toBe(44);
  });

  it("laesst zwischen Streifen und Zeitstrahl keinen Trenner -- die eine Linie traegt der Streifen", () => {
    renderPlanung(1280);

    zuklappen();

    expect(
      screen.getByTestId("planung-spalte-auswahl").nextElementSibling,
    ).toBe(screen.getByTestId("planung-spalte-zeitstrahl"));
  });

  it("steht nach dem Aufklappen wieder so breit, wie sie gezogen war", () => {
    renderPlanung(1920);
    ziehe(rechterTrenner(), 300);
    ziehe(linkerTrenner(), 160);
    expect(auswahlBreite()).toBe(500);

    zuklappen();
    aufklappen();

    expect(auswahlBreite()).toBe(500);
    expect(screen.getAllByRole("separator")).toHaveLength(2);
  });

  it("steht nach dem Aufklappen auf 340 px, wenn nie gezogen wurde", () => {
    renderPlanung(1920);

    zuklappen();
    aufklappen();

    expect(auswahlBreite()).toBe(340);
  });

  it("laesst den rechten Trenner auch zugeklappt ziehen", () => {
    renderPlanung(1920);
    zuklappen();

    ziehe(rechterTrenner(), 5000);

    expect(kartenBreite(1920)).toBe(KARTE_MIN_BREITE_PX);
  });
});
