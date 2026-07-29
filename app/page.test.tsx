import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import Home from "./page";

describe("Startseite (req-007)", () => {
  it("verwendet keine Farbwelt des Begleiters - die Startseite bleibt unabhaengig vom Theme", () => {
    const { container } = render(<Home />);

    expect(container.querySelector('[style*="--bg"]')).toBeNull();
    expect(container.querySelector('[style*="--acc"]')).toBeNull();
  });
});
