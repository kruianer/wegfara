import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { heute, seedActivity } from "./seed";

/**
 * Der Zeitstrahl zeigt den ganzen Tag (req-112), im echten Browser.
 *
 * Was jsdom nicht ausrechnet: dass das Raster hoeher ist als die Spalte, dass
 * die Ansicht beim Oeffnen trotzdem beim Programmpunkt steht und nicht
 * mitten in der Nacht, und dass die Nachtstunden durch Rollen erreichbar
 * sind. Genau das ist der Punkt von req-112 -- vorher begann das Raster um
 * 08:00, und was davor lag, liess sich nicht anlegen.
 */

async function zeigePlanung(seite: Page): Promise<void> {
  await seite.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(seite.getByTestId("timeline-grid")).toBeVisible();
}

function rollflaeche(seite: Page) {
  return seite.getByTestId("timeline-scroll");
}

test("Planung: das Raster reicht ueber den ganzen Tag und die Ansicht steht beim Programmpunkt", async ({
  seite,
  kontext,
}) => {
  const tag = heute();
  await seedActivity(
    kontext,
    "Ausgrabungsstaette Pompeji",
    `${tag}T10:00`,
    `${tag}T12:30`,
  );

  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  // Beide Enden des Tages sind im Raster -- auch die Stunden, in denen
  // nichts geplant ist.
  await expect(seite.getByText("03:00")).toBeVisible();
  await expect(seite.getByText("23:00")).toBeVisible();

  // Das Raster ist hoeher als die Spalte: 24 Stunden a 48 px sind 1152 px.
  const raster = await seite.getByTestId("timeline-grid").boundingBox();
  const flaeche = await rollflaeche(seite).boundingBox();
  if (!raster || !flaeche) throw new Error("Raster oder Flaeche fehlt.");
  expect(raster.height).toBeGreaterThan(flaeche.height);

  // Und trotzdem steht die Ansicht nicht bei 00:00, sondern beim
  // Programmpunkt: ohne das Rollen aus req-112 waere scrollTop 0.
  const gerollt = await rollflaeche(seite).evaluate((el) => el.scrollTop);
  expect(gerollt).toBeGreaterThan(0);

  const block = seite.getByTestId(/^activity-block-/).first();
  await expect(block).toBeVisible();
  await expect(block).toContainText("10:00");
});

test("Planung: die Nachtstunden sind durch Hochrollen erreichbar", async ({
  seite,
  kontext,
}) => {
  const tag = heute();
  await seedActivity(kontext, "Dom", `${tag}T10:00`, `${tag}T11:00`);

  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  await rollflaeche(seite).evaluate((el) => {
    el.scrollTop = 0;
  });

  // Oben im Raster steht Mitternacht -- die Flaeche, auf die sich ein
  // Nachtzug ziehen laesst.
  const erste = seite.getByText("00:00").first();
  await expect(erste).toBeInViewport();
});
