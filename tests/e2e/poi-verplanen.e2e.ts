import type { Page } from "@playwright/test";
import { HOUR_HEIGHT_PX } from "@/lib/plan/timeline-grid";
import { expect, test } from "./fixtures";
import { seedPoi } from "./seed";

/**
 * Fluss 3 (req-047): einen POI aus "Noch unverplant" auf den Zeitstrahl
 * ziehen, die Seite neu laden -- der Programmpunkt liegt an seiner Stelle.
 *
 * Das Raster beginnt ohne Programmpunkte um 08:00 (siehe
 * lib/plan/timeline-grid.ts). Zwei Stundenhoehen darunter losgelassen ergibt
 * 10:00; eine Sehenswuerdigkeit dauert geschaetzt 2,5 Stunden (siehe
 * lib/pois/estimated-duration.ts) und endet damit um 12:30.
 */

const ABLAGE_OFFSET_PX = 2 * HOUR_HEIGHT_PX;
const ERWARTETE_ZEIT = "10:00 – 12:30";

function programmpunkte(seite: Page) {
  return seite.locator('[data-testid^="activity-block-"]');
}

async function zeigePlanung(seite: Page): Promise<void> {
  await seite.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(seite.getByTestId("timeline-grid")).toBeVisible();
}

test("POI verplanen: nach dem Neuladen liegt der Programmpunkt an seiner Stelle", async ({
  seite,
  kontext,
}) => {
  const poi = await seedPoi(kontext, `E2E Ziel ${kontext.kennung}`);

  await seite.goto("/plan");
  await zeigePlanung(seite);

  await seite
    .getByTestId(`unplanned-poi-${poi.id}`)
    .dragTo(seite.getByTestId("timeline-grid"), {
      targetPosition: { x: 60, y: ABLAGE_OFFSET_PX },
    });

  await expect(programmpunkte(seite)).toHaveCount(1);
  await expect(programmpunkte(seite)).toContainText(poi.name);
  await expect(programmpunkte(seite)).toContainText(ERWARTETE_ZEIT);

  await seite.reload();
  await zeigePlanung(seite);

  await expect(programmpunkte(seite)).toHaveCount(1);
  await expect(programmpunkte(seite)).toContainText(poi.name);
  await expect(programmpunkte(seite)).toContainText(ERWARTETE_ZEIT);
  // Verplant ist verplant: der POI steht danach nicht mehr in "Noch
  // unverplant" (req-039).
  await expect(seite.getByTestId(`unplanned-poi-${poi.id}`)).toHaveCount(0);
});
