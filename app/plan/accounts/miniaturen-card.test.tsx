import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MiniaturenSchritt } from "@/lib/miniaturen/types";
import { MINIATUREN_FEHLER } from "@/lib/miniaturen/request-miniaturen";
import { MINIATUREN_OHNE_ABLAGE, MiniaturenCard } from "./miniaturen-card";

function schrittMit(werte: Partial<MiniaturenSchritt>): MiniaturenSchritt {
  return {
    bilder: 3,
    mitMiniatur: 0,
    geprueft: 0,
    erzeugt: 0,
    fehlgeschlagen: 0,
    weiter: null,
    ...werte,
  };
}

/** Ein Lauf, dessen Schritte erst weitergehen, wenn der Test es sagt. */
function gesteuerterLauf(antworten: MiniaturenSchritt[]) {
  const offen: (() => void)[] = [];
  const schritt = vi.fn(
    (nach: string | null) =>
      new Promise<MiniaturenSchritt | null>((resolve) => {
        void nach;
        const antwort = antworten[schritt.mock.calls.length - 1];
        offen.push(() => resolve(antwort));
      }),
  );
  return {
    schritt,
    weiter() {
      offen.shift()?.();
    },
  };
}

describe("MiniaturenCard (req-105)", () => {
  it("nennt, wie viele Bilder schon eine Miniatur haben", () => {
    render(<MiniaturenCard stand={{ bilder: 1212, mitMiniatur: 40 }} />);

    expect(
      within(screen.getByRole("region", { name: "Miniaturen" })).getByText(
        /40 von 1212 Bildern/,
      ),
    ).toBeInTheDocument();
  });

  it("fuehrt den Lauf Schritt fuer Schritt und zeigt den Fortschritt", async () => {
    const user = userEvent.setup();
    const lauf = gesteuerterLauf([
      schrittMit({ geprueft: 2, erzeugt: 2, mitMiniatur: 2, weiter: "b.jpg" }),
      schrittMit({ geprueft: 3, erzeugt: 1, mitMiniatur: 3, weiter: null }),
    ]);
    render(
      <MiniaturenCard
        stand={{ bilder: 3, mitMiniatur: 0 }}
        schritt={lauf.schritt}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Fehlende Miniaturen erzeugen" }),
    );
    expect(lauf.schritt).toHaveBeenLastCalledWith(null);

    lauf.weiter();
    await waitFor(() =>
      expect(
        screen.getByRole("progressbar", { name: "Fortschritt der Miniaturen" }),
      ).toHaveAttribute("value", "2"),
    );
    expect(screen.getByText("Geprüft 2 von 3 Bildern · 2 neu")).toBeVisible();
    expect(lauf.schritt).toHaveBeenLastCalledWith("b.jpg");

    lauf.weiter();
    expect(
      await screen.findByText("Fertig: 3 Miniaturen neu erzeugt."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("miniaturen-stand")).toHaveTextContent(
      "3 von 3 Bildern",
    );
    expect(
      screen.getByRole("button", { name: "Fehlende Miniaturen erzeugen" }),
    ).toBeEnabled();
  });

  it("haelt den Lauf auf Wunsch zwischen zwei Schritten an", async () => {
    const user = userEvent.setup();
    const lauf = gesteuerterLauf([
      schrittMit({ geprueft: 1, erzeugt: 1, mitMiniatur: 1, weiter: "a.jpg" }),
    ]);
    render(
      <MiniaturenCard
        stand={{ bilder: 3, mitMiniatur: 0 }}
        schritt={lauf.schritt}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Fehlende Miniaturen erzeugen" }),
    );
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));
    lauf.weiter();

    expect(
      await screen.findByText(
        "Abgebrochen nach 1 von 3 Bildern: 1 Miniatur neu erzeugt.",
      ),
    ).toBeInTheDocument();
    expect(lauf.schritt).toHaveBeenCalledTimes(1);
  });

  it("nennt die Bilder, die sich nicht verkleinern liessen", async () => {
    const user = userEvent.setup();
    const schritt = vi.fn(async () =>
      schrittMit({ geprueft: 3, erzeugt: 2, fehlgeschlagen: 1 }),
    );
    render(
      <MiniaturenCard
        stand={{ bilder: 3, mitMiniatur: 0 }}
        schritt={schritt}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Fehlende Miniaturen erzeugen" }),
    );

    expect(
      await screen.findByText(
        "Fertig: 2 Miniaturen neu erzeugt, 1 nicht möglich — diese zeigen weiter das Original.",
      ),
    ).toBeInTheDocument();
  });

  it("sagt, wenn ein Schritt scheitert", async () => {
    const user = userEvent.setup();
    render(
      <MiniaturenCard
        stand={{ bilder: 3, mitMiniatur: 0 }}
        schritt={vi.fn(async () => null)}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Fehlende Miniaturen erzeugen" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MINIATUREN_FEHLER,
    );
  });

  it("bietet ohne Bildverzeichnis keinen Lauf an", () => {
    render(<MiniaturenCard stand={null} />);

    expect(screen.getByText(MINIATUREN_OHNE_ABLAGE)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fehlende Miniaturen erzeugen" }),
    ).toBeDisabled();
  });
});
