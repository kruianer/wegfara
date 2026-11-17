import type { Page } from "@playwright/test";
import {
  KARTE_MIN_BREITE_PX,
  TIPPZIEL_PX,
  ZEITSTRAHL_MIN_BREITE_PX,
} from "@/lib/design/stil";
import { expect, test } from "./fixtures";
import { pruefeBildschirmbreiten } from "./screen-check";
import { seedPoi } from "./seed";

/**
 * Zwei Trenner in der Planung (req-109), im echten Browser: was jsdom nicht
 * ausrechnet -- wie breit die Spalten wirklich stehen, dass keine ueber den
 * Rand ragt, dass die Einteilung ein Neuladen uebersteht und dass sich der
 * Trenner mit dem Finger treffen laesst.
 */

const BREITEN = [1280, 1920] as const;

async function zeigePlanung(seite: Page): Promise<void> {
  await seite.getByRole("button", { name: "Planung", exact: true }).click();
  await expect(seite.getByTestId("timeline-grid")).toBeVisible();
}

async function kasten(seite: Page, testId: string) {
  const box = await seite.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} ist nicht zu sehen.`);
  return box;
}

function rechterTrenner(seite: Page) {
  return seite.getByRole("separator", {
    name: "Breite von Zeitstrahl und Karte anpassen",
  });
}

function linkerTrenner(seite: Page) {
  return seite.getByRole("separator", {
    name: "Breite von POI-Auswahl und Zeitstrahl anpassen",
  });
}

/** Ein Zug mit der Maus an einem Trenner, um `versatz` px. */
async function ziehe(
  seite: Page,
  trenner: ReturnType<typeof rechterTrenner>,
  versatz: number,
): Promise<void> {
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

/** Ob die Seite sich seitlich rollen liesse -- dann ragte etwas hinaus. */
async function ragtHinaus(seite: Page): Promise<boolean> {
  return seite.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test("Planung: an zwei Trennern einteilen, nach dem Neuladen steht es so", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand");

  await seite.setViewportSize({ width: 1920, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  // Ungezogen wie bisher: 340, 412, Rest.
  expect((await kasten(seite, "planung-spalte-auswahl")).width).toBe(340);
  expect((await kasten(seite, "planung-spalte-zeitstrahl")).width).toBe(
    ZEITSTRAHL_MIN_BREITE_PX,
  );
  const karteVorher = (await kasten(seite, "day-route-map")).width;

  // Rechts nach rechts: der Zeitstrahl gewinnt, was die Karte hergibt.
  await ziehe(seite, rechterTrenner(seite), 200);
  expect((await kasten(seite, "planung-spalte-zeitstrahl")).width).toBe(612);
  expect((await kasten(seite, "day-route-map")).width).toBe(karteVorher - 200);

  // Links nach rechts: die Auswahl gewinnt, was der Zeitstrahl hergibt.
  await ziehe(seite, linkerTrenner(seite), 160);
  expect((await kasten(seite, "planung-spalte-auswahl")).width).toBe(500);
  expect((await kasten(seite, "planung-spalte-zeitstrahl")).width).toBe(452);
  expect((await kasten(seite, "day-route-map")).width).toBe(karteVorher - 200);

  // Ganz nach rechts: die Karte behaelt ihre Mindestbreite, nichts ragt
  // hinaus.
  await ziehe(seite, rechterTrenner(seite), 3000);
  expect((await kasten(seite, "day-route-map")).width).toBe(
    KARTE_MIN_BREITE_PX,
  );
  expect(await ragtHinaus(seite)).toBe(false);
  const zeitstrahl = (await kasten(seite, "planung-spalte-zeitstrahl")).width;

  // Neu geladen steht die Einteilung, wie sie war.
  await seite.reload();
  await zeigePlanung(seite);
  expect((await kasten(seite, "planung-spalte-auswahl")).width).toBe(500);
  expect((await kasten(seite, "planung-spalte-zeitstrahl")).width).toBe(
    zeitstrahl,
  );

  // Schmaler geworden, ragt trotzdem nichts hinaus.
  await seite.setViewportSize({ width: 1280, height: 900 });
  await expect(rechterTrenner(seite)).toBeVisible();
  // Die Spalten ziehen sich erst im naechsten Zeichnen auf die neue Breite
  // zurueck; bis dahin steht der Zeitstrahl noch so breit wie zuvor.
  await expect.poll(() => ragtHinaus(seite)).toBe(false);
  expect((await kasten(seite, "day-route-map")).width).toBeGreaterThanOrEqual(
    KARTE_MIN_BREITE_PX,
  );
});

test("Planung: die Bildschirmprüfung ist mit den Trennern bei 1280 und 1920 px grün", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand");

  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  await pruefeBildschirmbreiten(seite, "Planung mit Trennern", BREITEN);
  await ziehe(seite, rechterTrenner(seite), 100);
  await ziehe(seite, linkerTrenner(seite), 60);
  await pruefeBildschirmbreiten(seite, "Planung, eingeteilt", BREITEN);

  // Das Tippziel der Trenner (stack.md, Regel 4): am Touch-Geraet trifft der
  // Finger den Trenner auch 21 px neben seiner Mitte. Die Pruefung oben
  // kennt keine Trenner; gemessen wird hier, wo der Finger landet.
  const cdp = await seite.context().newCDPSession(seite);
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  await expect
    .poll(() => seite.evaluate(() => matchMedia("(pointer: coarse)").matches))
    .toBe(true);
  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: 900 });
    for (const trenner of [linkerTrenner(seite), rechterTrenner(seite)]) {
      const box = await trenner.boundingBox();
      if (!box) throw new Error("Der Trenner ist nicht zu sehen.");
      const mitte = box.x + box.width / 2;
      const y = box.y + box.height / 3;
      const halb = TIPPZIEL_PX / 2 - 1;
      for (const x of [mitte - halb, mitte + halb]) {
        const getroffen = await seite.evaluate(
          ([px, py]) =>
            document.elementFromPoint(px, py)?.getAttribute("role") ?? null,
          [x, y] as const,
        );
        expect(getroffen, `${breite} px, x=${x}`).toBe("separator");
      }
    }
  }
});

test("Planung: unter 1180 px gibt es keine Trenner (req-088)", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Playa de la Concha", "strand");
  await seite.setViewportSize({ width: 1024, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  await expect(seite.getByTestId("planung-daneben")).toBeVisible();
  await expect(seite.getByRole("separator")).toHaveCount(0);
});
