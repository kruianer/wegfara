import {
  BAUKASTEN_PATH,
  BAUSTEINE,
  bausteinPfad,
} from "@/lib/design/baukasten";
import { SCREEN_WIDTHS_PX } from "@/lib/design/stil";
import { expect, pruefeZustand, test } from "./fixtures";

async function fehlermeldung(ausfuehren: () => Promise<void>): Promise<string> {
  try {
    await ausfuehren();
  } catch (fehler) {
    return (fehler as Error).message;
  }
  throw new Error("Die Prüfung hätte fehlschlagen müssen, ist aber grün.");
}

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

test.describe("die Bildschirmpruefung als Gesamt-Admin", () => {
  test.use({ seed: { gesamtAdmin: true } });

  /**
   * Ein Baukasten, der die eigenen Regeln bricht, ist keiner: der Katalog und
   * jeder Baustein werden bei allen drei Breiten geprueft -- `seite.goto`
   * wirft, sobald eine der vier Regeln verletzt ist.
   */
  test("Baukasten: Katalog und jeder Baustein sind bei allen drei Breiten grün", async ({
    seite,
  }) => {
    await seite.goto(BAUKASTEN_PATH);
    for (const baustein of BAUSTEINE) {
      await seite.goto(bausteinPfad(baustein));
      await expect(
        seite.locator(`[data-baustein="${baustein.titel}"]`),
      ).toBeVisible();
    }
  });

  /**
   * Ein offener Dialog hat keine eigene Adresse -- `goto` sieht ihn nie. Der
   * Fluss stellt ihn her und ruft die Pruefung danach selbst auf.
   */
  test("Baukasten: ein offener Dialog wird von Hand bei allen drei Breiten geprüft", async ({
    seite,
  }) => {
    await seite.goto(`${BAUKASTEN_PATH}/dialog`);
    await expect(seite.getByRole("dialog")).toHaveCount(0);
    await seite.getByRole("button", { name: "Dialog öffnen" }).click();
    const dialog = seite.getByRole("dialog", { name: "POI löschen?" });
    await expect(dialog).toBeVisible();

    await pruefeZustand(seite, "Baukasten, offener Dialog");

    // Dass wirklich der Dialog geprueft wurde, und zwar bei jeder Breite:
    // ein zu kleiner Knopf darin wird bei allen dreien gemeldet.
    await dialog
      .getByRole("button", { name: "Löschen" })
      .evaluate((knopf: HTMLElement) => {
        knopf.style.minHeight = "0";
        knopf.style.height = "30px";
      });
    const meldung = await fehlermeldung(() =>
      pruefeZustand(seite, "Baukasten, offener Dialog"),
    );
    for (const breite of SCREEN_WIDTHS_PX) {
      expect(meldung).toContain(
        `Baukasten, offener Dialog bei ${breite}px — Tippziele sind mindestens 44×44 px groß: Baustein "Dialog" › button "Löschen"`,
      );
    }
  });

  test("Baukasten: ein Baustein, der eine Regel bricht, nennt Baustein, Breite und Regel", async ({
    seite,
  }) => {
    await seite.goto(`${BAUKASTEN_PATH}/felder`);
    // Ein Feld, das ueber den Rand ragt -- bei 375 und 768 px, nicht bei 1280.
    await seite.getByLabel("Titel der Reise").evaluate((feld: HTMLElement) => {
      feld.style.width = "900px";
    });
    const meldung = await fehlermeldung(() =>
      pruefeZustand(seite, "Baukasten"),
    );
    expect(meldung).toContain('Baustein "Felder"');
    expect(meldung).toContain(
      "Baukasten bei 375px — Nichts steht über den Rand",
    );
    expect(meldung).toContain(
      "Baukasten bei 768px — Nichts steht über den Rand",
    );
    expect(meldung).not.toContain("1280px — Nichts steht über den Rand");
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
