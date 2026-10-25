import { expect, test } from "./fixtures";
import { seedPerson } from "./seed";
import { pruefeBildschirmbreiten } from "./screen-check";

/**
 * "Wer faehrt mit" im Begleiter (req-087). Wie jede Seite, die ein Fluss
 * oeffnet, wird sie dabei gegen die vier Regeln aus delivery/stack.md
 * geprueft, bei 375, 768 und 1280 px (siehe fixtures.ts) -- in jsdom laesst
 * sich nicht messen, ob etwas ueber den Rand ragt.
 */

test("Wer fährt mit: vier Personen stehen bei jeder Breite vollständig da", async ({
  seite,
  kontext,
}) => {
  await seedPerson(kontext, `Anna ${kontext.kennung}`, "teilnehmer");
  await seedPerson(kontext, `Clara ${kontext.kennung}`, "teilnehmer");
  await seedPerson(kontext, `David ${kontext.kennung}`, "teilnehmer");

  await seite.setViewportSize({ width: 375, height: 812 });
  await seite.goto(`/go/mitreisende?reise=${kontext.tripId}`);

  const personen = seite.getByTestId("mitreisender");
  await expect(personen).toHaveCount(4);
  for (const person of await personen.all()) {
    await expect(
      person.getByRole("button", { name: /^Einladen/ }),
    ).toBeInViewport();
    await expect(person.getByRole("combobox")).toBeVisible();
  }
  await expect(
    personen.filter({ hasText: `Anna ${kontext.kennung}` }),
  ).toContainText("Kein Zugang");

  const seitlich = await seite.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(seitlich).toBe(false);
});

test("Wer fährt mit: QR-Code und Link der Einladung stehen vollständig auf dem Bildschirm", async ({
  seite,
  kontext,
}) => {
  const anna = `Anna ${kontext.kennung}`;
  await seedPerson(kontext, anna, "teilnehmer");

  await seite.setViewportSize({ width: 375, height: 812 });
  await seite.goto(`/go/mitreisende?reise=${kontext.tripId}`);

  await seite.getByRole("button", { name: `Einladen: ${anna}` }).click();

  const flaeche = seite.getByTestId("invitation-panel");
  const qr = flaeche.getByRole("img", {
    name: `QR-Code der Einladung für ${anna}`,
  });
  const link = flaeche.getByTestId("invitation-link");
  await expect(link).toContainText("/einladung");

  // Vollstaendig: ins Bild gerollt, ragt keiner der beiden ueber einen Rand.
  for (const teil of [qr, link]) {
    await teil.scrollIntoViewIfNeeded();
    await expect(teil).toBeInViewport({ ratio: 1 });
  }

  // Die geoeffnete Einladung haelt die vier Regeln ebenso ein.
  await pruefeBildschirmbreiten(seite, "Wer fährt mit, Einladung offen");
});
