import type { Route } from "@playwright/test";
import { expect, test } from "./fixtures";
import { heute, seedActivity } from "./seed";

/**
 * Fluss 6 (req-047): den Begleiter zu einer laufenden Reise oeffnen, in einer
 * Options-Gruppe eine Alternative waehlen, die Seite neu laden -- die Wahl
 * steht noch. Sie gilt fuer die ganze Gruppe und wird serverseitig gespeichert
 * (siehe app/api/activity-option-selection/route.ts), ist also genau die Naht,
 * die diese Ebene prueft: die Oberflaeche schreibt in die Datenbank und liest
 * wieder daraus.
 *
 * Zugleich ist es der erste Fluss, der `/go` ueberhaupt oeffnet -- damit greift
 * dort die Bildschirmbreiten-Pruefung aus req-049 (siehe fixtures.ts), die bis
 * bug-057 nur Anmeldeseite und Planer erreichte.
 */

const TAG = heute();

test("Begleiter: nach dem Neuladen steht die gewählte Option noch", async ({
  seite,
  kontext,
}) => {
  await seedActivity(
    kontext,
    `E2E Vormittag ${kontext.kennung}`,
    `${TAG}T10:00`,
    `${TAG}T12:30`,
  );
  // Gleicher Beginn, gleiches Ende: daraus wird eine Options-Gruppe.
  await seedActivity(
    kontext,
    `E2E Option A ${kontext.kennung}`,
    `${TAG}T14:00`,
    `${TAG}T16:00`,
  );
  await seedActivity(
    kontext,
    `E2E Option B ${kontext.kennung}`,
    `${TAG}T14:00`,
    `${TAG}T16:00`,
  );

  await seite.goto("/go");

  const tagesplan = seite.getByRole("list", { name: "Tagesplan" });
  await expect(tagesplan).toContainText(`E2E Vormittag ${kontext.kennung}`);
  await expect(tagesplan).toContainText(`E2E Option A ${kontext.kennung}`);

  // Vorgewaehlt ist die erste Alternative (siehe timeline.tsx).
  const ersteOption = seite.getByRole("button", { name: "Option 1 von 2" });
  const zweiteOption = seite.getByRole("button", { name: "Option 2 von 2" });
  await expect(ersteOption).toHaveAttribute("aria-pressed", "true");

  await zweiteOption.click();
  await expect(zweiteOption).toHaveAttribute("aria-pressed", "true");
  await expect(ersteOption).toHaveAttribute("aria-pressed", "false");

  await seite.reload();

  await expect(
    seite.getByRole("button", { name: "Option 2 von 2" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    seite.getByRole("button", { name: "Option 1 von 2" }),
  ).toHaveAttribute("aria-pressed", "false");
});

/**
 * Derselbe Fluss, nur dass das Neuladen dem Speichern zuvorkommt (bug-072):
 * der Schreibvorgang wird festgehalten, bis die Seite neu geladen ist, und
 * kommt nie an. Auf dem Runner am Beelink geschah das von selbst -- dort ist
 * der Server langsamer als der Test, und der Fluss oben scheiterte ab und an.
 *
 * Die Wahl lebt dann nur im Echo des Geraets (bug-060). Der Browser bricht
 * den Schreibvorgang beim Neuladen ab, und dieses Scheitern loeschte das Echo
 * noch in der alten Seite -- die neue fand weder beim Server noch im Echo
 * etwas und zeigte die erste Alternative.
 */
test("Begleiter: die gewählte Option steht auch, wenn das Neuladen dem Speichern zuvorkommt", async ({
  seite,
  kontext,
}) => {
  await seedActivity(
    kontext,
    `E2E Option A ${kontext.kennung}`,
    `${TAG}T14:00`,
    `${TAG}T16:00`,
  );
  await seedActivity(
    kontext,
    `E2E Option B ${kontext.kennung}`,
    `${TAG}T14:00`,
    `${TAG}T16:00`,
  );

  // Der erste Schreibvorgang bleibt haengen; alle spaeteren gehen durch.
  let festgehalten = false;
  await seite.route("**/api/activity-option-selection", (route) => {
    if (festgehalten) return route.continue();
    festgehalten = true;
  });

  await seite.goto("/go");

  const zweiteOption = seite.getByRole("button", { name: "Option 2 von 2" });
  await zweiteOption.click();
  await expect(zweiteOption).toHaveAttribute("aria-pressed", "true");
  expect(festgehalten).toBe(true);

  await seite.reload();

  await expect(
    seite.getByRole("button", { name: "Option 2 von 2" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    seite.getByRole("button", { name: "Option 1 von 2" }),
  ).toHaveAttribute("aria-pressed", "false");

  // Das Echo holt den Schreibvorgang nach: auch ein zweites Neuladen, nun
  // ohne Echo, findet die Wahl beim Server.
  await expect
    .poll(() =>
      seite.evaluate(() =>
        window.localStorage.getItem("wegfara.go.option-selection-echo"),
      ),
    )
    .toBe("{}");
  await seite.reload();
  await expect(
    seite.getByRole("button", { name: "Option 2 von 2" }),
  ).toHaveAttribute("aria-pressed", "true");
});

/**
 * Derselbe Fluss, nur dass der Server die neue Seite liest, bevor er die Wahl
 * speichert -- und die Bestaetigung trotzdem noch die alte Seite erreicht
 * (bug-073). Beim Neuladen lebt die alte Seite weiter, bis die neue da ist.
 * Auf dem Runner am Beelink geschah das bei jedem Lauf des ersten Flusses:
 * Die Bestaetigung loeschte das Echo, und die neue Seite fand die Wahl weder
 * im Echo noch im Stand des Servers, den sie mitbrachte.
 *
 * Nachgestellt wird die Reihenfolge von Hand: der Schreibvorgang wartet, bis
 * der Server die neue Seite gelesen hat; die neue Seite wartet, bis die alte
 * die Bestaetigung hat.
 */
test("Begleiter: die gewählte Option steht auch, wenn der Server die neue Seite vor dem Speichern liest", async ({
  seite,
  kontext,
}) => {
  await seedActivity(
    kontext,
    `E2E Option A ${kontext.kennung}`,
    `${TAG}T14:00`,
    `${TAG}T16:00`,
  );
  await seedActivity(
    kontext,
    `E2E Option B ${kontext.kennung}`,
    `${TAG}T14:00`,
    `${TAG}T16:00`,
  );

  let speichern: Route | null = null;
  await seite.route("**/api/activity-option-selection", (route) => {
    if (speichern) return route.continue();
    speichern = route;
  });

  await seite.goto("/go");

  const zweiteOption = seite.getByRole("button", { name: "Option 2 von 2" });
  await zweiteOption.click();
  await expect(zweiteOption).toHaveAttribute("aria-pressed", "true");
  expect(speichern).not.toBeNull();

  await seite.route("**/go", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const neueSeite = await route.fetch();
    const bestaetigt = seite.waitForResponse(
      "**/api/activity-option-selection",
    );
    await speichern!.continue();
    await bestaetigt;
    await route.fulfill({ response: neueSeite });
  });

  await seite.reload();

  await expect(
    seite.getByRole("button", { name: "Option 2 von 2" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    seite.getByRole("button", { name: "Option 1 von 2" }),
  ).toHaveAttribute("aria-pressed", "false");

  // Gespeichert war die Wahl ja: Ein zweites Neuladen findet sie beim Server.
  await seite.unroute("**/go");
  await seite.reload();
  await expect(
    seite.getByRole("button", { name: "Option 2 von 2" }),
  ).toHaveAttribute("aria-pressed", "true");
});
