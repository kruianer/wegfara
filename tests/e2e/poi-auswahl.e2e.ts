import type { Page } from "@playwright/test";
import { POI_AUSWAHL_BREITE_PX } from "@/lib/design/stil";
import { expect, test } from "./fixtures";
import { seedPoi } from "./seed";

/**
 * Die POI-Auswahl der Planung, zuklappbar (req-099), im echten Browser: wie
 * breit sie offen ist, was die Tageskarte beim Zuklappen gewinnt, und dass der
 * Griff im Streifen ein volles Tippziel bleibt -- was jsdom nicht ausrechnet.
 */

async function zeigePlanung(seite: Page): Promise<void> {
  await seite.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(seite.getByTestId("timeline-grid")).toBeVisible();
}

async function breiteVon(seite: Page, testId: string): Promise<number> {
  const kasten = await seite.getByTestId(testId).boundingBox();
  if (!kasten) throw new Error(`${testId} ist nicht zu sehen.`);
  return kasten.width;
}

test("POI-Auswahl: offen 340 px, zugeklappt ein Streifen, die Karte gewinnt den Platz", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand");
  await seedPoi(kontext, "Hotel Maria Cristina", "hotel", "gesetzt", {
    buchung: "gebucht",
  });

  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  // Offen: 340 px.
  expect(await breiteVon(seite, "poi-auswahl")).toBe(
    POI_AUSWAHL_BREITE_PX.offen,
  );
  const karteOffen = await breiteVon(seite, "day-route-map");

  // Die Karten (req-099): Bild 78 x 58 px, alle gleich hoch -- mit und ohne
  // Buchungszeichen -- und nicht hoeher als Bild, Zeile darunter und Rand.
  const bild = await seite
    .locator('[data-testid^="unplanned-poi-bild-"]')
    .first()
    .boundingBox();
  expect(bild).toMatchObject({ width: 78, height: 58 });
  const hoehen = await seite
    .locator('[data-testid^="unplanned-poi-"][draggable]')
    .evaluateAll((karten) =>
      karten.map((karte) => karte.getBoundingClientRect().height),
    );
  expect(hoehen).toHaveLength(2);
  expect(hoehen[0]).toBe(hoehen[1]);
  expect(hoehen[0]).toBeLessThanOrEqual(92);

  // Zugeklappt: ein Streifen von etwa 40 px, die Karte rund 340 px breiter.
  await seite.getByRole("button", { name: "Auswahl zuklappen" }).click();
  const streifen = await breiteVon(seite, "poi-auswahl");
  expect(streifen).toBe(POI_AUSWAHL_BREITE_PX.zu);
  expect(streifen).toBeLessThanOrEqual(44);
  const karteZu = await breiteVon(seite, "day-route-map");
  expect(karteZu - karteOffen).toBe(
    POI_AUSWAHL_BREITE_PX.offen - POI_AUSWAHL_BREITE_PX.zu,
  );

  // Der Griff im Streifen ist der einzige Weg zurueck: mindestens 44 x 44 px.
  const griff = await seite
    .getByRole("button", { name: "Auswahl aufklappen" })
    .boundingBox();
  expect(griff!.width).toBeGreaterThanOrEqual(44);
  expect(griff!.height).toBeGreaterThanOrEqual(44);

  // Beim Sprung in einen anderen Bereich und zurueck bleibt sie zu.
  await seite.getByRole("button", { name: "POIs", exact: true }).click();
  await zeigePlanung(seite);
  await expect(seite.getByTestId("poi-auswahl")).toHaveAttribute(
    "data-zugeklappt",
    "true",
  );

  await seite.getByRole("button", { name: "Auswahl aufklappen" }).click();
  expect(await breiteVon(seite, "poi-auswahl")).toBe(
    POI_AUSWAHL_BREITE_PX.offen,
  );
  expect(await breiteVon(seite, "day-route-map")).toBe(karteOffen);
});
