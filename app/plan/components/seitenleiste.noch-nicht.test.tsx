import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Trip } from "@/lib/trips/types";
import { NOCH_NICHT_HINWEIS } from "@/components/bereichsleiste";
import { LEERE_PRAEFERENZEN } from "@/lib/trips/praeferenzen";
import { Seitenleiste } from "./seitenleiste";

/**
 * Derzeit sind alle Bereiche gebaut (lib/plan/areas.ts). Damit der Fall
 * trotzdem geprueft bleibt, gilt hier der Chat als noch nicht gebaut -- der
 * naechste neue Bereich steht wieder so in der Leiste, bevor es ihn gibt.
 */
vi.mock("@/lib/plan/areas", async (importOriginal) => {
  const echt = await importOriginal<typeof import("@/lib/plan/areas")>();
  return {
    ...echt,
    isSwitchablePlanArea: (area: string) => area !== "chat",
  };
});

const REISE: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
  tempo: "ausgewogen",
  praeferenzen: LEERE_PRAEFERENZEN,
};

/**
 * bug-033: Ein noch nicht gebauter Bereich steht sichtbar, aber abgeschaltet
 * in der Leiste -- auch in ihrer schmalen Form seit req-094, mit Symbol und
 * kurzem Namen wie die uebrigen.
 */
describe("Seitenleiste des Planers -- ein noch nicht gebauter Bereich (bug-033, req-094)", () => {
  it("steht sichtbar und abgeschaltet da", () => {
    render(
      <Seitenleiste
        trips={[REISE]}
        selectedTrip={REISE}
        today={new Date(2026, 6, 1)}
        activeArea="pois"
        onSelectTrip={vi.fn()}
        onSelectArea={vi.fn()}
        onCreateTrip={vi.fn()}
        onOpenTripDetails={vi.fn()}
      />,
    );

    const chat = within(
      screen.getByRole("navigation", { name: "Bereiche" }),
    ).getByRole("button", { name: "Chat" });
    expect(chat).toBeDisabled();
    expect(chat).toHaveAttribute("title", NOCH_NICHT_HINWEIS);
    expect(chat).toHaveTextContent("Chat");
    expect(chat.querySelector("svg")).not.toBeNull();
    // Die uebrigen bleiben bedienbar.
    expect(screen.getByRole("button", { name: "Kosten" })).toBeEnabled();
  });
});
