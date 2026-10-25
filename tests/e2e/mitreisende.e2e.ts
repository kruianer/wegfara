import { expect, test } from "./fixtures";
import { seedPerson } from "./seed";

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
