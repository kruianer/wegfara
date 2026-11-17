import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { programmpunktAnfassen } from "@/tests/zeitstrahl-ziehen";
import { PlanungView } from "./planung-view";
import { TimelineColumn } from "./timeline-column";
import type { Poi } from "@/lib/pois/types";
import type { Activity } from "@/lib/activities/types";
import type { Trip } from "@/lib/trips/types";
import { tripDays } from "@/lib/trips/days";
import { computeTimelineGrid } from "@/lib/plan/timeline-grid";
import { poiTeaserNachId } from "@/lib/pois/teaser";
import { poiFotoUrl, poiMiniaturUrl } from "@/lib/pois/foto-url";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import {
  ACTIVITY_TYPE_COLOR,
  ACTIVITY_TYPE_LABEL,
} from "@/lib/activities/type-meta";
import { POI_TYPE_LABEL } from "@/lib/pois/type-meta";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

/**
 * Das Teaserbild am Programmpunkt des Zeitstrahls (req-111).
 *
 * Gesucht wird ueber die Kennzeichnungen der Elemente und nicht ueber ihre
 * Rolle: jeder Block traegt seine Breite als `calc()`, und daran scheitert die
 * Stilberechnung von jsdom (siehe optionsgruppe.test.tsx).
 */

const TRIP: Trip = {
  id: "trip-1",
  title: "Nordspanien",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Bilbao", lat: 43.263, lng: -2.935 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

/** Vor dem Zeitraum der Reise -- vorausgewaehlt ist damit der Anreisetag. */
const TODAY = new Date(2026, 6, 10);
const TAG = "2026-07-18";

function poi(id: string, number: number, fotos: string[]): Poi {
  return {
    id,
    tripId: TRIP.id,
    number,
    name: id,
    ort: "Bilbao",
    type: "weltkulturerbe",
    position: { lat: 43.268, lng: -2.934 },
    status: "gesetzt",
    photos: fotos.map((fotoId, index) => ({ id: fotoId, position: index + 1 })),
  };
}

const MUSEUM = poi("poi-guggenheim", 12, ["foto-guggenheim", "foto-2"]);
const OHNE_FOTO = poi("poi-altstadt", 13, []);

function programmpunkt(
  id: string,
  start: string,
  ende: string,
  poiId?: string,
): Activity {
  return {
    id,
    tripId: TRIP.id,
    type: "sehenswuerdigkeit",
    title: `Programmpunkt ${id}`,
    shortText: "",
    longText: "",
    startAt: `${TAG}T${start}`,
    endAt: `${TAG}T${ende}`,
    poiId,
  };
}

const LANG = programmpunkt("lang", "09:00", "10:00", MUSEUM.id);
const KURZ = programmpunkt("kurz", "11:00", "11:15", MUSEUM.id);
const OHNE = programmpunkt("ohne", "12:00", "13:00", OHNE_FOTO.id);
const VON_HAND = programmpunkt("von-hand", "14:00", "15:00");

function Planung({ activities }: { activities: Activity[] }) {
  return (
    <PlanungView
      trip={TRIP}
      pois={[MUSEUM, OHNE_FOTO]}
      activities={activities}
      transfers={[]}
      today={TODAY}
    />
  );
}

describe("Teaserbild im Zeitstrahl (req-111)", () => {
  it("zeigt links im Block das erste Foto des POI", () => {
    render(<Planung activities={[LANG]} />);
    const block = screen.getByTestId(`activity-block-${LANG.id}`);
    const bild = screen.getByTestId(`activity-bild-${LANG.id}`);
    expect(block).toContainElement(bild);
    // Vor dem Titel, also links davon.
    expect(block.firstElementChild).toContainElement(bild);
    expect(bild.getAttribute("src")).toContain(MUSEUM.photos![0].id);
  });

  it("laedt die Miniatur und nie das Original (req-105)", () => {
    render(<Planung activities={[LANG]} />);
    const src = screen
      .getByTestId(`activity-bild-${LANG.id}`)
      .getAttribute("src");
    expect(src).toBe(poiMiniaturUrl("foto-guggenheim"));
    expect(src).not.toBe(poiFotoUrl("foto-guggenheim"));
  });

  it("gibt Bloecken verschiedener Hoehe dasselbe Bild in derselben Fassung", () => {
    render(<Planung activities={[LANG, KURZ]} />);
    const lang = screen.getByTestId(`activity-block-${LANG.id}`);
    const kurz = screen.getByTestId(`activity-block-${KURZ.id}`);
    expect(Number.parseFloat(lang.style.height)).toBeGreaterThan(
      Number.parseFloat(kurz.style.height),
    );
    // Breite und Einzug des Titels kommen aus dem Stylesheet, je Klasse an
    // einer Stelle (zeitstrahl-bild.layout.test.ts) -- hier zaehlt, dass
    // beide Bloecke dieselben tragen.
    expect(lang.className).toBe(kurz.className);
    const bildLang = screen.getByTestId(`activity-bild-${LANG.id}`);
    const bildKurz = screen.getByTestId(`activity-bild-${KURZ.id}`);
    expect(bildLang.parentElement!.className).toBe(
      bildKurz.parentElement!.className,
    );
  });

  it("laesst links nichts stehen, wenn der POI kein Foto hat", () => {
    render(<Planung activities={[LANG, OHNE]} />);
    const block = screen.getByTestId(`activity-block-${OHNE.id}`);
    expect(screen.queryByTestId(`activity-bild-${OHNE.id}`)).toBeNull();
    expect(block.querySelector("img")).toBeNull();
    // Kein Einzug: der Titel nimmt die ganze Breite.
    const mitBild = screen.getByTestId(`activity-block-${LANG.id}`);
    const einzug = mitBild.className
      .split(" ")
      .filter((klasse) => !block.className.split(" ").includes(klasse));
    expect(einzug).toHaveLength(1);
    expect(block.firstElementChild?.tagName).toBe("P");
  });

  it("gibt einem von Hand angelegten Programmpunkt weder Bild noch Platzhalter", () => {
    render(<Planung activities={[VON_HAND]} />);
    const block = screen.getByTestId(`activity-block-${VON_HAND.id}`);
    expect(block.querySelector("img")).toBeNull();
    expect(block.firstElementChild?.tagName).toBe("P");
  });

  it("bekommt die Fotos als Zuordnung und fragt sie nicht selbst ab", () => {
    // Ohne Zuordnung kein Bild -- der Zeitstrahl kennt die POIs nicht.
    const grid = computeTimelineGrid([LANG], TAG);
    const { unmount } = render(
      <TimelineColumn
        days={tripDays(TRIP)}
        selectedDate={TAG}
        onSelectDate={() => {}}
        activities={[LANG]}
        transfers={[]}
        grid={grid}
      />,
    );
    expect(screen.queryByTestId(`activity-bild-${LANG.id}`)).toBeNull();
    unmount();

    render(
      <TimelineColumn
        days={tripDays(TRIP)}
        selectedDate={TAG}
        onSelectDate={() => {}}
        activities={[LANG]}
        transfers={[]}
        grid={grid}
        poiTeaser={poiTeaserNachId([MUSEUM])}
      />,
    );
    expect(screen.getByTestId(`activity-bild-${LANG.id}`)).toBeInTheDocument();
  });
});

/**
 * jsdom rechnet kein Layout. Die Bloecke bekommen deshalb ihre Groesse aus
 * dem, was am Element steht -- die Breite der Spur (`calc(33.33% - 4px)`)
 * von der Flaeche der Bloecke, die Hoehe aus `height` --, und der
 * ResizeObserver meldet sich, wenn die Spalte breiter gezogen wird.
 */
let flaecheBreitePx = 0;
let beobachter: ResizeObserverCallback[] = [];
const vorher = new Map<string, PropertyDescriptor | undefined>();

function gemesseneBreite(element: HTMLElement): number {
  const spur = /calc\(([\d.]+)% - (\d+)px\)/.exec(element.style.width);
  if (!spur) return 0;
  return Math.round(
    (flaecheBreitePx * Number(spur[1])) / 100 - Number(spur[2]),
  );
}

function gemesseneHoehe(element: HTMLElement): number {
  return Math.max(Number.parseFloat(element.style.height) || 0, 24);
}

/** Die Flaeche der Bloecke bei der Untergrenze des Zeitstrahls: 412 - 44. */
const HEUTIGE_FLAECHE_PX = 412 - 44;

describe("Teaserbild im Zeitstrahl -- am gemessenen Block (req-111)", () => {
  beforeEach(() => {
    flaecheBreitePx = HEUTIGE_FLAECHE_PX;
    beobachter = [];
    for (const name of ["offsetWidth", "offsetHeight"]) {
      vorher.set(
        name,
        Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
      );
    }
    Object.defineProperties(HTMLElement.prototype, {
      offsetWidth: {
        configurable: true,
        get(this: HTMLElement) {
          return gemesseneBreite(this);
        },
      },
      offsetHeight: {
        configurable: true,
        get(this: HTMLElement) {
          return this.style.width ? gemesseneHoehe(this) : 0;
        },
      },
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(rueckruf: ResizeObserverCallback) {
          beobachter.push(rueckruf);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    for (const [name, alt] of vorher) {
      if (alt) Object.defineProperty(HTMLElement.prototype, name, alt);
      else
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)[
          name
        ];
    }
    vi.unstubAllGlobals();
  });

  /** Die Spalte wird am Trenner breiter gezogen (req-109). */
  function flaecheAufBreite(breite: number) {
    flaecheBreitePx = breite;
    act(() => {
      for (const rueckruf of beobachter) rueckruf([], {} as ResizeObserver);
    });
  }

  const ERSTER = programmpunkt("erster", "09:00", "10:00", MUSEUM.id);
  const ZWEITER = programmpunkt("zweiter", "09:00", "10:30", MUSEUM.id);
  const DRITTER = programmpunkt("dritter", "09:30", "10:00", MUSEUM.id);
  const DREI = [ERSTER, ZWEITER, DRITTER];

  it("zeigt das Bild in einem Block, der eine Spur fuer sich hat", () => {
    render(<Planung activities={[ERSTER]} />);
    expect(
      screen.getByTestId(`activity-bild-${ERSTER.id}`),
    ).toBeInTheDocument();
  });

  it("laesst es bei drei gleichzeitigen Programmpunkten weg, der Titel nimmt den Platz", () => {
    render(<Planung activities={DREI} />);
    for (const activity of DREI) {
      expect(screen.queryByTestId(`activity-bild-${activity.id}`)).toBeNull();
      const block = screen.getByTestId(`activity-block-${activity.id}`);
      expect(block.querySelector("img")).toBeNull();
      expect(block.firstElementChild?.tagName).toBe("P");
    }
  });

  it("zeigt es bei denselben dreien wieder, wenn die Spalte breit genug gezogen ist", () => {
    render(<Planung activities={DREI} />);
    expect(screen.queryByTestId(`activity-bild-${ERSTER.id}`)).toBeNull();

    flaecheAufBreite(720);
    for (const activity of DREI) {
      expect(
        screen.getByTestId(`activity-bild-${activity.id}`),
      ).toBeInTheDocument();
    }

    // Und wieder schmal: es verschwindet.
    flaecheAufBreite(HEUTIGE_FLAECHE_PX);
    expect(screen.queryByTestId(`activity-bild-${ERSTER.id}`)).toBeNull();
  });
  it("legt in einem Block, der hoch genug ist, den Typ als Zeichen auf das Bild", () => {
    render(<Planung activities={[ERSTER]} />);
    const bild = screen.getByTestId(`activity-bild-${ERSTER.id}`);
    const zeichen = screen.getByTestId(`activity-typ-zeichen-${ERSTER.id}`);
    // Auf dem Bild: im selben Rahmen wie das Bild.
    expect(bild.parentElement).toContainElement(zeichen);
    expect(zeichen).toHaveTextContent(ACTIVITY_TYPE_LABEL[ERSTER.type]);
    expect(zeichen.style.getPropertyValue("--typ")).toBe(
      ACTIVITY_TYPE_COLOR[ERSTER.type],
    );
  });

  it("laesst das Zeichen im flachen Block weg, das Bild bleibt allein", () => {
    const flach = programmpunkt("flach", "11:00", "11:15", MUSEUM.id);
    render(<Planung activities={[ERSTER, flach]} />);
    expect(screen.getByTestId(`activity-bild-${flach.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`activity-typ-zeichen-${flach.id}`)).toBeNull();
  });

  it("nennt den Typ des Programmpunkts, nicht den des POI", () => {
    // Das Weltkulturerbe ist als Sehenswuerdigkeit geplant.
    expect(MUSEUM.type).not.toBe(ERSTER.type);
    render(<Planung activities={[ERSTER]} />);
    const zeichen = screen.getByTestId(`activity-typ-zeichen-${ERSTER.id}`);
    expect(zeichen).toHaveTextContent("Sehenswürdigkeit");
    expect(zeichen).not.toHaveTextContent(POI_TYPE_LABEL[MUSEUM.type]);
  });

  it("laesst die Vorlesehilfe den Typ nur einmal hoeren", () => {
    render(<Planung activities={[ERSTER]} />);
    const block = screen.getByTestId(`activity-block-${ERSTER.id}`);
    // Was die Vorlesehilfe liest: alles ausser dem, was aria-hidden traegt.
    const vorgelesen = block.cloneNode(true) as HTMLElement;
    vorgelesen
      .querySelectorAll('[aria-hidden="true"]')
      .forEach((element) => element.remove());
    const typ = ACTIVITY_TYPE_LABEL[ERSTER.type];
    expect(vorgelesen.textContent?.split(typ)).toHaveLength(2);
    // Das Bild selbst ist Schmuck -- der Titel nennt den Ort.
    expect(screen.getByTestId(`activity-bild-${ERSTER.id}`)).toHaveAttribute(
      "alt",
      "",
    );
  });
});

describe("Teaserbild im Zeitstrahl -- kein Griff (req-111)", () => {
  /** Der Zeitstrahl mit Bild, umplanbar (req-040, req-046). */
  function Zeitstrahl(rueckrufe: {
    onMoveActivity: (activity: Activity, startAt: string) => void;
    onResizeActivity: (activity: Activity, endAt: string) => void;
    onResizeActivityStart: (activity: Activity, startAt: string) => void;
  }) {
    return (
      <TimelineColumn
        days={tripDays(TRIP)}
        selectedDate={TAG}
        onSelectDate={() => {}}
        activities={[LANG]}
        transfers={[]}
        grid={computeTimelineGrid([LANG], TAG)}
        poiTeaser={poiTeaserNachId([MUSEUM])}
        {...rueckrufe}
      />
    );
  }

  function rueckrufe() {
    return {
      onMoveActivity: vi.fn(),
      onResizeActivity: vi.fn(),
      onResizeActivityStart: vi.fn(),
    };
  }

  /** Loslassen auf dem Raster -- jsdom kennt kein DragEvent. */
  function aufRasterLoslassen(offsetPx: number) {
    fireEvent(
      screen.getByTestId("timeline-grid"),
      new MouseEvent("drop", {
        bubbles: true,
        cancelable: true,
        clientY: offsetPx,
      }),
    );
  }

  it("verschiebt den Block wie bisher -- auch am Bild angefasst", () => {
    // Am Block selbst angefasst ...
    const amBlock = rueckrufe();
    const erster = render(<Zeitstrahl {...amBlock} />);
    const block = screen.getByTestId(`activity-block-${LANG.id}`);
    const oben = Number.parseFloat(block.style.top) || 0;
    programmpunktAnfassen(block, oben + 10);
    aufRasterLoslassen(oben + 10 + 96);
    expect(amBlock.onMoveActivity).toHaveBeenCalledTimes(1);
    erster.unmount();

    // ... und am Bild: dasselbe Ergebnis, der Zug gehoert dem Block.
    const amBild = rueckrufe();
    render(<Zeitstrahl {...amBild} />);
    const bild = screen.getByTestId(`activity-bild-${LANG.id}`);
    expect(bild).toHaveAttribute("draggable", "false");
    fireEvent.pointerDown(bild, { pointerType: "mouse", clientY: oben + 10 });
    fireEvent(
      bild,
      new MouseEvent("dragstart", {
        bubbles: true,
        cancelable: true,
        clientY: oben + 10,
      }),
    );
    aufRasterLoslassen(oben + 10 + 96);
    expect(amBild.onMoveActivity).toHaveBeenCalledTimes(1);
    expect(amBild.onMoveActivity.mock.calls[0]).toEqual(
      amBlock.onMoveActivity.mock.calls[0],
    );
    expect(amBild.onMoveActivity.mock.calls[0][1]).not.toBe(LANG.startAt);
  });

  it("laesst obere und untere Kante wie bisher ziehen", () => {
    const zuege = rueckrufe();
    render(<Zeitstrahl {...zuege} />);
    // Die Kanten liegen nach dem Bild im Block und damit darueber.
    const block = screen.getByTestId(`activity-block-${LANG.id}`);
    const kinder = Array.from(block.children);
    const bild = screen.getByTestId(`activity-bild-${LANG.id}`).parentElement!;
    for (const kante of ["resize-activity-start", "resize-activity"]) {
      const element = screen.getByTestId(`${kante}-${LANG.id}`);
      expect(kinder.indexOf(element)).toBeGreaterThan(kinder.indexOf(bild));
    }
    const oben = Number.parseFloat(block.style.top) || 0;
    const unten = oben + (Number.parseFloat(block.style.height) || 0);

    fireEvent.dragStart(screen.getByTestId(`resize-activity-${LANG.id}`));
    aufRasterLoslassen(unten + 48);
    expect(zuege.onResizeActivity).toHaveBeenCalledTimes(1);

    fireEvent.dragStart(screen.getByTestId(`resize-activity-start-${LANG.id}`));
    aufRasterLoslassen(Math.max(oben - 24, 0));
    expect(zuege.onResizeActivityStart).toHaveBeenCalledTimes(1);
    expect(zuege.onMoveActivity).not.toHaveBeenCalled();
  });
});
