import type { Page } from "@playwright/test";
import { expect, pruefeBereich, test } from "./fixtures";

/**
 * Die Karte "KI-Modelle" (req-108) im echten Browser: die Kataloge kommen ueber
 * den Server vom Dienst (hier aus tests/e2e/offline-fetch.cjs), die Wahl geht
 * in die Datenbank und steht nach dem Neuladen wieder da.
 */

const KARTE = 'section[aria-label="KI-Modelle"]';

/**
 * "Mein Bereich" nicht per goto: die Pruefung aus fixtures.ts liefe dann ueber
 * die ganze Seite, deren uebrige Karten Regel 4 schon lange verletzen
 * (siehe stil.e2e.ts). Geprueft wird hier die neue Karte -- mit pruefeBereich.
 */
async function oeffneMeinBereich(seite: Page) {
  await seite.goto("/plan");
  await seite.evaluate(() => window.location.assign("/mein-bereich"));
  await seite.waitForURL("**/mein-bereich");
}

async function setzeSchluessel(
  seite: Page,
  name: "KI-Suche" | "Chat im Planer",
  wert: string,
) {
  const karte = seite.getByRole("region", { name: "Zugangsschlüssel" });
  const zeile = karte.getByRole("listitem").filter({ hasText: name });
  await zeile.getByRole("button", { name: "Setzen" }).click();
  await karte.getByLabel(`Zugangsschlüssel für ${name}`).fill(wert);
  await karte.getByRole("button", { name: "Speichern" }).click();
  await expect(zeile).toContainText(`Gesetzt (…${wert.slice(-4)})`);
}

test("KI-Modelle: ohne Schluessel nennt die Karte den fehlenden (req-108)", async ({
  seite,
}) => {
  await oeffneMeinBereich(seite);
  const karte = seite.locator(KARTE);

  await expect(
    karte.getByText(/Für „KI-Suche“ ist kein Zugangsschlüssel hinterlegt/),
  ).toHaveCount(2);
  await expect(karte.getByRole("combobox")).toHaveCount(0);

  await pruefeBereich(
    seite,
    KARTE,
    "Mein Bereich, Karte KI-Modelle ohne Schlüssel",
  );
});

test("KI-Modelle: drei Felder mit den Modellen des Dienstes, die Wahl bleibt (req-108)", async ({
  seite,
}) => {
  await oeffneMeinBereich(seite);
  await setzeSchluessel(seite, "KI-Suche", "sk-e2e-test-a3f9");
  await setzeSchluessel(seite, "Chat im Planer", "sk-ant-e2e-b7c1");

  const karte = seite.locator(KARTE);
  await expect(karte.getByRole("combobox")).toHaveCount(3);

  const bilder = karte.getByRole("combobox", { name: "Bilder" });
  const optionen = bilder.locator("option");
  await expect(optionen).toContainText([
    "Nichts gewählt — es gilt gpt-image-2.5-flare",
    "gpt-4.1-mini — wird am 12.03.2099 abgeschaltet",
    "gpt-5.6-luna",
    "gpt-image-2.5-flare",
  ]);
  // Abgeschaltet am 23.10.2026 (bug-076) -- nicht in der Auswahl.
  await expect(bilder.locator('option[value="gpt-image-1"]')).toHaveCount(0);
  // Anthropic: nur die aktiven.
  await expect(
    karte.getByRole("combobox", { name: "Chat im Planer" }).locator("option"),
  ).toHaveText([
    "Nichts gewählt — es gilt claude-sonnet-5-5",
    "Claude Opus 5.5",
    "Claude Sonnet 5.5",
  ]);

  await pruefeBereich(seite, KARTE, "Mein Bereich, Karte KI-Modelle");

  await bilder.selectOption("gpt-image-2.5-flare");
  await karte.getByRole("button", { name: "Bilder: Wahl speichern" }).click();
  await expect(
    karte.getByRole("button", { name: "Bilder: Wahl speichern" }),
  ).toBeDisabled();

  await seite.reload();
  await expect(
    seite.locator(KARTE).getByRole("combobox", { name: "Bilder" }),
  ).toHaveValue("gpt-image-2.5-flare");
});
