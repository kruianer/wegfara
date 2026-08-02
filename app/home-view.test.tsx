import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeView } from "./home-view";

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe("Startseite (req-015)", () => {
  it('zeigt die Wortmarke "Wegfara"', () => {
    setWindowWidth(1440);
    render(<HomeView />);

    expect(screen.getByText("Wegfara")).toBeInTheDocument();
  });

  it("zeigt genau drei Wege: Planer, Begleiter und Abstimmung", () => {
    setWindowWidth(1440);
    render(<HomeView />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      "Planer",
      "Begleiter",
      "Abstimmung",
    ]);
  });

  it("zeigt keine Reisedaten", () => {
    setWindowWidth(1440);
    render(<HomeView />);

    expect(
      screen.queryByText(/Süditalien|Rundreise|Städtereise/i),
    ).not.toBeInTheDocument();
  });

  describe("bei 1440 Pixel Fensterbreite", () => {
    it('öffnet der Weg "Planer" den Planer', () => {
      setWindowWidth(1440);
      render(<HomeView />);

      expect(screen.getByRole("link", { name: /^Planer/ })).toHaveAttribute(
        "href",
        "/plan",
      );
    });

    it('öffnet der Weg "Begleiter" den Begleiter', () => {
      setWindowWidth(1440);
      render(<HomeView />);

      expect(screen.getByRole("link", { name: /^Begleiter/ })).toHaveAttribute(
        "href",
        "/go",
      );
    });
  });

  describe("bei 500 Pixel Fensterbreite", () => {
    it('trägt der Weg "Planer" einen Hinweis auf die benötigte Bildschirmbreite', () => {
      setWindowWidth(500);
      render(<HomeView />);

      expect(screen.getByText(/breiteren Bildschirm/i)).toBeInTheDocument();
    });

    it('öffnet der Weg "Planer" NICHT', () => {
      setWindowWidth(500);
      render(<HomeView />);

      expect(
        screen.queryByRole("link", { name: /^Planer/ }),
      ).not.toBeInTheDocument();
    });

    it('bleibt der Weg "Begleiter" weiterhin erreichbar', () => {
      setWindowWidth(500);
      render(<HomeView />);

      expect(screen.getByRole("link", { name: /^Begleiter/ })).toHaveAttribute(
        "href",
        "/go",
      );
    });
  });

  it("zeigt nach Eingabe und Bestätigen eines Einladungscodes den Hinweis, dass die Abstimmung noch nicht verfügbar ist", async () => {
    setWindowWidth(1440);
    const user = userEvent.setup();
    render(<HomeView />);

    expect(screen.queryByText(/noch nicht verfügbar/i)).not.toBeInTheDocument();

    await user.type(
      screen.getByRole("textbox", { name: "Einladungscode" }),
      "ABC123",
    );
    await user.click(screen.getByRole("button", { name: "Bestätigen" }));

    expect(screen.getByText(/noch nicht verfügbar/i)).toBeInTheDocument();
  });
});
