import { test, expect } from "@playwright/test";
import { pruefeBildschirmbreiten } from "./screen-check";

/**
 * Fluss 5 (req-049): die Pruefung selbst gegen die vier Regeln aus
 * delivery/stack.md, mit von Hand gebauten Seiten statt der Anwendung --
 * so laesst sich jede Regel gezielt und unabhaengig ausloesen.
 *
 * Diese Tests brauchen weder Datenbank noch Anwendungsserver: `page` kommt
 * direkt von Playwright, nicht ueber `seite` aus fixtures.ts (die schon
 * automatisch prueft, siehe dort).
 */

async function fehlermeldung(ausfuehren: () => Promise<void>): Promise<string> {
  try {
    await ausfuehren();
  } catch (fehler) {
    return (fehler as Error).message;
  }
  throw new Error("Die Prüfung hätte fehlschlagen müssen, ist aber grün.");
}

test("Bildschirmbreiten: eine ordentliche Seite ist bei allen drei Breiten grün", async ({
  page,
}) => {
  await page.setContent(`
    <html><body>
      <main style="max-width: 320px; margin: 0 auto; padding: 16px;">
        <label for="titel">Titel</label>
        <input id="titel" data-testid="feld-titel" style="width: 100%; height: 44px;" />
        <button data-testid="knopf-speichern" style="width: 100px; height: 44px;">
          Speichern
        </button>
      </main>
    </body></html>
  `);

  await expect(
    pruefeBildschirmbreiten(page, "Ordentliche Testseite"),
  ).resolves.toBeUndefined();
});

test("Bildschirmbreiten: ein Feld, das über den Rand ragt, lässt die Prüfung fehlschlagen", async ({
  page,
}) => {
  await page.setContent(`
    <html><body>
      <input data-testid="feld-breit" style="width: 500px; height: 44px;" />
    </body></html>
  `);

  const meldung = await fehlermeldung(() =>
    pruefeBildschirmbreiten(page, "Formular mit breitem Feld"),
  );

  expect(meldung).toContain("Formular mit breitem Feld");
  expect(meldung).toContain("375px");
  expect(meldung).toContain("Nichts steht über den Rand");
});

test("Bildschirmbreiten: zwei überlappende Felder lassen die Prüfung bei 768 px fehlschlagen", async ({
  page,
}) => {
  await page.setContent(`
    <html><body>
      <div style="position: relative; width: 700px; height: 100px;">
        <input data-testid="feld-a" style="position: absolute; left: 0; top: 0; width: 200px; height: 44px;" />
        <input data-testid="feld-b" style="position: absolute; left: 100px; top: 0; width: 200px; height: 44px;" />
      </div>
    </body></html>
  `);

  const meldung = await fehlermeldung(() =>
    pruefeBildschirmbreiten(page, "Formular mit überlappenden Feldern"),
  );

  expect(meldung).toContain("768px");
  expect(meldung).toContain("Nichts überlappt");
  expect(meldung).toContain("feld-a");
  expect(meldung).toContain("feld-b");
});

test("Bildschirmbreiten: ein nicht erreichbarer Speichern-Knopf lässt die Prüfung fehlschlagen", async ({
  page,
}) => {
  await page.setContent(`
    <html><body>
      <div style="overflow: hidden; width: 200px; height: 60px;">
        <button data-testid="knopf-speichern" style="margin-left: 400px; width: 100px; height: 44px;">
          Speichern
        </button>
      </div>
    </body></html>
  `);

  const meldung = await fehlermeldung(() =>
    pruefeBildschirmbreiten(page, "Formular mit verstecktem Speichern-Knopf"),
  );

  expect(meldung).toContain("375px");
  expect(meldung).toContain("Alles Bedienbare ist erreichbar");
  expect(meldung).toContain("knopf-speichern");
});

test("Bildschirmbreiten: ein zu kleiner Knopf lässt die Prüfung fehlschlagen", async ({
  page,
}) => {
  await page.setContent(`
    <html><body>
      <button data-testid="knopf-klein" style="width: 30px; height: 30px;">X</button>
    </body></html>
  `);

  const meldung = await fehlermeldung(() =>
    pruefeBildschirmbreiten(page, "Seite mit zu kleinem Knopf"),
  );

  expect(meldung).toContain("375px");
  expect(meldung).toContain("Tippziele sind mindestens 44×44 px groß");
  expect(meldung).toContain("knopf-klein");
  expect(meldung).toContain("30×30px");
});

test("Bildschirmbreiten: ein bewusster Hinweis statt Inhalt wird geprüft, nicht übersprungen", async ({
  page,
}) => {
  // So wie der Planer auf schmalen Bildschirmen nur den Hinweis auf einen
  // breiteren Bildschirm zeigt (siehe app/plan/components/narrow-notice.tsx)
  // -- der Hinweis selbst muss die vier Regeln trotzdem einhalten.
  await page.setContent(`
    <html><body>
      <div data-testid="schmal-hinweis">
        <p>Bildschirm zu schmal</p>
        <a href="/go" data-testid="link-begleiter" style="display: inline-block; width: 20px; height: 20px;">Begleiter</a>
      </div>
    </body></html>
  `);

  const meldung = await fehlermeldung(() =>
    pruefeBildschirmbreiten(page, "Schmal-Hinweis"),
  );

  // Waere der Hinweis uebersprungen worden, faende die Pruefung den zu
  // kleinen Link darin nie.
  expect(meldung).toContain("link-begleiter");
  expect(meldung).toContain("Tippziele sind mindestens 44×44 px groß");
});
