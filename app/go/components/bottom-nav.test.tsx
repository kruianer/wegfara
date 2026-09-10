import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomNav, type Tab } from "./bottom-nav";

/** Alle Eintraege der Leiste -- auch die noch abgeschalteten. */
const EINTRAEGE = [
  "Plan",
  "Karte",
  "Kosten",
  "Dokumente",
  "Meldungen",
  "Concierge",
];

function zeige(onSelectTab: (tab: Tab) => void = () => {}) {
  render(<BottomNav activeTab="plan" onSelectTab={onSelectTab} />);
}

describe("Untere Leiste des Begleiters -- Symbole (bug-034)", () => {
  it.each(EINTRAEGE)("zeigt zu %s ein Symbol", (beschriftung) => {
    zeige();

    const knopf = screen.getByRole("button", { name: beschriftung });

    expect(knopf.querySelector("svg")).not.toBeNull();
  });

  it.each(EINTRAEGE)(
    "stellt bei %s das Symbol vor die Beschriftung",
    (beschriftung) => {
      zeige();

      // Auf dem Smartphone ist die Leiste das Hauptnavigationsmittel: das
      // Symbol steht oben, die Beschriftung darunter (siehe
      // bottom-nav.layout.test.ts fuer das Stapeln im CSS).
      const knopf = screen.getByRole("button", { name: beschriftung });
      const [oben, unten] = Array.from(knopf.children);

      expect(oben.querySelector("svg")).not.toBeNull();
      expect(unten.textContent).toBe(beschriftung);
    },
  );

  it("laesst das Symbol die Beschriftung nicht verdecken", () => {
    zeige();

    // Waere das Symbol nicht aria-hidden, hiesse der Knopf nicht mehr
    // schlicht "Plan" -- getByRole oben wuerde ihn dann nicht finden.
    const knopf = screen.getByRole("button", { name: "Plan" });

    expect(knopf.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Untere Leiste des Begleiters -- Bedienung", () => {
  it("meldet den angetippten Bereich", async () => {
    const onSelectTab = vi.fn();
    zeige(onSelectTab);

    await userEvent.click(screen.getByRole("button", { name: "Kosten" }));

    expect(onSelectTab).toHaveBeenCalledWith("costs");
  });

  it("kennzeichnet den offenen Bereich", () => {
    zeige();

    expect(screen.getByRole("button", { name: "Plan" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Karte" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("laesst die noch nicht gebauten Bereiche abgeschaltet", () => {
    zeige();

    expect(screen.getByRole("button", { name: "Meldungen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Concierge" })).toBeDisabled();
  });
});
