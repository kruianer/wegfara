import { fireEvent, screen, within } from "@testing-library/react";

/**
 * Die POI-Liste bedienen, wie es seit req-098 geht: gefiltert wird im
 * Filterblatt unter dem Filter-Knopf, sortiert im Blatt unter dem
 * Sortieren-Knopf -- Auswahllisten gibt es dafür nicht mehr.
 */

/**
 * Wählt im Filterblatt einen Wert eines Feldes an oder ab -- öffnet das
 * Blatt dafür, falls es zu ist.
 */
export function filterWaehlen(
  feld: "Status" | "Gegend" | "Typ",
  wert: string,
): void {
  if (!screen.queryByTestId("poi-filterblatt")) {
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  }
  const gruppe = screen.getByRole("group", { name: feld });
  fireEvent.click(within(gruppe).getByRole("button", { name: wert }));
}

/** Schließt das Filterblatt wieder („Fertig"). */
export function filterblattSchliessen(): void {
  const blatt = screen.queryByTestId("poi-filterblatt");
  if (!blatt) return;
  fireEvent.click(within(blatt).getByRole("button", { name: "Fertig" }));
}

/** Wählt im Sortierblatt eine Ordnung -- das Blatt schließt sich danach. */
export function sortierenNach(ordnung: string): void {
  fireEvent.click(screen.getByRole("button", { name: "Sortieren" }));
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`^${ordnung}\\b`) }),
  );
}

/** Welche Werte im Filterblatt eines Feldes gewählt sind. */
export function gewaehlteFilter(feld: "Status" | "Gegend" | "Typ"): string[] {
  if (!screen.queryByTestId("poi-filterblatt")) {
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  }
  const gruppe = screen.getByRole("group", { name: feld });
  return within(gruppe)
    .getAllByRole("button")
    .filter((pille) => pille.getAttribute("aria-pressed") === "true")
    .map((pille) => pille.textContent ?? "");
}

/** Welche Ordnung im Sortierblatt gewählt ist. */
export function gewaehlteSortierung(): string {
  fireEvent.click(screen.getByRole("button", { name: "Sortieren" }));
  const blatt = within(screen.getByTestId("poi-sortierblatt"));
  const gewaehlt = blatt
    .getAllByRole("button")
    .find((knopf) => knopf.getAttribute("aria-pressed") === "true");
  // Das Blatt wieder zu, damit der Aufrufer weiterarbeiten kann.
  fireEvent.click(screen.getByRole("button", { name: "Sortieren" }));
  // Ohne die Richtung daneben („A → Z") -- nur der Name der Ordnung.
  const richtung =
    gewaehlt?.querySelector('[data-testid^="poi-sortier-richtung-"]')
      ?.textContent ?? "";
  return (gewaehlt?.textContent ?? "").replace(richtung, "").trim();
}
