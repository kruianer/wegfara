import type { Page } from "@playwright/test";
import { HOUR_HEIGHT_PX } from "@/lib/plan/timeline-grid";
import { expect, test } from "./fixtures";
import { heute, seedActivity, seedPoi } from "./seed";

/**
 * Der Planer auf dem iPad hochkant (req-088), im echten Browser bei 768 px.
 * Was jsdom nicht kann -- messen, ob etwas ueber den Rand steht, und ob der
 * Umriss beim Ziehen wirklich auf der angefassten Box liegt --, steht hier.
 *
 * Jeder Aufruf von `seite.goto` prueft ausserdem die vier Regeln aus
 * delivery/stack.md bei allen drei Breiten (req-049) -- fuer den Bereich, mit
 * dem der Planer oeffnet.
 */

test.use({ viewport: { width: 768, height: 1024 } });

const TAG = heute();

async function zeigeBereich(seite: Page, name: string): Promise<void> {
  await seite.getByRole("button", { name, exact: true }).click();
  await expect(
    seite.getByRole("button", { name, exact: true }),
  ).toHaveAttribute("aria-current", "page");
}

/**
 * Regel 1 aus stack.md: nichts steht ueber den Rand, die Seite laesst sich
 * nicht seitlich scrollen. Liefert die Elemente, die hinausragen.
 */
async function ueberDenRand(seite: Page): Promise<string[]> {
  return seite.evaluate(() => {
    const breite = window.innerWidth;
    const funde: string[] = [];
    if (document.documentElement.scrollWidth > breite + 1) {
      funde.push(`Seite ist ${document.documentElement.scrollWidth}px breit`);
    }
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      const stil = getComputedStyle(el);
      if (stil.display === "none" || stil.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Was ein eigener Rollbereich abschneidet, ragt nicht ueber die Seite --
      // gezaehlt wird nur der sichtbare Teil. Seite und Body zaehlen nicht
      // als Rollbereich: was sie abschneiden, steht ueber den Rand.
      let rechts = r.right;
      let links = r.left;
      for (
        let p = el.parentElement;
        p && p !== document.body && p !== document.documentElement;
        p = p.parentElement
      ) {
        if (getComputedStyle(p).overflowX === "visible") continue;
        const k = p.getBoundingClientRect();
        rechts = Math.min(rechts, k.right);
        links = Math.max(links, k.left);
      }
      if (rechts <= links) continue;
      if (rechts > breite + 1 || links < -1) {
        const id = el.getAttribute("data-testid");
        funde.push(
          `${el.tagName.toLowerCase()}${id ? `[${id}]` : ""} reicht bis ${Math.round(rechts)}px`,
        );
      }
    }
    return funde;
  });
}

test("iPad hochkant: Bewertungen, Kosten, Dokumente und Reisedetails stehen nicht über den Rand", async ({
  seite,
}) => {
  await seite.goto("/plan");

  for (const bereich of [
    "Bewertungen",
    "Kosten",
    "Dokumente",
    "Reisedetails",
  ]) {
    await zeigeBereich(seite, bereich);
    expect(await ueberDenRand(seite), bereich).toEqual([]);
    const seitlich = await seite.evaluate(() => {
      window.scrollTo(50, window.scrollY);
      const x = window.scrollX;
      window.scrollTo(0, window.scrollY);
      return x;
    });
    expect(seitlich, `${bereich} laesst sich seitlich scrollen`).toBe(0);
  }
});

test("iPad hochkant: ein POI aus der Spalte wird auf dem Zeitstrahl eingeplant", async ({
  seite,
  kontext,
}) => {
  const poi = await seedPoi(kontext, `E2E iPad ${kontext.kennung}`);

  await seite.goto("/plan");
  await zeigeBereich(seite, "Planung");

  // Zeitstrahl und daneben die POI-Auswahl -- nicht drei Spalten.
  await expect(seite.getByTestId("timeline-grid")).toBeVisible();
  await expect(
    seite.getByRole("tab", { name: "POI-Auswahl", selected: true }),
  ).toBeVisible();
  await expect(seite.getByTestId("day-route-map")).toHaveCount(0);

  await seite
    .getByTestId(`unplanned-poi-${poi.id}`)
    .dragTo(seite.getByTestId("timeline-grid"), {
      targetPosition: { x: 60, y: 2 * HOUR_HEIGHT_PX },
    });

  const programmpunkte = seite.locator('[data-testid^="activity-block-"]');
  await expect(programmpunkte).toHaveCount(1);
  await expect(programmpunkte).toContainText(poi.name);
  await expect(programmpunkte).toContainText("10:00 – 12:30");

  await seite.reload();
  await zeigeBereich(seite, "Planung");
  await expect(programmpunkte).toHaveCount(1);
  await expect(programmpunkte).toContainText("10:00 – 12:30");
});

test("iPad hochkant: beim Verschieben liegt der Umriss deckungsgleich auf der angefassten Box", async ({
  seite,
  kontext,
}) => {
  const activity = await seedActivity(
    kontext,
    `E2E Verschieben ${kontext.kennung}`,
    `${TAG}T10:00`,
    `${TAG}T12:30`,
  );

  await seite.goto("/plan");
  await zeigeBereich(seite, "Planung");

  const block = seite.getByTestId(`activity-block-${activity.id}`);
  await block.scrollIntoViewIfNeeded();
  const box = (await block.boundingBox())!;

  // Angefasst kurz vor dem unteren Rand -- dort sprang der Umriss bei
  // bug-066 um den Greifabstand nach unten.
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 10;
  await seite.mouse.move(x, y);
  await seite.mouse.down();
  // Der Browser beginnt den Zug erst nach ein paar Pixeln Weg; danach geht
  // der Zeiger zurueck an die Stelle, an der er angefasst hat -- der Umriss
  // muss dann genau auf der Box liegen.
  await seite.mouse.move(x, y + 20, { steps: 5 });
  await seite.mouse.move(x, y, { steps: 5 });

  const umriss = seite.getByTestId("drag-preview");
  await expect(umriss).toBeVisible();
  const vorschau = (await umriss.boundingBox())!;
  expect(Math.abs(vorschau.y - box.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(vorschau.height - box.height)).toBeLessThanOrEqual(1);
  await expect(umriss).toContainText("10:00");

  await seite.mouse.up();
});
