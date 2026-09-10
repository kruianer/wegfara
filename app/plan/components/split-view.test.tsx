import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SplitView } from "./split-view";

const FENSTER_BREITE = 1280;

/** Die Leiste zwischen Liste und Karte. */
function trenner() {
  return screen.getByRole("separator");
}

/** Die Breite der linken Spalte in Pixeln. */
function linkeBreite() {
  return screen.getByTestId("split-pane-left").style.width;
}

function zeiger(pointerType: string, clientX: number) {
  return { pointerId: 7, pointerType, clientX, clientY: 300 };
}

/**
 * Ein Zug an der Leiste von `vonX` nach `nachX`. Bewegt und losgelassen wird
 * am Fenster: sobald der Zeiger der Leiste gehoert, kommen die Ereignisse dort
 * an -- egal, wo der Finger gerade steht.
 */
function ziehe(pointerType: string, vonX: number, nachX: number) {
  fireEvent.pointerDown(trenner(), zeiger(pointerType, vonX));
  fireEvent.pointerMove(window, zeiger(pointerType, nachX));
  fireEvent.pointerUp(window, zeiger(pointerType, nachX));
}

function renderSplitView() {
  render(
    <SplitView
      windowWidth={FENSTER_BREITE}
      left={<p>Liste</p>}
      right={<p>Karte</p>}
    />,
  );
}

describe("SplitView -- Trennleiste verschieben (bug-031)", () => {
  it("folgt der Fensterbreite, solange nicht gezogen wurde", () => {
    renderSplitView();

    expect(linkeBreite()).toBe(`${FENSTER_BREITE / 2}px`);
  });

  it("laesst sich mit dem Finger verschieben", () => {
    // Der Fehler: die Leiste hing an `mousedown`/`mousemove`, die Safari auf
    // dem iPad zum Finger nicht schickt -- sie blieb dort stehen.
    renderSplitView();

    ziehe("touch", 640, 760);

    expect(linkeBreite()).toBe("760px");
  });

  it("laesst sich mit dem Finger auch nach links verschieben", () => {
    renderSplitView();

    ziehe("touch", 640, 520);

    expect(linkeBreite()).toBe("520px");
  });

  it("laesst sich weiterhin mit der Maus verschieben", () => {
    renderSplitView();

    ziehe("mouse", 640, 700);

    expect(linkeBreite()).toBe("700px");
  });

  it("laesst sich mit dem Stift verschieben", () => {
    renderSplitView();

    ziehe("pen", 640, 700);

    expect(linkeBreite()).toBe("700px");
  });

  it("zieht waehrend des Zuges mit, nicht erst beim Loslassen", () => {
    renderSplitView();

    fireEvent.pointerDown(trenner(), zeiger("touch", 640));
    fireEvent.pointerMove(window, zeiger("touch", 700));

    expect(linkeBreite()).toBe("700px");
  });

  it("laesst die Liste nicht schmaler werden als ihr Mindestmass", () => {
    renderSplitView();

    ziehe("touch", 640, 100);

    expect(linkeBreite()).toBe("410px");
  });

  it("laesst der Karte ihren Platz am rechten Rand", () => {
    renderSplitView();

    ziehe("touch", 640, 1200);

    expect(linkeBreite()).toBe(`${FENSTER_BREITE - 480}px`);
  });

  it("bewegt nichts mehr, nachdem der Finger losgelassen hat", () => {
    renderSplitView();

    ziehe("touch", 640, 760);
    fireEvent.pointerMove(window, zeiger("touch", 900));

    expect(linkeBreite()).toBe("760px");
  });

  it("bewegt nichts mehr, wenn der Browser den Zug abbricht", () => {
    renderSplitView();

    fireEvent.pointerDown(trenner(), zeiger("touch", 640));
    fireEvent.pointerMove(window, zeiger("touch", 760));
    fireEvent.pointerCancel(window, zeiger("touch", 760));
    fireEvent.pointerMove(window, zeiger("touch", 900));

    expect(linkeBreite()).toBe("760px");
  });

  it("bewegt nichts bei einem blossen Tippen auf die Leiste", () => {
    renderSplitView();

    fireEvent.pointerDown(trenner(), zeiger("touch", 640));
    fireEvent.pointerUp(trenner(), zeiger("touch", 640));

    expect(linkeBreite()).toBe(`${FENSTER_BREITE / 2}px`);
  });

  it("laesst einen zweiten Finger den laufenden Zug nicht uebernehmen", () => {
    renderSplitView();

    fireEvent.pointerDown(trenner(), zeiger("touch", 640));
    fireEvent.pointerDown(trenner(), {
      pointerId: 8,
      pointerType: "touch",
      clientX: 200,
      clientY: 300,
    });
    fireEvent.pointerMove(window, {
      pointerId: 8,
      pointerType: "touch",
      clientX: 900,
      clientY: 300,
    });

    expect(linkeBreite()).toBe(`${FENSTER_BREITE / 2}px`);
  });

  it("blendet mit der Liste auch die Leiste aus", () => {
    renderSplitView();

    fireEvent.click(screen.getByRole("button", { name: "Liste ausblenden" }));

    expect(screen.queryByRole("separator")).toBeNull();
  });
});
