import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ACCOUNT_SWITCH_API, PLANNER_PATH } from "@/lib/accounts/paths";
import { FremderAccountBalken } from "./fremder-account-balken";

describe("FremderAccountBalken (req-025)", () => {
  it("nennt den Bereich, in dem gerade gearbeitet wird", () => {
    render(<FremderAccountBalken accountName="Familie Huber" />);

    const balken = screen.getByTestId("fremder-account");
    expect(balken).toHaveTextContent("Familie Huber");
    expect(balken).toHaveTextContent("nicht in deinem eigenen");
  });

  it("nennt den Bereich statt den Account (req-036)", () => {
    render(<FremderAccountBalken accountName="Familie Huber" />);

    const balken = screen.getByTestId("fremder-account");
    expect(balken).toHaveTextContent("Du arbeitest im Bereich Familie Huber");
    expect(balken).not.toHaveTextContent("Account");
  });

  it("kehrt in den eigenen Account zurueck und oeffnet den Planer", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async () => ({ ok: true, json: async () => ({}) }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    const navigate = vi.fn();
    render(
      <FremderAccountBalken accountName="Familie Huber" navigate={navigate} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Zurück in meinen Bereich" }),
    );

    // Ohne Kennung heisst: zurueck in den eigenen Account.
    expect(fetchMock).toHaveBeenCalledWith(
      ACCOUNT_SWITCH_API,
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(PLANNER_PATH));
  });

  it("bleibt stehen, wenn die Rueckkehr fehlschlaegt", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("keine Verbindung");
      }),
    );
    const navigate = vi.fn();
    render(
      <FremderAccountBalken accountName="Familie Huber" navigate={navigate} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Zurück in meinen Bereich" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Zurück in meinen Bereich" }),
      ).toBeEnabled(),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId("fremder-account")).toHaveTextContent(
      "Familie Huber",
    );
  });
});
