import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trip } from "@/lib/trips/types";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { BEGLEITER_PATH } from "@/lib/einstieg/ziel";
import { Seitenleiste, LEISTEN_SLOGAN } from "./seitenleiste";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

const HEUTE = new Date(2026, 6, 1);

function zeige(superAdmin: boolean, onSelectArea = vi.fn()) {
  return render(
    <Seitenleiste
      trips={[SUEDITALIEN]}
      selectedTrip={SUEDITALIEN}
      today={HEUTE}
      activeArea="pois"
      superAdmin={superAdmin}
      onSelectTrip={vi.fn()}
      onSelectArea={onSelectArea}
      onCreateTrip={vi.fn()}
      onOpenTripDetails={vi.fn()}
    />,
  );
}

function schalter() {
  return screen.getByRole("button", { name: /^Bereiche (auf|ein)klappen$/ });
}

async function klappeAuf() {
  const user = userEvent.setup();
  await user.click(schalter());
  return user;
}

/**
 * req-077: Die Leiste startet bei jedem Laden eingeklappt und traegt dann nur
 * Symbole. Dass sie eingeklappt keinen Text zeigt, entscheidet das Stylesheet
 * (siehe seitenleiste.layout.test.ts) -- im Dokument bleibt die Beschriftung
 * stehen, damit Vorleseprogramme den Namen des Bereichs weiterhin nennen.
 */
describe("Seitenleiste des Planers -- Auf- und Zuklappen (req-077)", () => {
  it("ist beim Öffnen eingeklappt", () => {
    zeige(false);

    expect(schalter()).toHaveAttribute("aria-expanded", "false");
    expect(schalter()).toHaveAccessibleName("Bereiche aufklappen");
  });

  it("klappt auf, wenn man sie aufklappt", async () => {
    zeige(false);

    await klappeAuf();

    expect(schalter()).toHaveAttribute("aria-expanded", "true");
    expect(schalter()).toHaveAccessibleName("Bereiche einklappen");
  });

  it("klappt auf denselben Griff wieder zu", async () => {
    zeige(false);
    const user = await klappeAuf();

    await user.click(schalter());

    expect(schalter()).toHaveAttribute("aria-expanded", "false");
  });

  /**
   * Eingeklappt gibt es keinen Text -- der Name des Bereichs muss trotzdem
   * fuer Vorleseprogramme und als Tooltip vorhanden sein (req-077,
   * Constraints).
   */
  it("nennt jeden Bereich auch eingeklappt beim Namen", () => {
    zeige(true);

    for (const name of [
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Reisedetails",
      "Begleiter",
      "Mein Bereich",
      "Verwaltung",
    ]) {
      const eintrag = screen.getByTitle(name);
      expect(eintrag).toHaveAccessibleName(name);
    }
  });

  it("nennt auch die geöffnete Reise eingeklappt beim Namen", () => {
    zeige(false);

    expect(
      screen.getByTitle("Reise: Süditalien Rundreise"),
    ).toBeInTheDocument();
  });
});

/**
 * req-077: Sie klappt sich beim ersten Anzeichen zu, dass man fertig mit ihr
 * ist -- ein gewaehlter Bereich, ein Tipp daneben, Escape. Sie ist der Weg
 * irgendwohin, nicht der Ort, an dem man bleibt.
 */
describe("Seitenleiste des Planers -- klappt von selbst zu (req-077)", () => {
  it("klappt zu und öffnet den Bereich, wenn ich einen wähle", async () => {
    const onSelectArea = vi.fn();
    zeige(false, onSelectArea);
    const user = await klappeAuf();

    await user.click(screen.getByRole("button", { name: "Planung" }));

    expect(onSelectArea).toHaveBeenCalledWith("planung");
    expect(schalter()).toHaveAttribute("aria-expanded", "false");
  });

  /**
   * Der Tipp daneben trifft die Flaeche davor, nicht die Ansicht darunter:
   * die Leiste klappt zu, und unter dem Finger oeffnet sich nichts. Dass
   * diese Flaeche die ganze Seite bedeckt, prueft
   * seitenleiste.layout.test.ts.
   */
  it("klappt beim Tippen daneben zu, ohne darunter etwas zu öffnen", async () => {
    const onSelectArea = vi.fn();
    const onSelectTrip = vi.fn();
    render(
      <Seitenleiste
        trips={[SUEDITALIEN]}
        selectedTrip={SUEDITALIEN}
        today={HEUTE}
        activeArea="pois"
        onSelectTrip={onSelectTrip}
        onSelectArea={onSelectArea}
        onCreateTrip={vi.fn()}
        onOpenTripDetails={vi.fn()}
      />,
    );
    await klappeAuf();

    fireEvent.pointerDown(screen.getByTestId("leiste-davor"));

    expect(schalter()).toHaveAttribute("aria-expanded", "false");
    expect(onSelectArea).not.toHaveBeenCalled();
    expect(onSelectTrip).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("legt die Fläche davor erst beim Aufklappen an", async () => {
    zeige(false);
    expect(screen.queryByTestId("leiste-davor")).not.toBeInTheDocument();

    await klappeAuf();

    expect(screen.getByTestId("leiste-davor")).toBeInTheDocument();
  });

  it("klappt mit der Escape-Taste zu", async () => {
    zeige(false);
    const user = await klappeAuf();

    await user.keyboard("{Escape}");

    expect(schalter()).toHaveAttribute("aria-expanded", "false");
  });

  it("klappt auch zu, wenn ich eine andere Reise wähle", async () => {
    const onSelectTrip = vi.fn();
    render(
      <Seitenleiste
        trips={[SUEDITALIEN]}
        selectedTrip={SUEDITALIEN}
        today={HEUTE}
        activeArea="pois"
        onSelectTrip={onSelectTrip}
        onSelectArea={vi.fn()}
        onCreateTrip={vi.fn()}
        onOpenTripDetails={vi.fn()}
      />,
    );
    const user = await klappeAuf();
    await user.click(screen.getByTitle("Reise: Süditalien Rundreise"));

    await user.click(
      within(screen.getByRole("dialog", { name: "Reise wählen" })).getByText(
        "Süditalien Rundreise",
      ),
    );

    expect(onSelectTrip).toHaveBeenCalledWith(SUEDITALIEN.id);
    expect(schalter()).toHaveAttribute("aria-expanded", "false");
  });
});

/**
 * req-077: Der Zustand wird nicht gemerkt -- die Leiste startet bei jedem
 * Laden eingeklappt. Ein Neuladen baut die Ansicht neu auf; nichts darf sie
 * aus einer Ablage wieder aufklappen.
 */
describe("Seitenleiste des Planers -- merkt sich nichts (req-077)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("ist nach dem Neuladen der Seite wieder eingeklappt", async () => {
    const { unmount } = zeige(false);
    await klappeAuf();
    expect(schalter()).toHaveAttribute("aria-expanded", "true");

    // Ein Neuladen baut die Ansicht von vorn auf.
    unmount();
    zeige(false);

    expect(schalter()).toHaveAttribute("aria-expanded", "false");
  });

  it("legt den Zustand in keiner Ablage ab", async () => {
    zeige(false);

    await klappeAuf();

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });
});

/**
 * req-077: Aufgeklappt steht unter dem Namen ein Slogan in Handschrift. Er
 * tritt neben "KI · Reiseplanung" der Anmeldeseite, ohne ihn zu ersetzen.
 */
describe("Seitenleiste des Planers -- Slogan (req-077)", () => {
  it("trägt den Slogan „Wohin es euch zieht“ unter dem Namen", () => {
    zeige(false);

    const leiste = screen.getByRole("banner");
    expect(within(leiste).getByText("Wegfara")).toBeInTheDocument();
    expect(within(leiste).getByText(LEISTEN_SLOGAN)).toBeInTheDocument();
    expect(LEISTEN_SLOGAN).toBe("Wohin es euch zieht");
  });

  it("stellt ihn direkt unter den Namen", async () => {
    zeige(false);
    await klappeAuf();

    const name = within(screen.getByRole("banner")).getByText("Wegfara");
    expect(name.nextElementSibling).toHaveTextContent(LEISTEN_SLOGAN);
  });

  it("wiederholt den Slogan der Anmeldeseite nicht", () => {
    zeige(false);

    expect(screen.getByRole("banner")).not.toHaveTextContent(
      "KI · Reiseplanung",
    );
  });
});

describe("Seitenleiste des Planers -- Verwaltung (req-025, req-036)", () => {
  it('zeigt dem Gesamt-Admin die "Verwaltung"', () => {
    zeige(true);

    const bereich = screen.getByRole("link", { name: "Verwaltung" });
    expect(bereich).toHaveAttribute("href", ACCOUNTS_PATH);
  });

  it("zeigt sie einer gewoehnlichen Person nicht", () => {
    zeige(false);

    expect(
      screen.queryByRole("link", { name: "Verwaltung" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Verwaltung")).not.toBeInTheDocument();
  });

  it("laesst die uebrigen Bereiche unveraendert", () => {
    zeige(false);

    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    expect(screen.getByRole("button", { name: "POIs" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reisedetails" }),
    ).toBeInTheDocument();
    expect(nav).toBeInTheDocument();
  });
});

/**
 * Der Zustand steht weiterhin im Aufklappmenue am Reisenamen -- seit
 * req-033 aber nur noch zum Ansehen. Gesetzt wird er in den Reisedetails.
 * Das Menue selbst sitzt seit req-077 im Kopf der Seitenleiste.
 */
describe("Seitenleiste des Planers -- Aufklappmenü der Reisen (req-033)", () => {
  async function oeffneReiseliste() {
    const user = userEvent.setup();
    zeige(false);
    await user.click(screen.getByTitle("Reise: Süditalien Rundreise"));
    return screen.getByRole("dialog", { name: "Reise wählen" });
  }

  it("zeigt den Zustand jeder Reise", async () => {
    const menue = await oeffneReiseliste();

    expect(
      within(menue).getByLabelText("Zustand: Süditalien Rundreise"),
    ).toHaveTextContent("In Planung");
  });

  it("lässt ihn dort NICHT ändern", async () => {
    const menue = await oeffneReiseliste();

    expect(within(menue).queryAllByRole("combobox")).toHaveLength(0);
  });

  it("führt statt zum Formular in die Reisedetails", async () => {
    const menue = await oeffneReiseliste();

    expect(
      within(menue).getByRole("button", {
        name: "Reisedetails: Süditalien Rundreise",
      }),
    ).toBeInTheDocument();
    expect(
      within(menue).queryByRole("button", {
        name: "Reise ändern: Süditalien Rundreise",
      }),
    ).toBeNull();
  });

  it("bietet dort kein Löschen mehr an -- das steht in den Reisedetails", async () => {
    const menue = await oeffneReiseliste();

    expect(
      within(menue).queryByRole("button", {
        name: "Reise löschen: Süditalien Rundreise",
      }),
    ).toBeNull();
  });
});

/**
 * Das Aufklappmenue der Reisen ist ein Dialog ueber der Ansicht -- und muss
 * deshalb auch daneben wieder wegzubekommen sein (bug-018). Blieb es stehen,
 * verdeckte es die Reisedetails, in die "Neue Reise" fuehrt (req-033).
 */
describe("Seitenleiste des Planers -- Aufklappmenü schließen (bug-018)", () => {
  async function oeffneReiseliste(onSelectArea = vi.fn()) {
    const user = userEvent.setup();
    zeige(false, onSelectArea);
    await user.click(screen.getByTitle("Reise: Süditalien Rundreise"));
    expect(
      screen.getByRole("dialog", { name: "Reise wählen" }),
    ).toBeInTheDocument();
    return user;
  }

  it("schließt es beim Tippen daneben", async () => {
    const user = await oeffneReiseliste();

    await user.click(screen.getByRole("button", { name: "POIs" }));

    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("schließt es mit der Escape-Taste", async () => {
    const user = await oeffneReiseliste();

    await user.keyboard("{Escape}");

    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("lässt es beim Tippen darin offen", async () => {
    const user = await oeffneReiseliste();

    await user.click(screen.getByLabelText("Zustand: Süditalien Rundreise"));

    expect(
      screen.getByRole("dialog", { name: "Reise wählen" }),
    ).toBeInTheDocument();
  });

  it("reicht das Tippen daneben an die Leiste darunter weiter", async () => {
    const onSelectArea = vi.fn();
    const user = await oeffneReiseliste(onSelectArea);

    await user.click(screen.getByRole("button", { name: "Reisedetails" }));

    expect(onSelectArea).toHaveBeenCalledWith("reisedetails");
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });
});

/**
 * "Mein Bereich" (req-043) und die "Verwaltung" (req-025) liegen auf eigenen
 * Seiten und sind keine Bereiche der Reise. In der Seitenleiste sitzen sie
 * deshalb mitsamt dem Abmelden am Fuss, abgesetzt von der Liste (req-077):
 * Sie sind der Ort, an dem man den Alltag der App verlaesst. Einen Bereich
 * "Einstellungen" hat der Planer nicht -- er heisst seit req-033
 * "Reisedetails" und gehoert der geoeffneten Reise.
 */
describe("Seitenleiste des Planers -- Einstellungen am Fuß (req-077)", () => {
  function fuss() {
    return screen.getByRole("navigation", { name: "Einstellungen" });
  }

  it("zeigt „Mein Bereich“ jeder angemeldeten Person als Verweis", () => {
    zeige(false);

    expect(
      within(fuss()).getByRole("link", { name: "Mein Bereich" }),
    ).toHaveAttribute("href", MEIN_BEREICH_PATH);
  });

  it("stellt „Mein Bereich“ vor die „Verwaltung“ des Gesamt-Admins", () => {
    zeige(true);

    const beschriftungen = Array.from(fuss().children).map(
      (element) => element.textContent,
    );
    expect(beschriftungen).toEqual(["Mein Bereich", "Verwaltung", "Abmelden"]);
  });

  it("bietet das Abmelden dort an", () => {
    zeige(false);

    expect(
      within(fuss()).getByRole("button", { name: "Abmelden" }),
    ).toBeInTheDocument();
  });

  it("hält die Liste der Bereiche davon frei", () => {
    zeige(true);

    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    expect(nav).not.toHaveTextContent("Mein Bereich");
    expect(nav).not.toHaveTextContent("Verwaltung");
    expect(nav).not.toHaveTextContent("Abmelden");
  });

  it('kennt die Bereiche "Konto" und "Nutzer" nicht mehr (req-043)', () => {
    zeige(true);

    const leiste = screen.getByRole("banner");
    expect(leiste).not.toHaveTextContent("Konto");
    expect(leiste).not.toHaveTextContent("Nutzer");
  });
});

/**
 * Das Wort "Account" verschwindet mit req-036 aus der Navigation -- beide
 * Bereiche hiessen zuvor so und waren beim Lesen nicht zu unterscheiden.
 */
describe("Seitenleiste des Planers -- kein „Account“ mehr (req-036)", () => {
  it("nennt beim Gesamt-Admin nirgends „Account“", () => {
    zeige(true);

    expect(screen.getByRole("banner")).not.toHaveTextContent("Account");
  });

  it("nennt bei einer gewoehnlichen Person nirgends „Account“", () => {
    zeige(false);

    expect(screen.getByRole("banner")).not.toHaveTextContent("Account");
  });
});

/**
 * Der Wechsel zwischen den Bereichen (req-055): wer beide darf, findet ihn in
 * der Navigation beider. Den Begleiter darf jeder -- im Planer steht der Weg
 * dorthin deshalb ohne Bedingung. Er bleibt in der Liste der Bereiche und
 * nicht am Fuss: der Begleiter ist der Alltag der App unterwegs, kein
 * Ausstieg aus ihr (req-077).
 */
describe("Seitenleiste des Planers -- Wechsel in den Begleiter (req-055)", () => {
  it("zeigt den Wechsel in den Begleiter als Verweis", () => {
    zeige(false);

    expect(screen.getByRole("link", { name: "Begleiter" })).toHaveAttribute(
      "href",
      BEGLEITER_PATH,
    );
  });

  it("stellt ihn hinter die Bereiche der Reise", () => {
    zeige(false);

    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    const beschriftungen = Array.from(nav.children).map(
      (element) => element.textContent,
    );
    expect(beschriftungen).toEqual([
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Reisedetails",
      "Begleiter",
    ]);
  });
});
