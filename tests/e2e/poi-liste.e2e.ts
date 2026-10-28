import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { pruefeBildschirmbreiten } from "./screen-check";
import { seedPoi } from "./seed";

/**
 * Die POI-Liste kompakt und dreispaltig (req-097), im echten Browser: die
 * vier Regeln aus stack.md bei 1024, 1280 und 1920 px, die Breite der Spalte
 * und die feste Höhe der Zeilen -- was jsdom nicht ausrechnet.
 *
 * 375 px ist ausgenommen: dort zeigt der Planer seit req-088 den Hinweis,
 * und das Telefon-Layout kommt später. Die drei Breiten aus stack.md prüft
 * `seite.goto` ohnehin.
 */
const BREITEN = [1024, 1280, 1920] as const;

const LANGER_TEXT =
  "Gehrys Titanschiff am Nervión — innen wechselnde Ausstellungen, außen " +
  "Koons' Blumenhund und Bourgeois' Spinne. Morgens kommen, bevor die " +
  "Busse da sind; die Terrasse am Fluss lohnt sich auch ohne Eintritt.";

async function zeilenHoehen(seite: Page): Promise<number[]> {
  return seite
    .locator('[data-testid^="poi-row-"] > div:first-child')
    .evaluateAll((zeilen) =>
      zeilen.map((zeile) => zeile.getBoundingClientRect().height),
    );
}

test("POI-Liste: die Bildschirmprüfung ist bei 1024, 1280 und 1920 px grün", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Guggenheim-Museum", "weltkulturerbe", "gesetzt", {
    ort: "Bilbao",
    gegend: "BIO",
    shortText: LANGER_TEXT,
    web: "https://www.guggenheim-bilbao.eus",
    buchung: "gebucht",
  });
  await seedPoi(
    kontext,
    "Mercado de la Ribera",
    "restaurant",
    "wahrscheinlich",
    {
      ort: "Bilbao",
      shortText: "Markthalle am Fluss, Pintxos an langen Theken.",
      buchung: "offen",
    },
  );
  await seedPoi(kontext, "Playa de la Concha", "strand", "wenn_zeit", {
    gegend: "SSE",
  });

  await seite.goto("/plan");
  await expect(seite.getByTestId(/^poi-row-/)).toHaveCount(3);

  await pruefeBildschirmbreiten(seite, "POI-Liste", BREITEN);

  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: 900 });
    await expect(seite.getByTestId("split-pane-left")).toBeVisible();
    const spalte = await seite.getByTestId("split-pane-left").boundingBox();
    expect(spalte!.width, `Spalte bei ${breite} px`).toBeLessThanOrEqual(380);
    if (breite === 1280) expect(spalte!.width).toBeLessThanOrEqual(330);

    // Mit langem, kurzem und ohne Kurztext: alle Zeilen gleich hoch.
    const hoehen = await zeilenHoehen(seite);
    expect(hoehen, `Zeilenhöhen bei ${breite} px`).toEqual(
      hoehen.map(() => 99),
    );
  }

  // Das Bild ist 104 x 78 px.
  const bild = await seite
    .locator('[data-testid^="poi-bild-"]')
    .first()
    .boundingBox();
  expect(bild).toMatchObject({ width: 104, height: 78 });

  // Der Auswahlmodus ist ein Zustand ohne eigene Adresse.
  await seite.getByRole("button", { name: "Auswählen" }).click();
  await seite.getByLabel("Playa de la Concha auswählen").check();
  await pruefeBildschirmbreiten(seite, "POI-Liste im Auswahlmodus", BREITEN);
  for (const breite of BREITEN) {
    await seite.setViewportSize({ width: breite, height: 900 });
    const hoehen = await zeilenHoehen(seite);
    expect(hoehen, `Zeilenhöhen im Auswahlmodus bei ${breite} px`).toEqual(
      hoehen.map(() => 99),
    );
  }
});

/**
 * Der Kopf der POI-Liste (req-098) in seinen Zuständen ohne eigene Adresse:
 * offenes Filterblatt, gesetzte Filter als Chips, offenes Sortierblatt, die
 * erklärte leere Liste und der Auswahlmodus mit seinen Massenaktionen -- je
 * bei 1024, 1280 und 1920 px. Die Pillen im Blatt sind 26 px hoch gezeichnet
 * und 44 px hoch zu treffen; Regel 2 und 4 prüfen, dass das hält.
 */
test("POI-Liste: Filterblatt, Sortierblatt und Auswahl bestehen die Bildschirmprüfung", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Guggenheim-Museum", "weltkulturerbe", "gesetzt", {
    ort: "Bilbao",
    gegend: "BIO",
  });
  await seedPoi(
    kontext,
    "Mercado de la Ribera",
    "restaurant",
    "wahrscheinlich",
    { ort: "Bilbao", gegend: "BIO" },
  );
  await seedPoi(kontext, "Playa de la Concha", "strand", "wenn_zeit", {
    ort: "San Sebastián",
    gegend: "SSE",
  });
  await seedPoi(kontext, "Bodega Ysios", "aktivitaet", "auf_keinen_fall", {
    ort: "Laguardia",
    gegend: "RIO",
  });

  await seite.goto("/plan");
  await expect(seite.getByTestId(/^poi-row-/)).toHaveCount(4);
  const kopf = seite.getByTestId("poi-filterzeile");

  // Filter offen, mit Mehrfachwahl im Status.
  await kopf.getByRole("button", { name: "Filter" }).click();
  const status = seite.getByRole("group", { name: "Status" });
  await status.getByRole("button", { name: "Fix" }).click();
  await status.getByRole("button", { name: "Alternative" }).click();
  await expect(seite.getByTestId(/^poi-row-/)).toHaveCount(2);
  await pruefeBildschirmbreiten(
    seite,
    "POI-Liste mit offenem Filterblatt",
    BREITEN,
  );

  // Zugeklappt: die gesetzten Filter als Chips, „2 von 4" im Titel.
  await seite
    .getByTestId("poi-filterblatt")
    .getByRole("button", { name: "Fertig" })
    .click();
  await expect(seite.getByTestId("poi-filter-chips")).toBeVisible();
  await expect(seite.getByTestId("poi-zaehler")).toHaveText("2 von 4");
  await pruefeBildschirmbreiten(
    seite,
    "POI-Liste mit gesetzten Filtern",
    BREITEN,
  );

  // Das Sortierblatt.
  await kopf.getByRole("button", { name: "Sortieren" }).click();
  await expect(seite.getByTestId("poi-sortierblatt")).toBeVisible();
  await pruefeBildschirmbreiten(
    seite,
    "POI-Liste mit offenem Sortierblatt",
    BREITEN,
  );
  await seite.getByRole("button", { name: /^Name/ }).click();

  // Kein POI passt: die Meldung nennt den Grund.
  await kopf.getByRole("searchbox").fill("Louvre");
  await expect(seite.getByTestId("poi-leermeldung")).toBeVisible();
  await pruefeBildschirmbreiten(seite, "POI-Liste ohne Treffer", BREITEN);
  await seite.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await expect(seite.getByTestId(/^poi-row-/)).toHaveCount(4);

  // Der Auswahlmodus mit Status…, Gegend…, Entfernen und Fertig.
  await kopf.getByRole("button", { name: "Auswählen" }).click();
  await seite.getByLabel("Guggenheim-Museum auswählen").check();
  await seite.getByLabel("Bodega Ysios auswählen").check();
  await expect(
    kopf.getByRole("button", { name: "Entfernen (2)" }),
  ).toBeVisible();
  await pruefeBildschirmbreiten(seite, "POI-Liste mit Massenaktionen", BREITEN);
});

/**
 * Die Bewertungsrunde startet seit req-098 im Bereich „Bewertungen" -- auch
 * die Auswahl der POIs dort muss die vier Regeln einhalten.
 */
test("Bewertungen: das Starten einer Runde besteht die Bildschirmprüfung", async ({
  seite,
  kontext,
}) => {
  await seedPoi(kontext, "Guggenheim-Museum", "weltkulturerbe", "gesetzt");
  await seedPoi(kontext, "Mercado de la Ribera", "restaurant", "gesetzt");

  await seite.goto("/plan");
  await seite.getByRole("button", { name: "Bewertungen", exact: true }).click();
  await seite.getByRole("button", { name: "Runde starten…" }).click();
  await seite.getByLabel("Guggenheim-Museum in die Runde").check();

  await pruefeBildschirmbreiten(seite, "Bewertungen mit neuer Runde", BREITEN);
});
