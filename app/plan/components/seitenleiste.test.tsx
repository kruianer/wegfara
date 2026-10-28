import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trip } from "@/lib/trips/types";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { BEGLEITER_PATH } from "@/lib/einstieg/ziel";
import { NOCH_NICHT_HINWEIS } from "@/components/bereichsleiste";
import { PLAN_AREAS } from "@/lib/plan/areas";
import { Seitenleiste, LEISTEN_SLOGAN } from "./seitenleiste";
import { REISEWAHL_KURZ } from "./reisewahl";
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

/**
 * req-094: Die Leiste hat nur noch eine Form -- schmal, mit dem Namen jedes
 * Eintrags klein unter seinem Symbol. Ein Auf- und Zuklappen (req-077) gibt
 * es nicht mehr. Dass die Namen zu sehen sind und die Leiste schmal bleibt,
 * entscheidet das Stylesheet (seitenleiste.layout.test.ts) und misst die
 * E2E-Pruefung (tests/e2e/seitenleiste.e2e.ts).
 */
describe("Seitenleiste des Planers -- immer schmal (req-094)", () => {
  /** Die kurzen Namen, wie sie in der Leiste stehen -- in ihrer Reihenfolge. */
  const KURZ = [
    "Orte",
    "Plan",
    "Stimmen",
    "Kosten",
    "Papiere",
    "Reise",
    "Chat",
    "Drucken",
  ];

  it("stellt unter jedes Symbol seinen Namen", () => {
    zeige(true);

    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    const fuss = screen.getByRole("navigation", { name: "Einstellungen" });
    const eintraege = [
      ...Array.from(nav.children),
      ...Array.from(fuss.children),
    ];
    expect(eintraege.length).toBeGreaterThan(PLAN_AREAS.length);
    for (const eintrag of eintraege) {
      // Erst das Symbol, darunter (im Dokument danach) der Name.
      const zeichen = eintrag.querySelector("svg")!;
      expect(zeichen, eintrag.textContent!).not.toBeNull();
      expect(eintrag.textContent!.trim(), eintrag.outerHTML).not.toBe("");
      const name = eintrag.lastElementChild!;
      expect(name.contains(zeichen)).toBe(false);
      expect(
        zeichen.compareDocumentPosition(name) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("trägt in der Leiste die kurzen Namen der Bereiche", () => {
    zeige(false);

    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    const namen = Array.from(nav.children)
      .slice(0, PLAN_AREAS.length)
      .map((eintrag) => eintrag.textContent);
    expect(namen).toEqual(KURZ);
    expect(PLAN_AREAS.map((area) => area.kurz)).toEqual(KURZ);
  });

  it("hat keinen Knopf zum Auf- oder Zuklappen", () => {
    zeige(true);

    const leiste = screen.getByRole("banner");
    expect(
      within(leiste).queryByRole("button", { name: /klappen/i }),
    ).toBeNull();
    // Kein Knopf der Leiste schaltet sie selbst auf oder zu -- aufklappen
    // laesst sich allein das Menue der Reisen, und das ist ein Dialog
    // neben der Leiste.
    for (const knopf of within(leiste).queryAllByRole("button")) {
      if (knopf.hasAttribute("aria-expanded")) {
        expect(knopf).toHaveAttribute("aria-haspopup", "dialog");
      }
    }
    expect(screen.queryByTestId("leiste-davor")).toBeNull();
  });

  it("öffnet den gewählten Bereich und bleibt dabei, wie sie ist", async () => {
    const onSelectArea = vi.fn();
    const user = userEvent.setup();
    zeige(false, onSelectArea);
    const leiste = screen.getByRole("banner");
    const vorher = leiste.className;

    await user.click(screen.getByRole("button", { name: "Planung" }));

    expect(onSelectArea).toHaveBeenCalledWith("planung");
    expect(screen.getByRole("banner")).toBe(leiste);
    expect(leiste.className).toBe(vorher);
    expect(screen.queryByTestId("leiste-davor")).toBeNull();
  });

  /**
   * Nur die Leiste traegt die kurzen Namen (req-094). Der Bereich heisst
   * weiterhin "Bewertungen" -- als Tooltip und fuer Vorleseprogramme steht
   * der volle Name am Eintrag.
   */
  it("zeigt „Stimmen“ und nennt den Bereich weiterhin „Bewertungen“", () => {
    zeige(false);

    const eintrag = screen.getByRole("button", { name: "Bewertungen" });
    expect(eintrag).toHaveTextContent("Stimmen");
    expect(eintrag).not.toHaveTextContent("Bewertungen");
    expect(eintrag).toHaveAttribute("title", "Bewertungen");
  });

  it("nennt jeden Eintrag beim vollen Namen", () => {
    zeige(true);

    for (const name of [
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Reisedetails",
      "Chat",
      "Drucken",
      "Begleiter",
      "Mein Bereich",
      "Verwaltung",
    ]) {
      const eintrag = screen.getByTitle(name);
      expect(eintrag).toHaveAccessibleName(name);
    }
  });

  /**
   * Fuer Name und Zeitraum der Reise ist in der schmalen Leiste kein Platz
   * (req-094). Sie steht als Symbol mit "Reisen" da; der volle Name der
   * geoeffneten Reise erscheint beim Darueberfahren und ist der Name des
   * Knopfes fuer Vorleseprogramme.
   */
  it("nennt die geöffnete Reise beim Darüberfahren mit vollem Namen", () => {
    zeige(false);

    const reise = screen.getByTitle("Reise: Süditalien Rundreise");
    expect(reise).toHaveAccessibleName("Reise: Süditalien Rundreise");
    expect(reise).toHaveTextContent(REISEWAHL_KURZ);
    expect(reise.querySelector("svg")).not.toBeNull();
  });

  it("verwechselt die Reisewahl nicht mit den Reisedetails", () => {
    zeige(false);

    const reisedetails = screen.getByRole("button", { name: "Reisedetails" });
    expect(REISEWAHL_KURZ).not.toBe(reisedetails.textContent);
  });
});

/**
 * req-077: Der Zustand der Leiste wird nicht gemerkt -- seit req-094 hat sie
 * keinen mehr. Auch nichts anderes legt sie ab.
 */
describe("Seitenleiste des Planers -- merkt sich nichts (req-077)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("legt nichts in einer Ablage ab", async () => {
    const user = userEvent.setup();
    zeige(false);

    await user.click(screen.getByRole("button", { name: "Kosten" }));

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });
});

/**
 * req-077: Unter dem Namen steht ein Slogan in Handschrift. Er tritt neben
 * "KI · Reiseplanung" der Anmeldeseite, ohne ihn zu ersetzen. Seit req-094
 * stehen beide klein unter der Kompassrose -- bis dahin nur aufgeklappt.
 */
describe("Seitenleiste des Planers -- Marke und Slogan (req-077, req-094)", () => {
  it("trägt den Slogan „Wohin es euch zieht“ unter dem Namen", () => {
    zeige(false);

    const leiste = screen.getByRole("banner");
    expect(within(leiste).getByText("Wegfara")).toBeInTheDocument();
    expect(within(leiste).getByText(LEISTEN_SLOGAN)).toBeInTheDocument();
    expect(LEISTEN_SLOGAN).toBe("Wohin es euch zieht");
  });

  it("stellt Name und Slogan unter die Kompassrose", () => {
    zeige(false);

    const name = within(screen.getByRole("banner")).getByText("Wegfara");
    expect(name.nextElementSibling).toHaveTextContent(LEISTEN_SLOGAN);
    // Davor steht die Kompassrose -- als erstes in der Leiste.
    const rose = name.previousElementSibling!;
    expect(rose.querySelector("svg")).not.toBeNull();
    expect(rose.parentElement!.firstElementChild).toBe(rose);
  });

  /** Beschriftung, kein Bedienelement (req-094). */
  it("macht aus der Marke keinen Knopf", () => {
    zeige(false);

    const name = within(screen.getByRole("banner")).getByText("Wegfara");
    expect(name.closest("button, a")).toBeNull();
  });

  it("wiederholt den Slogan der Anmeldeseite nicht", () => {
    zeige(false);

    expect(screen.getByRole("banner")).not.toHaveTextContent(
      "KI · Reiseplanung",
    );
  });
});

/**
 * req-081: Der Ort, an dem man mit der App redet, ist ueber die Seitenleiste
 * erreichbar wie die uebrigen Bereiche. Solange das Chatfenster darin
 * entsteht, steht er sichtbar, aber abgeschaltet da (bug-033) -- nicht als
 * Sackgasse, die das Tippen wortlos schluckt.
 */
describe("Seitenleiste des Planers -- Bereich Chat (req-081)", () => {
  function chatEintrag() {
    return within(
      screen.getByRole("navigation", { name: "Bereiche" }),
    ).getByRole("button", { name: "Chat" });
  }

  it('fuehrt einen Bereich "Chat"', () => {
    zeige(false);

    expect(chatEintrag()).toBeInTheDocument();
  });

  it("fuehrt mit einem Tipp in den Bereich", async () => {
    const onSelectArea = vi.fn();
    zeige(false, onSelectArea);
    const user = userEvent.setup();

    await user.click(chatEintrag());

    expect(onSelectArea).toHaveBeenCalledWith("chat");
  });

  it("ist nicht abgeschaltet, seit es ihn gibt", () => {
    zeige(false);

    expect(chatEintrag()).toBeEnabled();
    expect(chatEintrag()).not.toHaveAttribute("title", NOCH_NICHT_HINWEIS);
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

    // Die Reihenfolge an den vollen Namen -- zu sehen sind in der Leiste die
    // kurzen (req-094).
    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    const beschriftungen = Array.from(nav.children).map((element) =>
      element.getAttribute("aria-label"),
    );
    expect(beschriftungen).toEqual([
      "POIs",
      "Planung",
      "Bewertungen",
      "Kosten",
      "Dokumente",
      "Reisedetails",
      // Der Chat kommt hinten dazu (req-081) und laesst die gewohnte
      // Reihenfolge der uebrigen unberuehrt.
      "Chat",
      // Der Reiseplan zum Ausdrucken ist seit req-103 ein Bereich wie die
      // uebrigen -- bis dahin stand er als Verweis hinter dem Begleiter.
      "Drucken",
      "Begleiter",
    ]);
  });
});

/**
 * req-078: Die Symbole der Bereiche tragen dieselben 22 px wie bei
 * LivingGardenTwin, an dem sich die Leiste ausrichtet. Seit req-094 steht
 * der Name darunter statt daneben -- die Groesse bleibt (req-094, GUI).
 */
describe("Seitenleiste des Planers -- die Symbole (req-078)", () => {
  /** Das Zeichen im Eintrag dieses Bereichs. */
  function symbol(name: string) {
    return screen.getByRole("button", { name }).querySelector("svg");
  }

  it("gibt jedem Bereichs-Symbol 22 px", () => {
    zeige(false);

    for (const bereich of ["POIs", "Planung", "Reisedetails"]) {
      expect(symbol(bereich)).toHaveAttribute("width", "22");
      expect(symbol(bereich)).toHaveAttribute("height", "22");
    }
  });

  it("gibt auch den Verweisen am Fuß dieselbe Größe", () => {
    zeige(true);

    for (const name of ["Begleiter", "Mein Bereich", "Verwaltung"]) {
      const zeichen = screen.getByRole("link", { name }).querySelector("svg");
      expect(zeichen).toHaveAttribute("width", "22");
      expect(zeichen).toHaveAttribute("height", "22");
    }
  });

  it("gibt auch der Reisewahl dieselbe Größe", () => {
    zeige(false);

    const zeichen = screen
      .getByTitle("Reise: Süditalien Rundreise")
      .querySelector("svg");
    expect(zeichen).toHaveAttribute("width", "22");
    expect(zeichen).toHaveAttribute("height", "22");
  });
});

/**
 * req-080 brachte den Reiseplan zum Ausdrucken als Verweis in einem eigenen
 * Tab; seit req-103 ist er ein Bereich des Planers.
 */
describe("Seitenleiste des Planers -- der Bereich Drucken (req-103)", () => {
  it("fuehrt in den Bereich, statt einen neuen Browser-Reiter zu oeffnen", async () => {
    const onSelectArea = vi.fn();
    render(
      <Seitenleiste
        trips={[SUEDITALIEN]}
        selectedTrip={SUEDITALIEN}
        today={new Date(2026, 6, 20)}
        activeArea="pois"
        onSelectTrip={vi.fn()}
        onSelectArea={onSelectArea}
        onCreateTrip={vi.fn()}
        onOpenTripDetails={vi.fn()}
      />,
    );

    const eintrag = screen.getByRole("button", { name: "Drucken" });
    expect(eintrag).not.toHaveAttribute("target");
    expect(eintrag).not.toHaveAttribute("href");
    await userEvent.click(eintrag);
    expect(onSelectArea).toHaveBeenCalledWith("drucken");
  });

  it("steht nur einmal in der Leiste", () => {
    zeige(false);

    expect(screen.getAllByTitle("Drucken")).toHaveLength(1);
    expect(screen.queryByTitle("Zum Ausdrucken")).not.toBeInTheDocument();
  });
});
