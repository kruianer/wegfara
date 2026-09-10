import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TippzielCheckbox } from "./tippziel-checkbox";

describe("TippzielCheckbox (bug-025)", () => {
  it("ist eine gewoehnliche Ankreuzbox mit Beschriftung", () => {
    render(
      <TippzielCheckbox
        aria-label="Alle POIs auswählen"
        checked
        onChange={() => {}}
      />,
    );

    const box = screen.getByRole("checkbox", { name: "Alle POIs auswählen" });
    expect(box).toBeChecked();
  });

  it("meldet das Ankreuzen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TippzielCheckbox
        aria-label="Alcázar auswählen"
        checked={false}
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", { name: "Alcázar auswählen" }),
    );

    expect(onChange).toHaveBeenCalled();
  });

  it("reicht die Rolle durch -- die Statusfilter der Karte sind Schalter", () => {
    render(
      <TippzielCheckbox
        role="switch"
        aria-label="Gesetzt"
        checked
        onChange={() => {}}
      />,
    );

    expect(screen.getByRole("switch", { name: "Gesetzt" })).toBeChecked();
  });
});

describe("TippzielCheckbox -- ueberlagernde Trefferflaeche (bug-029)", () => {
  it("kennzeichnet die Ankreuzbox als ueberlagernd", () => {
    render(
      <TippzielCheckbox
        ueberlagernd
        role="switch"
        aria-label="Gesetzt"
        checked
        onChange={() => {}}
      />,
    );

    const schalter = screen.getByRole("switch", { name: "Gesetzt" });
    expect(schalter.parentElement?.className).toMatch(/wrapUeberlagernd/);
    // Eine Layout-Frage -- im Markup hat sie nichts verloren.
    expect(schalter).not.toHaveAttribute("ueberlagernd");
  });

  it("bleibt ohne die Kennzeichnung so gross wie bisher", () => {
    render(
      <TippzielCheckbox aria-label="Alcázar auswählen" onChange={() => {}} />,
    );

    const box = screen.getByRole("checkbox", { name: "Alcázar auswählen" });
    expect(box.parentElement?.className).not.toMatch(/wrapUeberlagernd/);
  });
});
