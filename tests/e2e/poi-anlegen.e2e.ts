import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expect, test, waehleOrt } from "./fixtures";
import { poiNamenInDatenbank } from "./seed";

/**
 * Fluss 1 (req-047): einen POI von Hand anlegen, speichern, die Seite neu
 * laden -- der POI steht in der Liste.
 *
 * Genau diese Naht war bei bug-020 gerissen: Formular und Schnittstelle
 * waren jede fuer sich geprueft, dass die Oberflaeche aber wirklich in die
 * Datenbank schreibt und von dort wieder liest, niemand.
 */

/**
 * Legt einen POI so an, wie ein Mensch es tut, laedt die Seite neu und
 * erwartet ihn dann in der Liste. Wirft, wenn er nach dem Neuladen fehlt --
 * darauf beruht der Waechter-Test unten.
 */
async function poiAnlegenUndWiederfinden(
  seite: Page,
  name: string,
  wartezeit?: number,
): Promise<void> {
  await seite.goto("/plan");

  await seite.getByRole("button", { name: "POI anlegen" }).click();
  const formular = seite.getByTestId("poi-form-neu");
  await formular.getByLabel("Name", { exact: true }).fill(name);
  // Position und Adresse kommen aus der Ortssuche -- Koordinaten werden nie
  // von Hand eingegeben (req-035).
  await waehleOrt(formular, "Position", "Villa Rufolo");
  await formular.getByRole("button", { name: "Speichern" }).click();
  // Das Formular schliesst sich nur, wenn das Speichern gelungen ist; sonst
  // bleibt es mit dem Hinweis darauf stehen (bug-021).
  await expect(formular).toBeHidden();

  await seite.reload();
  await expect(seite.getByRole("button", { name, exact: true })).toBeVisible({
    timeout: wartezeit,
  });
}

test("POI anlegen: nach dem Neuladen steht er in der Liste", async ({
  seite,
  kontext,
}) => {
  const name = `E2E POI ${kontext.kennung}`;

  await poiAnlegenUndWiederfinden(seite, name);

  expect(await poiNamenInDatenbank(kontext)).toEqual([name]);
});

/**
 * Der Waechter zum Fluss oben (req-047, Akzeptanzkriterium 3): schreibt das
 * Speichern nicht in die Datenbank, muss "POI anlegen" fehlschlagen. Die
 * Antwort der Schnittstelle wird dafuer unterwegs durch eine erfundene
 * Bestaetigung ersetzt -- die Oberflaeche meldet Erfolg, geschrieben wurde
 * nichts. Genau die Lage aus bug-020.
 */
test("POI anlegen schlägt fehl, wenn nichts geschrieben wird", async ({
  seite,
  kontext,
}) => {
  await seite.route("**/api/pois", async (route) => {
    if (route.request().method() !== "POST") return route.continue();

    const angefragt = route.request().postDataJSON() as {
      tripId: string;
      name: string;
      type: string;
      status: string;
      position: { lat: number; lng: number };
    };
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        poi: {
          id: randomUUID(),
          tripId: angefragt.tripId,
          number: 1,
          name: angefragt.name,
          ort: "",
          type: angefragt.type,
          position: angefragt.position,
          status: angefragt.status,
        },
      }),
    });
  });

  let fehlgeschlagen = false;
  try {
    await poiAnlegenUndWiederfinden(
      seite,
      `E2E Blind ${kontext.kennung}`,
      5_000,
    );
  } catch {
    fehlgeschlagen = true;
  }

  expect(fehlgeschlagen).toBe(true);
  expect(await poiNamenInDatenbank(kontext)).toEqual([]);
});
