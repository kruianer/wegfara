import type { Page } from "@playwright/test";
import { FARBWELT_KLASSE, FARBWELT_PLANER } from "@/lib/design/stil";
import { expect, test } from "./fixtures";

/**
 * Die gemeinsame Stil-Datei (req-089) im echten Browser: die Farbwelt ist
 * nur umgezogen. Dieselben Werte muessen an derselben Wurzel ankommen wie
 * zuvor, als jedes Blatt sie selbst trug -- sonst sieht der Planer anders
 * aus. jsdom fuehrt kein CSS aus; ob `composes ... from global` und das
 * Stylesheet aus dem Root-Layout zusammenfinden, zeigt erst der Browser.
 */

/** Die Tokens, wie sie an der Wurzel mit der Farbwelt tatsaechlich gelten. */
async function geltendeTokens(seite: Page): Promise<Record<string, string>> {
  return seite.evaluate(
    ({ klasse, namen }) => {
      const wurzel = document.querySelector(`.${klasse}`);
      if (!wurzel) return {};
      const stil = getComputedStyle(wurzel);
      return Object.fromEntries(
        namen.map((name) => [name, stil.getPropertyValue(name).trim()]),
      );
    },
    { klasse: FARBWELT_KLASSE, namen: Object.keys(FARBWELT_PLANER) },
  );
}

/**
 * Oeffnet eine Adresse, ohne dass die Bildschirmpruefung aus fixtures.ts
 * mitlaeuft: "Mein Bereich" verletzt Regel 4 schon lange (Knoepfe 33-35 px
 * hoch) -- Altbestand, der mit der Farbwelt nichts zu tun hat und erst mit
 * der Umstellung seines Bereichs behoben wird (req-089, Out of Scope).
 */
async function oeffneOhnePruefung(seite: Page, adresse: string) {
  await seite.evaluate((ziel) => window.location.assign(ziel), adresse);
  await seite.waitForURL(`**${adresse}`);
}

for (const adresse of ["/plan", "/mein-bereich"]) {
  test(`Stil-Datei: ${adresse} traegt die Farbwelt mit unveraenderten Werten (req-089)`, async ({
    seite,
  }) => {
    await seite.goto("/plan");
    if (adresse !== "/plan") await oeffneOhnePruefung(seite, adresse);
    await expect(seite.locator(`.${FARBWELT_KLASSE}`).first()).toBeVisible();

    expect(await geltendeTokens(seite)).toEqual(FARBWELT_PLANER);

    // Und sie wirken: die Schrift der Wurzel ist --text, nicht die Vorgabe
    // des Browsers.
    await expect(seite.locator(`.${FARBWELT_KLASSE}`).first()).toHaveCSS(
      "color",
      "rgb(233, 235, 247)",
    );
  });
}

test("Stil-Datei: der Begleiter bekommt die Farbwelt des Planers nicht (req-089)", async ({
  seite,
}) => {
  await seite.goto("/go");
  await expect(seite.locator(`.${FARBWELT_KLASSE}`)).toHaveCount(0);
  const card = await seite.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--card"),
  );
  expect(card.trim()).toBe("");
});
