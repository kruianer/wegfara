import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { pruefeBildschirmbreiten } from "./screen-check";
import { seedPoi } from "./seed";

/**
 * Die POI-Liste kompakt und dreispaltig (req-097), im echten Browser: die
 * vier Regeln aus stack.md bei 1024, 1280 und 1920 px, die Breite der Spalte
 * und die feste Höhe der Zeilen -- was jsdom nicht ausrechnet.
 *
 * 375 px ist ausgenommen: dort zeigt der Planer seit req-088 den Hinweis,
 * und das Telefon-Layout kommt später. Die drei Breiten aus stack.md prüft
 * `seite.goto` ohnehin.
 */
const BREITEN = [1024, 1280, 1920] as const;

const LANGER_TEXT =
  "Gehrys Titanschiff am Nervión — innen wechselnde Ausstellungen, außen " +
  "Koons' Blumenhund und Bourgeois' Spinne. Morgens kommen, bevor die " +
  "Busse da sind; die Terrasse am Fluss lohnt sich auch ohne Eintritt.";

async function zeilenHoehen(seite: Page): Promise<number[]> {
  return seite
    .locator('[data-testid^="poi-row-"] > div:first-child')
    .evaluateAll((zeilen) =>
      zeilen.map((zeile) => zeile.getBoundingClientRect().height),
    );
}

test("POI-Liste: die Bildschirmprüfung ist bei 1024, 1280 und 1920 px grün", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Guggenheim-Museum", "weltkulturerbe", "gesetzt", {
    ort: "Bilbao",
    gegend: "Bilbao",
    shortText: LANGER_TEXT,
    web: "https://www.guggenheim-bilbao.eus",
    buchung: "gebucht",
  });
  await seedPoi(
    kontext,
    "Mercado de la Ribera",
    "restaurant",
    "wahrscheinlich",
    {
      ort: "Bilbao",
      shortText: "Markthalle am Fluss, Pintxos an langen Theken.",
      buchung: "offen",
    },
  );
  await seedPoi(kontext, "Playa de la Concha", "strand", "wenn_zeit", {
    gegend: "San Sebastián",
  });

  await seite.goto("/plan");
  await expect(seite.getByTestId(/^poi-row-/)).toHaveCount(3);

  await pruefeBildschirmbreiten(seite, "POI-Liste", BREITEN);

  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: 900 });
    await expect(seite.getByTestId("split-pane-left")).toBeVisible();
    const spalte = await seite.getByTestId("split-pane-left").boundingBox();
    expect(spalte!.width, `Spalte bei ${breite} px`).toBeLessThanOrEqual(380);
    if (breite === 1280) expect(spalte!.width).toBeLessThanOrEqual(330);

    // Mit langem, kurzem und ohne Kurztext: alle Zeilen gleich hoch.
    const hoehen = await zeilenHoehen(seite);
    expect(hoehen, `Zeilenhöhen bei ${breite} px`).toEqual(
      hoehen.map(() => 99),
    );
  }

  // Das Bild ist 104 x 78 px.
  const bild = await seite
    .locator('[data-testid^="poi-bild-"]')
    .first()
    .boundingBox();
  expect(bild).toMatchObject({ width: 104, height: 78 });

  // Der Auswahlmodus ist ein Zustand ohne eigene Adresse.
  await seite.getByRole("button", { name: "Auswählen" }).click();
  await seite.getByLabel("Playa de la Concha auswählen").check();
  await pruefeBildschirmbreiten(seite, "POI-Liste im Auswahlmodus", BREITEN);
  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: 900 });
    const hoehen = await zeilenHoehen(seite);
    expect(hoehen, `Zeilenhöhen im Auswahlmodus bei ${breite} px`).toEqual(
      hoehen.map(() => 99),
    );
  }
});
