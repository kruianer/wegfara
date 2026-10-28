import type { Page } from "@playwright/test";
import { POI_AUSWAHL_BREITE_PX } from "@/lib/design/stil";
import { SPALTEN_NEBENEINANDER_AB_PX } from "@/lib/plan/spalten";
import { expect, test } from "./fixtures";

/** iPad quer und groesser (req-099, wie req-097 und req-098). */
const BREITEN = [1024, 1280, 1920] as const;
import { pruefeBildschirmbreiten } from "./screen-check";
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

test("POI-Auswahl: die Bildschirmprüfung ist bei 1024, 1280 und 1920 px grün -- offen und zugeklappt", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand", "gesetzt", {
    ort: "San Sebastián",
    gegend: "SSE",
    buchung: "offen",
  });
  await seedPoi(
    kontext,
    "La Cuchara de San Telmo mit einem sehr langen Namen, der umbrechen muss",
    "restaurant",
    "wahrscheinlich",
    { ort: "San Sebastián", gegend: "SSE", buchung: "gebucht" },
  );
  await seedPoi(kontext, "Guggenheim-Museum", "weltkulturerbe", "gesetzt", {
    ort: "Bilbao",
    gegend: "BIO",
  });

  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);
  await expect(seite.locator('li[data-testid^="unplanned-poi-"]')).toHaveCount(
    3,
  );

  await pruefeBildschirmbreiten(seite, "POI-Auswahl offen", BREITEN);

  // Ein Blatt lebt in der Spalte: wechselt die Breite unter 1180 px, ordnet
  // sich die Planung neu (req-088), und das Blatt ist zu. Jede Breite wird
  // deshalb fuer sich in den Zustand gebracht und geprueft.
  async function jeBreite(
    zustand: string,
    herstellen: () => Promise<void>,
  ): Promise<void> {
    for (const breite of BREITEN) {
      await seite.setViewportSize({ width: breite, height: 900 });
      // Erst wenn die Ordnung zur Breite passt, steht die Spalte fest.
      await expect(seite.getByTestId("planung-daneben")).toHaveCount(
        breite < SPALTEN_NEBENEINANDER_AB_PX ? 1 : 0,
      );
      await herstellen();
      await pruefeBildschirmbreiten(seite, zustand, [breite]);
    }
    await seite.setViewportSize({ width: 1280, height: 900 });
  }

  const auswahl = seite.getByTestId("poi-auswahl");
  const blatt = seite.getByTestId("poi-filterblatt");
  async function filterblattOeffnen() {
    if (await blatt.isVisible()) return;
    await auswahl.getByRole("button", { name: "Filter", exact: true }).click();
    await expect(blatt).toBeVisible();
  }

  // Mit offenem Filterblatt und zwei gesetzten Filtern.
  await filterblattOeffnen();
  await blatt
    .getByRole("group", { name: "Verplanung" })
    .getByRole("button", { name: "Noch unverplant" })
    .click();
  await blatt
    .getByRole("group", { name: "Gegend" })
    .getByRole("button", { name: "SSE" })
    .click();
  await expect(seite.locator('li[data-testid^="unplanned-poi-"]')).toHaveCount(
    2,
  );
  await jeBreite("POI-Auswahl mit Filterblatt", filterblattOeffnen);

  // Zugeklappt stehen die Filter als Chips unter dem Titel.
  await jeBreite("POI-Auswahl mit Chips", async () => {
    if (await blatt.isVisible()) {
      await blatt.getByRole("button", { name: "Fertig" }).click();
    }
    await expect(seite.getByTestId("poi-filter-chips")).toBeVisible();
  });

  await jeBreite("POI-Auswahl mit Sortierblatt", async () => {
    if (!(await seite.getByTestId("poi-sortierblatt").isVisible())) {
      await auswahl.getByRole("button", { name: "Sortieren" }).click();
    }
    await expect(seite.getByTestId("poi-sortierblatt")).toBeVisible();
  });

  // Zugeklappt -- bei 1024 px steht die Auswahl in der schmalen Ordnung
  // allein neben dem Zeitstrahl (req-088) und laesst sich dort nicht
  // zuklappen; die Pruefung sieht dort die offene.
  await seite.getByRole("button", { name: "Auswahl zuklappen" }).click();
  await expect(auswahl).toHaveAttribute("data-zugeklappt", "true");
  await pruefeBildschirmbreiten(seite, "POI-Auswahl zugeklappt", BREITEN);
});

test("POI-Auswahl: ein gezogener POI mit Geistbox wird eingeplant wie bisher", async ({
  seite,
  kontext,
}) => {
  const poi = await seedPoi(kontext, `E2E Geist ${kontext.kennung}`);

  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  await seite
    .getByTestId(`unplanned-poi-${poi.id}`)
    .dragTo(seite.getByTestId("timeline-grid"), {
      targetPosition: { x: 60, y: 120 },
    });

  await expect(seite.locator('[data-testid^="activity-block-"]')).toHaveCount(
    1,
  );
  // Die Geistbox ist nach dem Zugbeginn wieder fort.
  await expect(seite.getByTestId(`unplanned-poi-geist-${poi.id}`)).toHaveCount(
    0,
  );
  await expect(seite.getByTestId(`unplanned-poi-count-${poi.id}`)).toHaveText(
    "1",
  );
});
