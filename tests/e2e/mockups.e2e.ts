import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { MOCKUP_ORDNER, MOCKUPS } from "@/lib/design/mockups";
import { BILDSCHIRMBREITEN_PX } from "@/lib/design/stil";

/**
 * Die Seiten-Mockups (req-091) im echten Browser. Sie sind reines HTML und
 * brauchen weder Server noch Datenbank: geoeffnet wird die Datei selbst
 * (file://), so wie ein Mensch sie im Browser oeffnet.
 *
 * Jedes Mockup prueft sich beim Oeffnen selbst -- in drei Rahmen bei 375, 768
 * und 1280 px, gegen die vier Regeln aus delivery/stack.md (dieselben wie
 * tests/e2e/screen-check.ts, lib/design/bildschirm-regeln.ts). Diese Fluesse
 * lesen das Ergebnis, das das Mockup anzeigt.
 */

const WURZEL = path.resolve(__dirname, "..", "..");

function adresse(relativ: string, hash = ""): string {
  return `${pathToFileURL(path.join(WURZEL, relativ)).href}${hash}`;
}

/** Wartet auf die Layout-Pruefung im Mockup und gibt ihre Anzeige zurueck. */
async function pruefung(seite: Page) {
  const anzeige = seite.locator('[data-pruefung][data-stand="fertig"]');
  await expect(anzeige).toBeVisible();
  return anzeige;
}

for (const mockup of MOCKUPS) {
  test(`Mockup ${mockup.datei}: bei 375, 768 und 1280 px ohne Verstoss`, async ({
    page,
  }) => {
    await page.goto(adresse(`${MOCKUP_ORDNER}/${mockup.datei}`));
    const anzeige = await pruefung(page);
    await expect(anzeige).toContainText("Layout-Prüfung");
    await expect(anzeige).toContainText("OK — geprüft bei 375, 768, 1280 px");
    await expect(anzeige).toHaveAttribute("data-ergebnis", "ok");
  });

  for (const zustand of mockup.zustaende ?? []) {
    test(`Mockup ${mockup.datei}: Zustand "${zustand}" aus dem Hash wird mitgeprüft`, async ({
      page,
    }) => {
      await page.goto(
        adresse(`${MOCKUP_ORDNER}/${mockup.datei}`, `#zustand=${zustand}`),
      );
      await expect(
        page.locator(`[data-zustand="${zustand}"]`).first(),
      ).toBeVisible();
      const anzeige = await pruefung(page);
      await expect(anzeige).toHaveAttribute("data-ergebnis", "ok");

      // Auch die Pruefrahmen haben den Zustand hergestellt.
      for (const rahmen of await page
        .locator("iframe[title^='Prüfung bei']")
        .all()) {
        await expect(
          rahmen.contentFrame().locator(`[data-zustand="${zustand}"]`).first(),
        ).not.toHaveAttribute("hidden");
      }
    });
  }
}

test("Mockups des Planers: bei 375 px der Hinweis auf den Begleiter, nicht der Planer", async ({
  page,
}) => {
  await page.setViewportSize({
    width: BILDSCHIRMBREITEN_PX.telefon,
    height: 900,
  });
  for (const mockup of MOCKUPS.filter((m) => m.welt === "planer")) {
    await page.goto(adresse(`${MOCKUP_ORDNER}/${mockup.datei}`));
    await expect(page.locator(".schmalHinweis")).toBeVisible();
    await expect(page.locator(".schmalHinweis")).toContainText("Begleiter");
    await expect(page.locator(".planer")).toBeHidden();
  }

  await page.setViewportSize({
    width: BILDSCHIRMBREITEN_PX.tablet,
    height: 900,
  });
  for (const mockup of MOCKUPS.filter((m) => m.welt === "planer")) {
    await page.goto(adresse(`${MOCKUP_ORDNER}/${mockup.datei}`));
    await expect(page.locator(".planer")).toBeVisible();
    await expect(page.locator(".schmalHinweis")).toBeHidden();
  }
});

/** Relative Helligkeit des Seitengrunds, 0 (schwarz) bis 1 (weiss). */
async function helligkeitDesGrunds(seite: Page): Promise<number> {
  return seite.evaluate(() => {
    const [r, g, b] = getComputedStyle(document.body)
      .backgroundColor.match(/\d+/g)!
      .map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}

test("Mockups: der Begleiter hell, der Planer dunkel", async ({ page }) => {
  for (const mockup of MOCKUPS) {
    await page.goto(adresse(`${MOCKUP_ORDNER}/${mockup.datei}`));
    const hell = await helligkeitDesGrunds(page);
    if (mockup.welt === "begleiter")
      expect(hell, mockup.datei).toBeGreaterThan(0.8);
    else expect(hell, mockup.datei).toBeLessThan(0.2);
  }
});

/**
 * Die Gegenprobe: eine absichtlich kaputte Vorlage (kein Mockup). Ohne
 * Zustand ist sie fehlerfrei; erst der offene Dialog traegt einen zu kleinen
 * Knopf. Die Pruefung muss ihn finden -- mit Regel und Breite.
 */
test("Mockup-Prüfung: nennt Verstöße mit Regel und Breite, auch im Zustand aus dem Hash", async ({
  page,
}) => {
  const vorlage = "tests/e2e/mockup-vorlagen/verstoss-im-dialog.html";

  await page.goto(adresse(vorlage));
  await expect(await pruefung(page)).toHaveAttribute("data-ergebnis", "ok");

  await page.goto(adresse(vorlage, "#zustand=offen"));
  const anzeige = await pruefung(page);
  await expect(anzeige).toHaveAttribute("data-ergebnis", "verstoss");
  await expect(anzeige).toContainText("3 Verstöße");
  for (const breite of [375, 768, 1280]) {
    await expect(anzeige).toContainText(
      `Tippziele sind mindestens 44×44 px groß — bei ${breite} px`,
    );
  }

  // Ein Verweis auf den Zustand prueft neu, ohne die Seite neu zu laden.
  await page.goto(adresse(vorlage));
  await expect(await pruefung(page)).toHaveAttribute("data-ergebnis", "ok");
  await page.getByRole("link", { name: "Dialog öffnen" }).click();
  await expect(
    page.locator(
      '[data-pruefung][data-ergebnis="verstoss"][data-stand="fertig"]',
    ),
  ).toBeVisible();
});
