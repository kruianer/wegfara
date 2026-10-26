import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

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
