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

test("Bildschirmbreiten: unsichtbare Trefferflächen dürfen einander überlagern", async ({
  page,
}) => {
  // Zwei dicht stehende Ankreuzboxen wie im Statusfilter der Karte (bug-029):
  // gezeichnet werden 18px grosse Kaestchen, getroffen werden 44x44 px, die
  // sich dabei ueberlagern. Sichtbar ueberlappt nichts -- Regel 2 gilt dem
  // Sichtbaren. Die Flaeche waechst nach unten (bug-044), deshalb stehen die
  // Zeilen nur 6px auseinander.
  await page.setContent(spalteMitAnkreuzboxen(2));

  await expect(
    pruefeBildschirmbreiten(page, "Dicht stehende Ankreuzboxen"),
  ).resolves.toBeUndefined();
});

test("Bildschirmbreiten: in einer dichten Spalte gehört jedes Kästchen seinem eigenen Schalter", async ({
  page,
}) => {
  // Der Kern von bug-044: die Trefferflaechen ueberlagern einander, aber
  // keine deckt das Kaestchen einer anderen Zeile ab -- weder oben noch unten
  // an seiner Kante. Sonst schaltete ein Tipp auf ein Kaestchen den Status
  // der Nachbarzeile. Im echten Browser gemessen, weil genau das im CSS
  // steckt und nicht im Markup.
  await page.setContent(spalteMitAnkreuzboxen(5));

  const fremde = await page.evaluate(() => {
    const daneben: string[] = [];
    const kaestchen = Array.from(
      document.querySelectorAll<HTMLElement>("[data-kaestchen]"),
    );
    for (const feld of kaestchen) {
      const eigener = feld.querySelector("input");
      const r = feld.getBoundingClientRect();
      const x = r.left + r.width / 2;
      for (const [stelle, y] of [
        ["Oberkante", r.top + 1],
        ["Mitte", r.top + r.height / 2],
        ["Unterkante", r.bottom - 1],
      ] as const) {
        const oben = document.elementFromPoint(x, y);
        if (oben !== eigener) {
          daneben.push(
            `${feld.dataset.kaestchen}/${stelle}: ${
              oben?.getAttribute("data-testid") ?? oben?.tagName ?? "nichts"
            }`,
          );
        }
      }
    }
    return daneben;
  });

  expect(fremde).toEqual([]);
});

/**
 * Eine Spalte Ankreuzboxen in der Geometrie des Statusfilters der Karte:
 * 18px Kaestchen, 6px Abstand, darueber gelegte 44x44-px-Trefferflaechen, die
 * 5px ueber die Oberkante des Kaestchens hinausragen und den Rest nach unten
 * wachsen (components/tippziel-checkbox.module.css, bug-044).
 */
function spalteMitAnkreuzboxen(zeilen: number): string {
  const reihen = Array.from({ length: zeilen }, (_, i) => {
    const abstand = i === 0 ? 0 : 6;
    return `
      <span data-kaestchen="Zeile ${i + 1}"
            style="position: relative; display: block; width: 18px; height: 18px; margin: ${abstand}px 0 0 60px; background: #ccc;">
        <input type="checkbox" data-testid="schalter-${i + 1}"
               style="position: absolute; top: -5px; left: 50%; width: 44px; height: 44px; margin: 0; opacity: 0; transform: translateX(-50%);" />
      </span>`;
  }).join("");

  // 16px oben, 21px unten: so viel, wie die Flaechen der ersten und der
  // letzten Zeile ueber ihre Kaestchen hinausragen.
  return `
    <html><body style="margin: 0">
      <div style="position: relative; width: 200px; padding: 16px 0 21px;">${reihen}</div>
    </body></html>
  `;
}

test("Bildschirmbreiten: eine unsichtbare Trefferfläche über einem Knopf lässt die Prüfung fehlschlagen", async ({
  page,
}) => {
  // Die Ausnahme von Regel 2 (bug-029) macht unsichtbare Trefferflaechen
  // nicht harmlos: deckt eine die Mitte eines anderen Bedienelements ab, ist
  // dieses nicht mehr zu treffen -- das meldet Regel 3 weiterhin.
  await page.setContent(`
    <html><body>
      <div style="position: relative; width: 300px; height: 100px;">
        <button data-testid="knopf-speichern" style="position: absolute; left: 0; top: 0; width: 100px; height: 44px;">
          Speichern
        </button>
        <input data-testid="flaeche-darueber" style="position: absolute; left: 0; top: 0; width: 100px; height: 44px; opacity: 0;" />
      </div>
    </body></html>
  `);

  const meldung = await fehlermeldung(() =>
    pruefeBildschirmbreiten(page, "Knopf unter einer Trefferfläche"),
  );

  expect(meldung).toContain("Alles Bedienbare ist erreichbar");
  expect(meldung).toContain("knopf-speichern");
  expect(meldung).toContain("flaeche-darueber");
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
