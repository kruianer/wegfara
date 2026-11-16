import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TripDay } from "@/lib/trips/days";
import { DayTabs } from "./day-tabs";
import { dropTargetAtPoint } from "./pointer-drag";

/**
 * Die Tagauswahl mit Blaetterknoepfen (req-110).
 *
 * jsdom rechnet kein Layout aus -- `scrollWidth`, `clientWidth`, die Lage der
 * Reiter und der Bildlauf werden deshalb hier nachgebildet, so wie der Browser
 * sie meldet: jeder Reiter 46 px breit, 4 px Abstand, die Leiste so breit wie
 * `leisteBreite`. Was der echte Browser daraus macht, prueft
 * tests/e2e/tagauswahl-blaettern.e2e.ts.
 */

const REITER_PX = 46;
const ABSTAND_PX = 4;
const SCHRITT_PX = REITER_PX + ABSTAND_PX;

let leisteBreite = 300;
const bildlauf = new WeakMap<Element, number>();
let groessenBeobachter: ResizeObserverCallback[] = [];

function istLeiste(element: Element) {
  return element.getAttribute("role") === "tablist";
}

function inhaltBreite(leiste: Element) {
  return leiste.children.length * SCHRITT_PX - ABSTAND_PX;
}

function groessterBildlauf(leiste: Element) {
  return Math.max(0, inhaltBreite(leiste) - leisteBreite);
}

const ersetzt = ["clientWidth", "scrollWidth", "scrollLeft"];
const ersetztHtml = ["offsetLeft", "offsetWidth"];
const vorher = new Map<string, PropertyDescriptor | undefined>();

beforeEach(() => {
  leisteBreite = 300;
  groessenBeobachter = [];
  for (const name of [...ersetzt, ...ersetztHtml]) {
    const ziel = ersetztHtml.includes(name)
      ? HTMLElement.prototype
      : Element.prototype;
    vorher.set(name, Object.getOwnPropertyDescriptor(ziel, name));
  }
  Object.defineProperties(Element.prototype, {
    clientWidth: {
      configurable: true,
      get(this: Element) {
        return istLeiste(this) ? leisteBreite : 0;
      },
    },
    scrollWidth: {
      configurable: true,
      get(this: Element) {
        return istLeiste(this) ? Math.max(inhaltBreite(this), leisteBreite) : 0;
      },
    },
    scrollLeft: {
      configurable: true,
      get(this: Element) {
        return bildlauf.get(this) ?? 0;
      },
      // Wie der Browser: nie ueber eines der Enden hinaus.
      set(this: Element, wert: number) {
        const groesster = istLeiste(this) ? groessterBildlauf(this) : 0;
        bildlauf.set(this, Math.min(Math.max(0, wert), groesster));
      },
    },
  });
  Object.defineProperties(HTMLElement.prototype, {
    offsetLeft: {
      configurable: true,
      get(this: HTMLElement) {
        const eltern = this.parentElement;
        if (!eltern || !istLeiste(eltern)) return 0;
        return Array.from(eltern.children).indexOf(this) * SCHRITT_PX;
      },
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute("role") === "tab" ? REITER_PX : 0;
      },
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(rueckruf: ResizeObserverCallback) {
        groessenBeobachter.push(rueckruf);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  for (const name of [...ersetzt, ...ersetztHtml]) {
    const ziel = ersetztHtml.includes(name)
      ? HTMLElement.prototype
      : Element.prototype;
    const alt = vorher.get(name);
    if (alt) Object.defineProperty(ziel, name, alt);
    else delete (ziel as unknown as Record<string, unknown>)[name];
  }
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Die Spalte wird breiter oder schmaler -- am Trenner (req-109), beim Drehen. */
function spalteAufBreite(breite: number) {
  leisteBreite = breite;
  act(() => {
    for (const rueckruf of groessenBeobachter) {
      rueckruf([], {} as ResizeObserver);
    }
  });
}

function reisetage(anzahl: number): TripDay[] {
  return Array.from({ length: anzahl }, (_, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, "0")}`,
    weekday: ["Mi", "Do", "Fr", "Sa", "So", "Mo", "Di"][i % 7],
  }));
}

function Tagauswahl({
  tage,
  anfangs,
  onDropDay,
}: {
  tage: TripDay[];
  anfangs?: string;
  onDropDay?: (date: string) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState(anfangs ?? tage[0].date);
  return (
    <DayTabs
      days={tage}
      selectedDate={gewaehlt}
      onSelect={setGewaehlt}
      onDropDay={onDropDay}
    />
  );
}

function leiste() {
  return screen.getByRole("tablist", { name: "Reisetag wählen" });
}

function zurueck() {
  return screen.getByRole("button", { name: "Frühere Tage zeigen" });
}

function vor() {
  return screen.getByRole("button", { name: "Spätere Tage zeigen" });
}

function knoepfe() {
  return screen.queryAllByTestId(/^blaettern-/);
}

describe("Tagauswahl -- Knöpfe nur, wenn es etwas zu blättern gibt (req-110)", () => {
  it("zeigt keine Knöpfe, wenn alle Tage in die Leiste passen", () => {
    render(<Tagauswahl tage={reisetage(4)} />);

    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(knoepfe()).toHaveLength(0);
  });

  it("zeigt links und rechts je einen Knopf, wenn mehr Tage als Platz sind", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    const [links, rechts] = knoepfe();
    expect(links).toBe(zurueck());
    expect(rechts).toBe(vor());
    // Links von der Leiste der eine, rechts der andere.
    expect(links.nextElementSibling).toBe(leiste());
    expect(leiste().nextElementSibling).toBe(rechts);
  });

  it("entscheidet nach dem Platz: dieselbe Reise braucht sie in einer breiten Spalte nicht", () => {
    leisteBreite = 1200;
    render(<Tagauswahl tage={reisetage(21)} />);

    expect(knoepfe()).toHaveLength(0);
  });

  it("lässt die Knöpfe verschwinden, wenn die Spalte breit genug gezogen wird", () => {
    render(<Tagauswahl tage={reisetage(21)} />);
    expect(knoepfe()).toHaveLength(2);

    spalteAufBreite(1200);
    expect(knoepfe()).toHaveLength(0);

    spalteAufBreite(412);
    expect(knoepfe()).toHaveLength(2);
  });
});

describe("Tagauswahl -- abgeschaltet, wo es nicht weitergeht (req-110)", () => {
  it("schaltet ganz links den linken Knopf ab und lässt den rechten an", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    expect(zurueck()).toBeDisabled();
    expect(vor()).toBeEnabled();
  });

  it("schaltet ganz rechts den rechten Knopf ab und lässt den linken an", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    leiste().scrollLeft = 10_000;
    fireEvent.scroll(leiste());

    expect(zurueck()).toBeEnabled();
    expect(vor()).toBeDisabled();
  });

  it("lässt dazwischen beide an", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    leiste().scrollLeft = 120;
    fireEvent.scroll(leiste());

    expect(zurueck()).toBeEnabled();
    expect(vor()).toBeEnabled();
  });
});

describe("Tagauswahl -- ein Klick, ein Reiter (req-110)", () => {
  it("verschiebt die Leiste mit dem rechten Knopf um genau einen Reiter nach vorn", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    fireEvent.click(vor());
    expect(leiste().scrollLeft).toBe(SCHRITT_PX);

    fireEvent.click(vor());
    expect(leiste().scrollLeft).toBe(2 * SCHRITT_PX);
    expect(zurueck()).toBeEnabled();
  });

  it("verschiebt sie mit dem linken Knopf um genau einen nach hinten", () => {
    render(<Tagauswahl tage={reisetage(21)} />);
    leiste().scrollLeft = 5 * SCHRITT_PX;
    fireEvent.scroll(leiste());

    fireEvent.click(zurueck());
    expect(leiste().scrollLeft).toBe(4 * SCHRITT_PX);
  });

  it("steht nach so vielen Klicks nach vorn, wie es Tage gibt, ganz rechts", () => {
    const tage = reisetage(21);
    render(<Tagauswahl tage={tage} />);

    for (let i = 0; i < tage.length; i++) fireEvent.click(vor());

    expect(leiste().scrollLeft).toBe(groessterBildlauf(leiste()));
    expect(vor()).toBeDisabled();
    expect(zurueck()).toBeEnabled();
  });

  it("blättert weiter, solange der Knopf gehalten wird, und zählt den Klick beim Loslassen nicht doppelt", () => {
    vi.useFakeTimers();
    render(<Tagauswahl tage={reisetage(21)} />);

    fireEvent.pointerDown(vor(), { button: 0 });
    act(() => vi.advanceTimersByTime(400 + 3 * 150));
    fireEvent.pointerUp(window);
    fireEvent.click(vor());

    expect(leiste().scrollLeft).toBe(3 * SCHRITT_PX);
  });

  it("wählt beim Blättern keinen Tag", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    fireEvent.click(vor());

    expect(screen.getByTestId("day-tab-2026-07-01")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

describe("Tagauswahl -- der gewählte Tag bleibt sichtbar (req-110)", () => {
  it("rollt einen gewählten Tag, der draußen steht, beim Aufgehen ins Bild", () => {
    render(<Tagauswahl tage={reisetage(21)} anfangs="2026-07-15" />);

    // Reiter 15 (Index 14): 700 bis 746 -- ganz zu sehen heisst bis 746.
    const ende = 14 * SCHRITT_PX + REITER_PX;
    expect(leiste().scrollLeft).toBe(ende - leisteBreite);
  });

  it("rollt einen halb abgeschnittenen Tag am Rand ganz ins Bild, sobald er gewählt wird", () => {
    render(<Tagauswahl tage={reisetage(21)} />);
    // Bei 300 px stehen die Reiter 1 bis 6 da, der sechste (250 bis 296)
    // ganz, der siebte (300 bis 346) gar nicht. 30 px gerollt: der siebte
    // ist halb abgeschnitten.
    leiste().scrollLeft = 30;
    fireEvent.scroll(leiste());

    fireEvent.click(screen.getByTestId("day-tab-2026-07-07"));

    expect(leiste().scrollLeft).toBe(6 * SCHRITT_PX + REITER_PX - leisteBreite);
  });

  it("rollt auch einen links halb abgeschnittenen ganz ins Bild", () => {
    render(<Tagauswahl tage={reisetage(21)} />);
    leiste().scrollLeft = 3 * SCHRITT_PX + 20;
    fireEvent.scroll(leiste());

    fireEvent.click(screen.getByTestId("day-tab-2026-07-04"));

    expect(leiste().scrollLeft).toBe(3 * SCHRITT_PX);
  });

  it("rollt den Tag ins Bild, der von aussen gewählt wird -- etwa durch Blättern des Plans", () => {
    const tage = reisetage(21);
    const { rerender } = render(
      <DayTabs days={tage} selectedDate={tage[0].date} onSelect={() => {}} />,
    );

    rerender(
      <DayTabs days={tage} selectedDate={tage[20].date} onSelect={() => {}} />,
    );

    expect(leiste().scrollLeft).toBe(groessterBildlauf(leiste()));
  });

  it("rollt nicht, wenn der gewählte Tag schon ganz zu sehen ist", () => {
    render(<Tagauswahl tage={reisetage(21)} />);
    leiste().scrollLeft = SCHRITT_PX;
    fireEvent.scroll(leiste());

    fireEvent.click(screen.getByTestId("day-tab-2026-07-03"));

    expect(leiste().scrollLeft).toBe(SCHRITT_PX);
  });
});

describe("Tagauswahl -- Ablegen auf Reitern und Knöpfen (req-110, req-040)", () => {
  it("nimmt einen Programmpunkt auf einem Reiter an, wie bisher", () => {
    const onDropDay = vi.fn();
    render(<Tagauswahl tage={reisetage(21)} onDropDay={onDropDay} />);

    fireEvent.drop(screen.getByTestId("day-tab-2026-07-03"));

    expect(onDropDay).toHaveBeenCalledWith("2026-07-03");
  });

  it("nimmt auf einem Blätterknopf nichts an", () => {
    const onDropDay = vi.fn();
    render(<Tagauswahl tage={reisetage(21)} onDropDay={onDropDay} />);

    for (const knopf of [zurueck(), vor()]) {
      // Ohne abgefangenes dragover verweigert der Browser das Ablegen.
      expect(fireEvent.dragOver(knopf)).toBe(true);
      fireEvent.drop(knopf);
    }

    expect(onDropDay).not.toHaveBeenCalled();
  });

  it("findet unter dem Finger auf einem Blätterknopf kein Ablageziel (bug-017)", () => {
    render(<Tagauswahl tage={reisetage(21)} onDropDay={() => {}} />);
    const vorherFinden = document.elementFromPoint;
    try {
      document.elementFromPoint = () => vor();
      expect(dropTargetAtPoint(10, 10)).toBeNull();

      document.elementFromPoint = () =>
        screen.getByTestId("day-tab-2026-07-02");
      expect(dropTargetAtPoint(10, 10)).toEqual({
        kind: "day",
        date: "2026-07-02",
      });
    } finally {
      document.elementFromPoint = vorherFinden;
    }
  });
});

describe("Tagauswahl -- Vorlesehilfe und Tastatur (req-110)", () => {
  it("nennt an jedem Knopf seine Richtung, als Name und als Titel", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    expect(zurueck()).toHaveAttribute("title", "Frühere Tage zeigen");
    expect(vor()).toHaveAttribute("title", "Spätere Tage zeigen");
  });

  it("lässt die Tastatur bei den Reitern: die Knöpfe stehen nicht in der Tab-Folge", async () => {
    const user = userEvent.setup();
    render(<Tagauswahl tage={reisetage(21)} />);

    await user.tab();
    expect(screen.getByTestId("day-tab-2026-07-01")).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId("day-tab-2026-07-02")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("day-tab-2026-07-02")).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("blendet den Bildlaufbalken weiterhin aus -- die Leiste rollt wie bisher", () => {
    render(<Tagauswahl tage={reisetage(21)} />);

    leiste().scrollLeft = 75;
    fireEvent.scroll(leiste());

    expect(leiste().scrollLeft).toBe(75);
    expect(zurueck()).toBeEnabled();
  });
});
