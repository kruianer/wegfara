import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FotoAnsicht } from "./foto-ansicht";

/**
 * Die Großansicht eines Fotos (bug-038): Ein Klick auf das Foto zeigt es
 * groß; heraus kommt man mit einem Klick daneben, mit „Schließen" und mit der
 * Escape-Taste. Hat der Ort mehrere Fotos, lässt sich zwischen ihnen
 * blättern.
 */
describe("FotoAnsicht (bug-038)", () => {
  const drei = [
    "/api/poi-fotos/foto-1",
    "/api/poi-fotos/foto-2",
    "/api/poi-fotos/foto-3",
  ];

  function ansicht(fotos: string[], onClose = () => {}) {
    return render(
      <FotoAnsicht fotos={fotos} titel="Villa Rufolo" onClose={onClose} />,
    );
  }

  it("zeigt das erste Foto", () => {
    ansicht(drei);

    expect(
      screen.getByRole("img", { name: "Bild 1 von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("nennt den Ort, zu dem die Fotos gehören", () => {
    ansicht(drei);

    expect(
      screen.getByRole("dialog", { name: "Fotos von Villa Rufolo" }),
    ).toBeInTheDocument();
  });

  it("blättert zum nächsten Foto und wieder zurück", async () => {
    const user = userEvent.setup();
    ansicht(drei);

    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(screen.getByText("Bild 2 von 3")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Bild 2 von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-2");

    await user.click(screen.getByRole("button", { name: "Zurück" }));

    expect(
      screen.getByRole("img", { name: "Bild 1 von Villa Rufolo" }),
    ).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("blättert nicht über das erste und das letzte Foto hinaus", async () => {
    const user = userEvent.setup();
    ansicht(drei);

    expect(screen.getByRole("button", { name: "Zurück" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(screen.getByText("Bild 3 von 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeDisabled();
  });

  it("zeigt bei einem einzigen Foto nichts zum Blättern", () => {
    ansicht(["/api/poi-fotos/foto-1"]);

    expect(
      screen.queryByRole("button", { name: "Weiter" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zurück" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Bild 1 von 1/)).not.toBeInTheDocument();
  });

  it("schließt mit dem Knopf „Schließen“", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    ansicht(drei, onClose);

    await user.click(screen.getByRole("button", { name: "Schließen" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("schließt mit einem Klick daneben", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    ansicht(drei, onClose);

    await user.click(screen.getByTestId("foto-ansicht-hintergrund"));

    expect(onClose).toHaveBeenCalled();
  });

  it("schließt mit der Escape-Taste", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    ansicht(drei, onClose);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("schließt nicht beim Klick auf das Foto selbst", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    ansicht(drei, onClose);

    await user.click(
      screen.getByRole("img", { name: "Bild 1 von Villa Rufolo" }),
    );

    expect(onClose).not.toHaveBeenCalled();
  });

  it("hört nach dem Schließen nicht weiter auf die Escape-Taste", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { unmount } = ansicht(drei, onClose);

    unmount();
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });
});
