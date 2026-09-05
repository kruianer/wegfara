import { expect, test, waehleOrt } from "./fixtures";
import { heute, tageSpaeter } from "./seed";

/**
 * Fluss 2 (req-047): eine neue Reise ueber die Reisedetails anlegen,
 * speichern, die Seite neu laden -- die Reise ist geoeffnet.
 *
 * Die gefuehrte Reise aus dem Ausgangszustand liegt bewusst in der
 * Vergangenheit: nach dem Neuladen waehlt der Planer die laufende Reise
 * voraus (siehe lib/trips/select-default.ts) -- und das soll die neu
 * angelegte sein.
 */

const BEGINN = heute();
const ENDE = tageSpaeter(BEGINN, 3);

test.use({
  seed: {
    tripStartDate: tageSpaeter(BEGINN, -30),
    tripEndDate: tageSpaeter(BEGINN, -25),
  },
});

test("Reise anlegen: nach dem Neuladen ist sie geöffnet", async ({
  seite,
  kontext,
}) => {
  const titel = `E2E Neue Reise ${kontext.kennung}`;

  await seite.goto("/plan");
  // Der Weg zum Anlegen liegt im Aufklappmenue am Reisenamen (req-017,
  // req-033).
  await seite.getByRole("button", { name: kontext.tripTitle }).click();
  await seite.getByRole("button", { name: "Neue Reise" }).click();

  const eckdaten = seite.getByRole("region", { name: "Eckdaten der Reise" });
  await eckdaten.getByLabel("Titel", { exact: true }).fill(titel);
  // Der Hauptort entsteht ausschliesslich ueber die Ortssuche (req-017).
  await waehleOrt(eckdaten, "Hauptort", "Florenz");
  await eckdaten.getByLabel("Beginn", { exact: true }).fill(BEGINN);
  await eckdaten.getByLabel("Ende", { exact: true }).fill(ENDE);
  await eckdaten.getByRole("button", { name: "Speichern" }).click();

  // Angelegt und sofort geoeffnet -- der Kopfbereich nennt sie (req-017).
  await expect(seite.getByRole("button", { name: titel })).toBeVisible();

  await seite.reload();
  await expect(seite.getByRole("button", { name: titel })).toBeVisible();
});
