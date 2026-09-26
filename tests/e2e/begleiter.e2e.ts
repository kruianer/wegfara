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
