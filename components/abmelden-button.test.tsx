import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LOGOUT_API } from "@/lib/auth/paths";
import { AbmeldenButton } from "./abmelden-button";

describe("AbmeldenButton (req-016)", () => {
  it("beendet die Sitzung und fuehrt auf die Startseite", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async () => ({ ok: true, json: async () => ({}) }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    const navigate = vi.fn();
    render(<AbmeldenButton navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "Abmelden" }));

    expect(fetchMock).toHaveBeenCalledWith(LOGOUT_API, { method: "POST" });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("fuehrt auch dann auf die Startseite, wenn der Aufruf scheitert", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("keine Verbindung");
      }),
    );
    const navigate = vi.fn();
    render(<AbmeldenButton navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "Abmelden" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });
});
