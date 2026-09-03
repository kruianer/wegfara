import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EinladungPasskeyView } from "./einladung-passkey-view";

describe("EinladungPasskeyView (req-023)", () => {
  it("fordert die eingeladene Person auf, einen Passkey einzurichten", () => {
    render(<EinladungPasskeyView name="Clara Berger" hatEmail={false} />);

    expect(
      screen.getByRole("heading", { name: "Willkommen, Clara Berger" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Passkey einrichten" }),
    ).toBeInTheDocument();
  });

  // jsdom kennt keine Passkeys — genau wie ein Geraet ohne Unterstuetzung.
  it("verweist mit hinterlegter Adresse auf den Anmeldelink", () => {
    render(<EinladungPasskeyView name="Clara Berger" hatEmail />);

    expect(screen.getByText(/Anmeldelink an deine E-Mail/)).toBeInTheDocument();
  });

  it("verweist ohne Adresse auf den Reiseleiter", () => {
    render(<EinladungPasskeyView name="Max Gast" hatEmail={false} />);

    expect(
      screen.getByText(/wende dich an den Reiseleiter/),
    ).toBeInTheDocument();
  });

  it("laesst das Einrichten auf spaeter verschieben", async () => {
    const navigate = vi.fn();
    render(
      <EinladungPasskeyView
        name="Clara Berger"
        hatEmail={false}
        navigate={navigate}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Später einrichten" }),
    );

    expect(navigate).toHaveBeenCalledWith("/");
  });
});
