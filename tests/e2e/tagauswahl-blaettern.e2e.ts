import type { Page } from "@playwright/test";
import { TIPPZIEL_PX } from "@/lib/design/stil";
import { expect, test } from "./fixtures";
import { pruefeBildschirmbreiten } from "./screen-check";
import { heute, seedPoi, tageSpaeter } from "./seed";

/**
 * Blaettern in der Tagauswahl (req-110), im echten Browser: was jsdom nicht
 * ausrechnet -- ob die Reiter wirklich ueber die Spalte hinausragen, wie weit
 * ein Klick rollt, dass die Knoepfe beim Ziehen am Trenner (req-109)
 * verschwinden und dass sie die Bildschirmpruefung bestehen.
 *
 * Eine dreiwoechige Reise: 21 Tage passen nicht in die 412 px des
 * Zeitstrahls, wohl aber in eine breit gezogene Spalte. Heute ist ihr
 * fuenfzehnter Tag -- vorgewaehlt, und beim Aufgehen weit rechts draussen.
 */

const REISETAGE = 21;
const ERSTER_TAG = tageSpaeter(heute(), -14);
const LETZTER_TAG = tageSpaeter(ERSTER_TAG, REISETAGE - 1);

test.use({
  seed: { tripStartDate: ERSTER_TAG, tripEndDate: LETZTER_TAG },
});

async function zeigePlanung(seite: Page): Promise<void> {
  await seite.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(seite.getByTestId("timeline-grid")).toBeVisible();
}

function zurueck(seite: Page) {
  return seite.getByRole("button", { name: "Frühere Tage zeigen" });
}

function vor(seite: Page) {
  return seite.getByRole("button", { name: "Spätere Tage zeigen" });
}

function leiste(seite: Page) {
  return seite.getByRole("tablist", { name: "Reisetag wählen" });
}

/** Bildlauf der Leiste und wie weit er hoechstens reicht. */
async function bildlauf(seite: Page) {
  return leiste(seite).evaluate((element) => ({
    links: element.scrollLeft,
    groesster: element.scrollWidth - element.clientWidth,
    schritt:
      (element.children[1] as HTMLElement).offsetLeft -
      (element.children[0] as HTMLElement).offsetLeft,
  }));
}

/** Ob ein Reiter ganz innerhalb der sichtbaren Leiste steht. */
async function ganzZuSehen(seite: Page, datum: string): Promise<boolean> {
  const rahmen = await leiste(seite).boundingBox();
  const reiter = await seite.getByTestId(`day-tab-${datum}`).boundingBox();
  if (!rahmen || !reiter) return false;
  return (
    reiter.x >= rahmen.x - 0.5 &&
    reiter.x + reiter.width <= rahmen.x + rahmen.width + 0.5
  );
}

/** Ein Zug mit der Maus am Trenner zwischen Zeitstrahl und Karte. */
async function zieheRechtenTrenner(seite: Page, versatz: number) {
  const trenner = seite.getByRole("separator", {
    name: "Breite von Zeitstrahl und Karte anpassen",
  });
  const box = await trenner.boundingBox();
  if (!box) throw new Error("Der Trenner ist nicht zu sehen.");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await seite.mouse.move(x, y);
  await seite.mouse.down();
  await seite.mouse.move(x + versatz / 2, y);
  await seite.mouse.move(x + versatz, y);
  await seite.mouse.up();
}

test("Tagauswahl: blättern, Reiter für Reiter, bis der letzte Tag rechts steht", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand");
  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  // Der gewaehlte Tag ist der heutige, der fuenfzehnte der Reise: beim
  // Aufgehen ins Bild gerollt.
  await expect(seite.getByRole("tab", { selected: true })).toHaveAttribute(
    "data-testid",
    `day-tab-${heute()}`,
  );
  await expect.poll(() => ganzZuSehen(seite, heute())).toBe(true);
  expect((await bildlauf(seite)).links).toBeGreaterThan(0);

  // Ganz nach links: der linke Knopf ist blass, der rechte nicht.
  for (let i = 0; i < REISETAGE; i++) {
    if (await zurueck(seite).isDisabled()) break;
    await zurueck(seite).click();
  }
  const anfangs = await bildlauf(seite);
  expect(anfangs.links).toBe(0);
  expect(anfangs.groesster).toBeGreaterThan(0);
  await expect(zurueck(seite)).toBeDisabled();
  await expect(vor(seite)).toBeEnabled();

  // Ein Klick, ein Reiter.
  await vor(seite).click();
  expect((await bildlauf(seite)).links).toBe(anfangs.schritt);
  await expect(zurueck(seite)).toBeEnabled();
  await vor(seite).click();
  expect((await bildlauf(seite)).links).toBe(2 * anfangs.schritt);
  await zurueck(seite).click();
  expect((await bildlauf(seite)).links).toBe(anfangs.schritt);

  // So oft nach vorn, wie es Tage gibt: der letzte steht ganz rechts. Ein
  // abgeschalteter Knopf nimmt keinen Klick an -- dann ist das Ende erreicht.
  for (let i = 0; i < REISETAGE; i++) {
    if (await vor(seite).isDisabled()) break;
    await vor(seite).click();
  }
  expect((await bildlauf(seite)).links).toBe(anfangs.groesster);
  await expect(vor(seite)).toBeDisabled();
  await expect(zurueck(seite)).toBeEnabled();
  expect(await ganzZuSehen(seite, LETZTER_TAG)).toBe(true);

  // Ein Tag am Rand gewaehlt -- hier einer, der links halb draussen steht --
  // ist danach ganz zu sehen. Ausgeloest ohne Playwrights eigenes Rollen.
  await leiste(seite).evaluate((element) => {
    element.scrollLeft = (element.children[3] as HTMLElement).offsetLeft + 20;
  });
  const amRand = tageSpaeter(ERSTER_TAG, 3);
  expect(await ganzZuSehen(seite, amRand)).toBe(false);
  await seite.getByTestId(`day-tab-${amRand}`).dispatchEvent("click");
  await expect(seite.getByTestId(`day-tab-${amRand}`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect.poll(() => ganzZuSehen(seite, amRand)).toBe(true);
});

test("Tagauswahl: breit genug gezogen, verschwinden die Knöpfe (req-109)", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand");
  await seite.setViewportSize({ width: 1920, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  await expect(vor(seite)).toBeVisible();
  await expect(zurueck(seite)).toBeVisible();

  await zieheRechtenTrenner(seite, 3000);
  await expect(vor(seite)).toHaveCount(0);
  await expect(zurueck(seite)).toHaveCount(0);
  expect((await bildlauf(seite)).groesster).toBeLessThanOrEqual(0);
  for (let i = 0; i < REISETAGE; i++) {
    expect(await ganzZuSehen(seite, tageSpaeter(ERSTER_TAG, i))).toBe(true);
  }

  // Wieder schmal gezogen, sind sie wieder da.
  await zieheRechtenTrenner(seite, -3000);
  await expect(vor(seite)).toBeVisible();
  await expect(zurueck(seite)).toBeVisible();
});

test("Tagauswahl: die Bildschirmprüfung ist mit Blätterknöpfen grün, jeder Knopf 44 × 44 px", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand");
  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);
  await vor(seite).click();

  const BREITEN = [375, 768, 1280, 1920] as const;
  await pruefeBildschirmbreiten(seite, "Planung mit Blätterknöpfen", BREITEN);

  // Unterhalb der Breite des Planers steht der Hinweis statt der Planung;
  // wo die Knoepfe stehen, messen sie das volle Tippziel.
  let gemessen = 0;
  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: 900 });
    // Ab der Breite des Planers stehen sie da -- erst darauf warten, die
    // Leiste misst ihren Platz nach dem Umbau neu.
    if (breite >= 1280) await expect(vor(seite)).toBeVisible();
    const kaesten = await seite.evaluate(() =>
      Array.from(
        document.querySelectorAll('[data-testid^="blaettern-"]'),
        (knopf) => {
          const { width, height } = knopf.getBoundingClientRect();
          return { width, height };
        },
      ),
    );
    for (const { width, height } of kaesten) {
      expect(width, `${breite} px`).toBeGreaterThanOrEqual(TIPPZIEL_PX);
      expect(height, `${breite} px`).toBeGreaterThanOrEqual(TIPPZIEL_PX);
      gemessen++;
    }
  }
  expect(gemessen).toBeGreaterThanOrEqual(4);
});
