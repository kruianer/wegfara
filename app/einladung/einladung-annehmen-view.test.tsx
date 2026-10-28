import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { INVITATION_REDEEM_API } from "@/lib/auth/paths";
import { EinladungAnnehmenView } from "./einladung-annehmen-view";

describe("Einladung annehmen (bug-068)", () => {
  it("schickt die Einladung beim Oeffnen von selbst ab", () => {
    const absenden = vi.fn();

    render(<EinladungAnnehmenView token="token-1" absenden={absenden} />);

    expect(absenden).toHaveBeenCalledTimes(1);
    const form = absenden.mock.calls[0][0] as HTMLFormElement;
    // Eingeloest wird per POST -- der Aufruf der Adresse aus dem QR-Code
    // entwertet nichts.
    expect(form.method).toBe("post");
    expect(new URL(form.action).pathname).toBe(INVITATION_REDEEM_API);
    expect(new FormData(form).get("token")).toBe("token-1");
  });

  it("schickt nur einmal ab, auch wenn die Seite neu zeichnet", () => {
    const absenden = vi.fn();

    const { rerender } = render(
      <EinladungAnnehmenView token="token-1" absenden={absenden} />,
    );
    rerender(<EinladungAnnehmenView token="token-1" absenden={absenden} />);

    expect(absenden).toHaveBeenCalledTimes(1);
  });

  it("laesst einen Knopf stehen, falls das Absenden nicht anspringt", () => {
    render(<EinladungAnnehmenView token="token-1" absenden={() => {}} />);

    expect(
      screen.getByRole("button", { name: "Einladung annehmen" }),
    ).toHaveAttribute("type", "submit");
  });
});
