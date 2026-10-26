import { BAUKASTEN_PATH, BAUSTEINE } from "@/lib/design/baukasten";
import { SCREEN_WIDTHS_PX } from "@/lib/design/stil";
import { expect, test } from "./fixtures";

/**
 * Der Baukasten (req-089) im echten Browser: jeder Baustein bei 375, 768
 * und 1280 px zugleich, nur fuer den Gesamt-Admin.
 *
 * Jeder Aufruf von `seite.goto` prueft die geoeffnete Seite bei allen drei
 * Breiten gegen die vier Regeln aus delivery/stack.md (req-049) -- der
 * Katalog wie jede Seite eines Bausteins.
 */

test.describe("als Gesamt-Admin", () => {
  test.use({ seed: { gesamtAdmin: true } });

  test("Baukasten: zeigt jeden Baustein bei allen drei Breiten zugleich", async ({
    seite,
  }) => {
    await seite.goto(BAUKASTEN_PATH);
    await expect(
      seite.getByRole("heading", { name: "Baukasten", level: 1 }),
    ).toBeVisible();

    for (const baustein of BAUSTEINE) {
      const abschnitt = seite.getByTestId(`baustein-${baustein.id}`);
      await expect(
        abschnitt.getByRole("heading", { name: baustein.titel }),
      ).toBeVisible();
      for (const breite of SCREEN_WIDTHS_PX) {
        const rahmen = abschnitt.locator(
          `iframe[title="${baustein.titel} bei ${breite} px"]`,
        );
        await expect(rahmen).toBeVisible();
        // Im Rahmen gilt die volle Breite -- verkleinert wird nur das Bild.
        const fensterbreite = await rahmen
          .contentFrame()
          .locator("body")
          .evaluate(() => window.innerWidth);
        expect(fensterbreite).toBe(breite);
      }
    }

    // Nebeneinander: die drei Rahmen eines Bausteins stehen auf einer Hoehe.
    const oben = await Promise.all(
      SCREEN_WIDTHS_PX.map(async (breite) => {
        const kasten = await seite
          .getByTestId(`rahmen-knoepfe-${breite}`)
          .boundingBox();
        return Math.round(kasten!.y);
      }),
    );
    expect(new Set(oben).size).toBe(1);
  });

  test("Baukasten: Knöpfe auch abgeschaltet, die Seitenleiste ein- und aufgeklappt", async ({
    seite,
  }) => {
    await seite.goto(`${BAUKASTEN_PATH}/knoepfe`);
    const knoepfe = seite.locator('[data-baustein="Knöpfe"]');
    await expect(
      knoepfe.getByRole("button", { name: "Speichern" }).first(),
    ).toBeEnabled();
    await expect(
      knoepfe.getByRole("button", { name: "Speichern" }).nth(1),
    ).toBeDisabled();
    await expect(
      knoepfe.getByRole("button", { name: "Abbrechen" }).nth(1),
    ).toBeDisabled();

    await seite.goto(`${BAUKASTEN_PATH}/seitenleiste-eingeklappt`);
    await expect(
      seite.getByRole("button", { name: "Bereiche aufklappen" }),
    ).toHaveAttribute("aria-expanded", "false");

    await seite.goto(`${BAUKASTEN_PATH}/seitenleiste-aufgeklappt`);
    await expect(
      seite.getByRole("button", { name: "Bereiche einklappen" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});

test("Baukasten: wer nicht Gesamt-Admin ist, sieht ihn nicht", async ({
  seite,
}) => {
  const antwort = await seite.goto(BAUKASTEN_PATH);
  expect(antwort?.status()).toBe(404);
  await expect(seite.getByRole("heading", { name: "Baukasten" })).toHaveCount(
    0,
  );

  const einzeln = await seite.goto(`${BAUKASTEN_PATH}/knoepfe`);
  expect(einzeln?.status()).toBe(404);
  await expect(seite.locator("[data-baustein]")).toHaveCount(0);
});
