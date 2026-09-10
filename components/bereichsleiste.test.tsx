import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { BEGLEITER_PATH } from "@/lib/einstieg/ziel";
import { planAreaPath } from "@/lib/plan/areas";
import { Bereichsleiste } from "./bereichsleiste";

function leiste() {
  return screen.getByRole("navigation", { name: "Bereiche" });
}

/**
 * bug-033: Aus jedem Bereich sind alle uebrigen erreichbar. Ausserhalb des
 * Planers gibt es keinen Planer-Zustand, den ein Knopf umschalten koennte --
 * dort fuehren die Bereiche als Verweis an die Adresse des Planers, die den
 * Bereich gleich vorwaehlt.
 */
describe("Bereichsleiste ausserhalb des Planers (bug-033)", () => {
  it("führt aus jedem Bereich in jeden anderen", () => {
    render(<Bereichsleiste aktiv="mein-bereich" superAdmin />);

    const ziele = Object.fromEntries(
      within(leiste())
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    );
    expect(ziele).toEqual({
      POIs: planAreaPath("pois"),
      Planung: planAreaPath("planung"),
      Dokumente: planAreaPath("dokumente"),
      Reisedetails: planAreaPath("reisedetails"),
      Begleiter: BEGLEITER_PATH,
      "Mein Bereich": MEIN_BEREICH_PATH,
      Verwaltung: ACCOUNTS_PATH,
    });
  });

  it("kennzeichnet, wo man gerade ist", () => {
    render(<Bereichsleiste aktiv="verwaltung" superAdmin />);

    expect(
      within(leiste()).getByRole("link", { name: "Verwaltung" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(leiste()).getByRole("link", { name: "Begleiter" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("zeigt die „Verwaltung“ nur dem Gesamt-Admin", () => {
    render(<Bereichsleiste aktiv="mein-bereich" />);

    expect(leiste()).not.toHaveTextContent("Verwaltung");
  });

  /**
   * Den Planer darf nur, wer ihn darf (req-055) -- alle uebrigen landen dort
   * ohne Meldung wieder im Begleiter. Ein Verweis dorthin waere eine
   * Sackgasse mit Umweg.
   */
  it("bietet die Planer-Bereiche nicht an, wer den Planer nicht darf", () => {
    render(<Bereichsleiste aktiv="mein-bereich" planerBereiche={false} />);

    expect(
      within(leiste()).queryByRole("link", { name: "POIs" }),
    ).not.toBeInTheDocument();
    expect(
      within(leiste()).getByRole("link", { name: "Begleiter" }),
    ).toBeInTheDocument();
    expect(
      within(leiste()).getByRole("link", { name: "Mein Bereich" }),
    ).toBeInTheDocument();
  });

  it("bietet das Abmelden an -- und lässt es weg, wo es schon steht", () => {
    const { unmount } = render(<Bereichsleiste aktiv="verwaltung" />);
    expect(
      screen.getByRole("button", { name: "Abmelden" }),
    ).toBeInTheDocument();
    unmount();

    render(<Bereichsleiste aktiv="mein-bereich" abmelden={false} />);
    expect(
      screen.queryByRole("button", { name: "Abmelden" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Im Planer wechselt ein Bereich nur den Zustand -- die Leiste gibt dort
 * Schaltflaechen statt Verweise aus.
 */
describe("Bereichsleiste im Planer (bug-033)", () => {
  it("wechselt den Bereich, statt die Seite zu wechseln", async () => {
    const user = userEvent.setup();
    const onSelectArea = vi.fn();
    render(<Bereichsleiste aktiv="pois" onSelectArea={onSelectArea} />);

    await user.click(within(leiste()).getByRole("button", { name: "Planung" }));

    expect(onSelectArea).toHaveBeenCalledWith("planung");
    expect(
      within(leiste()).queryByRole("link", { name: "Planung" }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Bewertungen und Kosten sind im Planer noch nicht gebaut (siehe
 * SWITCHABLE_PLAN_AREAS). Bis bug-033 schluckte die Leiste das Tippen
 * darauf wortlos -- was sich anfuehlte, als sei man dort gelandet und komme
 * nicht mehr weg. Jetzt sind sie sichtbar abgeschaltet.
 */
describe("Bereichsleiste -- noch nicht gebaute Bereiche (bug-033)", () => {
  it("schaltet Bewertungen und Kosten sichtbar ab", () => {
    render(<Bereichsleiste aktiv="pois" onSelectArea={vi.fn()} />);

    expect(
      within(leiste()).getByRole("button", { name: "Kosten" }),
    ).toBeDisabled();
    expect(
      within(leiste()).getByRole("button", { name: "Bewertungen" }),
    ).toBeDisabled();
    expect(
      within(leiste()).getByRole("button", { name: "POIs" }),
    ).toBeEnabled();
  });

  it("bietet sie ausserhalb des Planers auch nicht als Verweis an", () => {
    render(<Bereichsleiste aktiv="mein-bereich" />);

    expect(
      within(leiste()).queryByRole("link", { name: "Kosten" }),
    ).not.toBeInTheDocument();
    expect(
      within(leiste()).getByRole("button", { name: "Kosten" }),
    ).toBeDisabled();
  });
});
