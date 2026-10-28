import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { listenBreite, SplitView } from "./split-view";

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

    // Seit req-097 324 px statt 410: die dreispaltige Zeile der POI-Liste
    // braucht nicht mehr.
    expect(linkeBreite()).toBe("324px");
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

/**
 * „Liste ausblenden" stand mit vollem Text auf der Karte und nahm ihr Platz
 * weg (bug-042). Ein Vollbild-Symbol sagt, was geschieht -- die Karte nimmt
 * die ganze Breite; im ausgeblendeten Zustand zeigt es das Gegenteil.
 */
describe("SplitView -- Vollbild-Symbol statt Text (bug-042)", () => {
  /** Die Schaltflaeche zum Aus- und Einblenden der Liste. */
  function umschalter() {
    return screen.getByRole("button", {
      name: /^Liste (aus|ein)blenden$/,
    });
  }

  /** Die Form des Symbols -- daran ist das Gegenteil zu erkennen. */
  function symbolForm() {
    return umschalter().querySelector("svg path")?.getAttribute("d");
  }

  it("zeigt ein Symbol statt des Textes", () => {
    renderSplitView();

    const knopf = umschalter();
    expect(knopf).toHaveTextContent("");
    expect(knopf.querySelector("svg")).not.toBeNull();
  });

  it("nennt im Tooltip weiterhin, was der Knopf tut", () => {
    renderSplitView();

    expect(umschalter()).toHaveAttribute("title", "Liste ausblenden");

    fireEvent.click(umschalter());

    expect(umschalter()).toHaveAttribute("title", "Liste einblenden");
  });

  it("zeigt im ausgeblendeten Zustand das Gegenteil", () => {
    renderSplitView();
    const vollbild = symbolForm();

    fireEvent.click(umschalter());

    expect(vollbild).toBeTruthy();
    expect(symbolForm()).toBeTruthy();
    expect(symbolForm()).not.toBe(vollbild);
  });
});

/**
 * Auf dem iPad hochkant (req-088) haben beide Seiten nicht nebeneinander
 * Platz: unter 1180 px (lib/plan/spalten.ts) steht eine allein, und ein
 * Umschalter darueber waehlt, welche.
 */
describe("SplitView -- eine Seite bei schmaler Breite (req-088)", () => {
  function renderBei(
    breite: number,
    extra: Partial<React.ComponentProps<typeof SplitView>> = {},
  ) {
    render(
      <SplitView
        windowWidth={breite}
        left={<p>Inhalt links</p>}
        right={<p>Inhalt rechts</p>}
        {...extra}
      />,
    );
  }

  function umschalter() {
    return screen.getByRole("tablist", { name: "Liste oder Karte" });
  }

  it("zeigt bei 768 px die linke Seite allein und einen Umschalter zur anderen", () => {
    renderBei(768);

    expect(screen.getByText("Inhalt links")).toBeVisible();
    expect(screen.queryByText("Inhalt rechts")).toBeNull();
    expect(screen.getByRole("tab", { name: "Liste" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Karte" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(umschalter()).toBeInTheDocument();
  });

  it("laesst die eine Seite die ganze Breite nutzen -- ohne Trenner und feste Breite", () => {
    renderBei(768);

    expect(screen.queryByRole("separator")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Liste ausblenden" }),
    ).toBeNull();
    expect(screen.getByTestId("split-pane-left").style.width).toBe("");
  });

  it("wechselt bei 768 px auf die rechte Seite und zurueck", () => {
    renderBei(768);

    fireEvent.click(screen.getByRole("tab", { name: "Karte" }));
    expect(screen.getByText("Inhalt rechts")).toBeVisible();
    expect(screen.getByText("Inhalt links")).not.toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: "Liste" }));
    expect(screen.getByText("Inhalt links")).toBeVisible();
    expect(screen.queryByText("Inhalt rechts")).toBeNull();
  });

  it("baut die linke Seite beim Umschalten nicht ab -- was darin steht, bleibt", () => {
    function Eingabe() {
      return <input aria-label="Notiz" />;
    }
    render(
      <SplitView
        windowWidth={768}
        left={<Eingabe />}
        right={<p>Inhalt rechts</p>}
      />,
    );
    fireEvent.change(screen.getByLabelText("Notiz"), {
      target: { value: "halb geschrieben" },
    });

    fireEvent.click(screen.getByRole("tab", { name: "Karte" }));
    fireEvent.click(screen.getByRole("tab", { name: "Liste" }));

    expect(screen.getByLabelText("Notiz")).toHaveValue("halb geschrieben");
  });

  it("nennt die Seiten so, wie der Bereich sie nennt", () => {
    renderBei(768, { leftLabel: "Chat" });

    expect(
      screen.getByRole("tablist", { name: "Chat oder Karte" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Chat" })).toBeInTheDocument();
  });

  it("haelt die rechte Seite offen, solange sie gebraucht wird", () => {
    renderBei(768, { rechtsZeigen: true });

    expect(screen.getByText("Inhalt rechts")).toBeVisible();
    expect(screen.getByText("Inhalt links")).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Karte" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("meldet die Wahl der linken Seite, damit sie freigegeben werden kann", () => {
    let freigegeben = 0;
    renderBei(768, {
      rechtsZeigen: true,
      onLinksGewaehlt: () => (freigegeben += 1),
    });

    fireEvent.click(screen.getByRole("tab", { name: "Liste" }));

    expect(freigegeben).toBe(1);
  });

  it("zeigt bei 1280 px beide Seiten nebeneinander und keinen Umschalter", () => {
    renderBei(1280);

    expect(screen.getByText("Inhalt links")).toBeInTheDocument();
    expect(screen.getByText("Inhalt rechts")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

/**
 * Die POI-Liste waechst nicht mit dem Schirm (req-097): bis zur Laptop-Breite
 * steht sie bei 324 px, darueber nutzt sie den Zuwachs nur fuer eine Zeile
 * mehr Text -- alles andere geht an die Karte.
 */
describe("SplitView -- die POI-Liste in ihrer eigenen Breite (req-097)", () => {
  function renderListeBei(breite: number) {
    render(
      <SplitView
        windowWidth={breite}
        linksListe
        left={<p>Inhalt links</p>}
        right={<p>Inhalt rechts</p>}
      />,
    );
  }

  it("ist bei 1280 px hoechstens 330 px breit", () => {
    renderListeBei(1280);

    expect(parseFloat(linkeBreite())).toBeLessThanOrEqual(330);
    expect(linkeBreite()).toBe("324px");
  });

  it("ist bei 3840 px nicht breiter als 380 px", () => {
    renderListeBei(3840);

    expect(parseFloat(linkeBreite())).toBeLessThanOrEqual(380);
  });

  it("waechst bis 1920 px um eine Textzeile und danach nicht mehr", () => {
    expect(listenBreite(1024)).toBe(324);
    expect(listenBreite(1280)).toBe(324);
    expect(listenBreite(1600)).toBe(345);
    expect(listenBreite(1920)).toBe(366);
    expect(listenBreite(3840)).toBe(366);
  });

  it("steht schon auf dem iPad quer neben der Karte", () => {
    renderListeBei(1024);

    expect(screen.getByText("Inhalt links")).toBeInTheDocument();
    expect(screen.getByText("Inhalt rechts")).toBeInTheDocument();
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(linkeBreite()).toBe("324px");
  });

  it("steht darunter allein, wie in der schmalen Ordnung aus req-088", () => {
    renderListeBei(1023);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("laesst sich weiterhin am Trenner breiter ziehen", () => {
    renderListeBei(1280);

    ziehe("mouse", 324, 500);

    expect(linkeBreite()).toBe("500px");
  });

  it("laesst eine andere linke Seite wie bisher in der halben Breite stehen", () => {
    render(
      <SplitView windowWidth={3840} left={<p>Chat</p>} right={<p>Karte</p>} />,
    );

    expect(linkeBreite()).toBe("1920px");
  });
});
