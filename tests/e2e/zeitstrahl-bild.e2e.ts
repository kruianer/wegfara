import type { Page } from "@playwright/test";
import { ZEITSTRAHL_BILD_PX } from "@/lib/design/stil";
import { FOTO_GROESSE_MINIATUR } from "@/lib/pois/foto-url";
import { expect, test } from "./fixtures";
import {
  PRUEF_HOEHE_PX,
  sammleVerstoesse,
  type Verstoss,
} from "@/lib/design/bildschirm-regeln";
import { TIPPZIEL_PX } from "@/lib/design/stil";
import { e2ePool, heute, seedActivity, seedPoi, seedPoiFoto } from "./seed";

/**
 * Das Teaserbild am Programmpunkt des Zeitstrahls (req-111), im echten
 * Browser: was jsdom nicht ausrechnet -- wie breit ein Block wirklich steht,
 * ob das Bild darin Platz hat, dass es die Miniatur laedt und dass kein Block
 * ueber die Spalte ragt (stack.md, Regel 1).
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

/**
 * Die Bildschirmpruefung bei beiden Breiten, als Liste statt als Fehler: der
 * Zeitstrahl mit Programmpunkten hat schon vor req-111 zwei zu kleine
 * Tippziele, das Kreuz zum Entfernen (req-039) und das "+" in der Luecke
 * (req-052). Verglichen wird deshalb mit derselben Planung ohne Fotos -- das
 * Bild darf keinen Verstoss hinzufuegen.
 */
async function verstoesse(seite: Page): Promise<string[]> {
  const gefunden: string[] = [];
  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: PRUEF_HOEHE_PX });
    await seite.evaluate(
      () =>
        new Promise<void>((fertig) =>
          requestAnimationFrame(() => requestAnimationFrame(() => fertig())),
        ),
    );
    const liste: Verstoss[] = await seite.evaluate(
      sammleVerstoesse,
      TIPPZIEL_PX,
    );
    for (const v of liste) {
      // Die Kennungen sind je Programmpunkt andere -- verglichen wird die Art.
      const element = v.element.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        "…",
      );
      gefunden.push(`${breite} ${v.regel} ${element}`);
    }
  }
  return [...new Set(gefunden)].sort();
}

/** Ob jeder Block innerhalb der Spalte des Zeitstrahls liegt. */
async function bloeckeInDerSpalte(seite: Page, ids: string[]) {
  const spalte = await kasten(seite, "planung-spalte-zeitstrahl");
  for (const id of ids) {
    const block = await kasten(seite, `activity-block-${id}`);
    expect(block.x, id).toBeGreaterThanOrEqual(spalte.x - 0.5);
    expect(block.x + block.width, id).toBeLessThanOrEqual(
      spalte.x + spalte.width + 0.5,
    );
  }
}

test("Planung: Teaserbild im Zeitstrahl -- Miniatur, schmale Spuren, breit gezogen, Bildschirmprüfung", async ({
  seite,
  kontext,
}) => {
  const museum = await seedPoi(kontext, "Guggenheim-Museum", "weltkulturerbe");
  await seedPoiFoto(kontext, museum.id);
  const tag = heute();
  // Einer fuer sich, drei gleichzeitig.
  const allein = await seedActivity(
    kontext,
    "Guggenheim am Morgen",
    `${tag}T08:00`,
    `${tag}T09:00`,
    museum.id,
  );
  const drei = [
    await seedActivity(
      kontext,
      "Erste",
      `${tag}T11:00`,
      `${tag}T12:00`,
      museum.id,
    ),
    await seedActivity(
      kontext,
      "Zweite",
      `${tag}T11:00`,
      `${tag}T12:30`,
      museum.id,
    ),
    await seedActivity(
      kontext,
      "Dritte",
      `${tag}T11:30`,
      `${tag}T12:00`,
      museum.id,
    ),
  ];
  const alle = [allein, ...drei].map((activity) => activity.id);

  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await zeigePlanung(seite);

  // Allein im Block: das Bild, in fester Breite, als Miniatur.
  const bild = seite.getByTestId(`activity-bild-${allein.id}`);
  await expect(bild).toBeVisible();
  expect((await bild.boundingBox())?.width).toBeCloseTo(
    ZEITSTRAHL_BILD_PX.breite,
    0,
  );
  expect(await bild.getAttribute("src")).toContain(
    `groesse=${FOTO_GROESSE_MINIATUR}`,
  );

  // Die Datei liegt in der Ablage -- das Bild ist geladen, nicht leer.
  await expect
    .poll(() => bild.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // Drei gleichzeitig in heutiger Spaltenbreite: kein Bild.
  for (const activity of drei) {
    await expect(seite.getByTestId(`activity-bild-${activity.id}`)).toHaveCount(
      0,
    );
  }
  const mitBild = await verstoesse(seite);
  await bloeckeInDerSpalte(seite, alle);

  // Die Spalte breit genug gezogen (req-109): die Bilder erscheinen wieder.
  await seite.setViewportSize({ width: 1920, height: 900 });
  const trenner = seite.getByRole("separator", {
    name: "Breite von Zeitstrahl und Karte anpassen",
  });
  const box = await trenner.boundingBox();
  if (!box) throw new Error("Der Trenner ist nicht zu sehen.");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await seite.mouse.move(x, y);
  await seite.mouse.down();
  await seite.mouse.move(x + 200, y);
  await seite.mouse.move(x + 400, y);
  await seite.mouse.up();
  for (const activity of drei) {
    await expect(
      seite.getByTestId(`activity-bild-${activity.id}`),
    ).toBeVisible();
  }
  await bloeckeInDerSpalte(seite, alle);
  const breitMitBild = await verstoesse(seite);
  await bloeckeInDerSpalte(seite, alle);
  // Keiner betrifft Bild oder Zeichen.
  for (const verstoss of [...mitBild, ...breitMitBild]) {
    expect(verstoss).not.toMatch(/activity-bild|activity-typ-zeichen/);
  }

  // Dieselbe Planung ohne Fotos: dieselben Verstoesse, nicht weniger.
  await e2ePool().query("delete from poi_photo where poi_id = $1", [museum.id]);
  await seite.reload();
  await zeigePlanung(seite);
  await expect(seite.getByTestId(`activity-bild-${allein.id}`)).toHaveCount(0);
  // Die Einteilung der Spalten uebersteht das Neuladen (req-109).
  expect(breitMitBild).toEqual(await verstoesse(seite));
});
