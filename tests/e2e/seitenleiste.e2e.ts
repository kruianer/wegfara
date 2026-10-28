import type { Page } from "@playwright/test";
import { PLAN_AREAS } from "@/lib/plan/areas";
import { expect, test } from "./fixtures";

/**
 * Die Seitenleiste des Planers im echten Browser (req-094): seit sie immer
 * schmal ist, steht der Name jedes Eintrags klein unter seinem Symbol. Was
 * jsdom nicht kann -- die Breite des gerenderten Textes messen, die Hoehe
 * eines Eintrags, ob etwas ueber den Rand ragt --, steht hier.
 *
 * Gemessen wird beim Gesamt-Admin: nur er sieht am Fuss die "Verwaltung",
 * den laengsten Namen der Leiste.
 */
test.use({ seed: { gesamtAdmin: true } });

/** Die hoechste Breite der Leiste, die req-094 zulaesst. */
const HOECHSTENS_PX = 72;

interface Vermessung {
  breite: number;
  /** Innenabstand links und rechts und der Rand rechts. */
  rand: number;
  /** Das breiteste Wort eines Namens, so wie der Browser es setzt. */
  laengstesWort: { wort: string; breite: number };
  /** Name und Hoehe jedes Eintrags -- Bereiche, Verweise, Reisewahl. */
  eintraege: { name: string; hoehe: number; breite: number }[];
}

/** Breite der Leiste, ihr Rand und ihre Eintraege, gemessen im Browser. */
async function vermiss(seite: Page): Promise<Vermessung> {
  return seite.getByRole("banner").evaluate((leiste) => {
    const stil = getComputedStyle(leiste);
    const rand =
      Number.parseFloat(stil.paddingLeft) +
      Number.parseFloat(stil.paddingRight) +
      Number.parseFloat(stil.borderRightWidth) +
      Number.parseFloat(stil.borderLeftWidth);

    // Jedes Wort jedes sichtbaren Namens in der Schrift, in der es steht.
    const leinwand = document.createElement("canvas").getContext("2d")!;
    let laengstesWort = { wort: "", breite: 0 };
    const eintraege = Array.from(
      leiste.querySelectorAll<HTMLElement>("nav > *, button[title^='Reise:']"),
    );
    for (const eintrag of eintraege) {
      const name = eintrag.lastElementChild as HTMLElement;
      const schrift = getComputedStyle(name);
      leinwand.font = `${schrift.fontWeight} ${schrift.fontSize} ${schrift.fontFamily}`;
      for (const wort of (name.textContent ?? "").split(/\s+/)) {
        const breite = leinwand.measureText(wort).width;
        if (breite > laengstesWort.breite) laengstesWort = { wort, breite };
      }
    }
    return {
      breite: leiste.getBoundingClientRect().width,
      rand,
      laengstesWort,
      eintraege: eintraege.map((eintrag) => {
        const kasten = eintrag.getBoundingClientRect();
        return {
          name:
            eintrag.getAttribute("aria-label") ??
            eintrag.textContent ??
            eintrag.tagName,
          hoehe: kasten.height,
          breite: kasten.width,
        };
      }),
    };
  });
}

test("Seitenleiste bei 1280 px: unter jedem Symbol sein Name, kein Auf- und Zuklappen", async ({
  seite,
}) => {
  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");

  const bereiche = seite.getByRole("navigation", { name: "Bereiche" });
  for (const area of PLAN_AREAS) {
    const eintrag = bereiche.getByRole("button", {
      name: area.label,
      exact: true,
    });
    // Der kurze Name steht sichtbar unter dem Symbol.
    const name = eintrag.getByText(area.kurz, { exact: true });
    await expect(name).toBeVisible();
    const symbol = (await eintrag.locator("svg").boundingBox())!;
    const text = (await name.boundingBox())!;
    expect(text.y, area.label).toBeGreaterThanOrEqual(
      symbol.y + symbol.height - 1,
    );
  }

  await expect(seite.getByRole("button", { name: /klappen/i })).toHaveCount(0);
  await expect(seite.getByText("Wegfara", { exact: true })).toBeVisible();
  await expect(
    seite.getByText("Wohin es euch zieht", { exact: true }),
  ).toBeVisible();
});

test("Seitenleiste: so schmal, wie der längste Name verlangt, und jeder Eintrag mindestens 44 px hoch", async ({
  seite,
}) => {
  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  await expect(seite.getByRole("link", { name: "Verwaltung" })).toBeVisible();

  const { breite, rand, laengstesWort, eintraege } = await vermiss(seite);

  expect(laengstesWort.wort).not.toBe("");
  // Hoechstens so breit wie der laengste Name plus Rand -- aufgerundet auf
  // ganze Pixel, wie die Breite im Stylesheet steht.
  expect(breite).toBeLessThanOrEqual(
    Math.ceil(laengstesWort.breite + rand) + 1,
  );
  expect(breite).toBeLessThanOrEqual(HOECHSTENS_PX);

  // Jeder Eintrag ist ein Tippziel von mindestens 44 x 44 px.
  expect(eintraege.length).toBeGreaterThan(PLAN_AREAS.length);
  for (const eintrag of eintraege) {
    expect(eintrag.hoehe, eintrag.name).toBeGreaterThanOrEqual(44);
    expect(eintrag.breite, eintrag.name).toBeGreaterThanOrEqual(44);
  }
});

test("Seitenleiste: ein gewählter Bereich erscheint, die Breite der Leiste bleibt", async ({
  seite,
}) => {
  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");
  const leiste = seite.getByRole("banner");
  const vorher = (await leiste.boundingBox())!.width;

  for (const name of ["Planung", "Bewertungen", "Kosten", "Chat"]) {
    await seite.getByRole("button", { name, exact: true }).click();
    await expect(
      seite.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect((await leiste.boundingBox())!.width, name).toBe(vorher);
  }

  // Nur die Leiste traegt den kurzen Namen: die Ueberschrift heisst
  // weiterhin "Bewertungen".
  await seite.getByRole("button", { name: "Bewertungen", exact: true }).click();
  await expect(
    seite.getByRole("main").getByRole("heading", { name: "Bewertungen" }),
  ).toBeVisible();
  await expect(leiste.getByText("Stimmen", { exact: true })).toBeVisible();
});

test("Seitenleiste: der Hinweis an der Reise nennt ihren vollen Namen", async ({
  seite,
  kontext,
}) => {
  await seite.setViewportSize({ width: 1280, height: 900 });
  await seite.goto("/plan");

  const reise = seite.getByRole("button", {
    name: `Reise: ${kontext.tripTitle}`,
  });
  await expect(reise).toHaveAttribute("title", `Reise: ${kontext.tripTitle}`);
  await expect(reise).toBeVisible();
});

test("Seitenleiste bei 768 px: nichts ragt über den Rand, nichts lässt sich seitlich scrollen", async ({
  seite,
}) => {
  await seite.setViewportSize({ width: 768, height: 1024 });
  await seite.goto("/plan");

  const leiste = seite.getByRole("banner");
  await expect(leiste).toBeVisible();
  const ueber = await seite.evaluate(() => {
    const breite = window.innerWidth;
    const funde: string[] = [];
    if (document.documentElement.scrollWidth > breite + 1) {
      funde.push(`Seite ist ${document.documentElement.scrollWidth}px breit`);
    }
    // Und in der Leiste steht nichts ueber ihren eigenen Rand.
    const kasten = document.querySelector("header")!.getBoundingClientRect();
    for (const el of Array.from(document.querySelectorAll("header *"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > kasten.right + 1 || r.left < kasten.left - 1) {
        funde.push(
          `${el.tagName.toLowerCase()} "${el.textContent}" reicht von ${Math.round(r.left)} bis ${Math.round(r.right)}px`,
        );
      }
    }
    return funde;
  });
  expect(ueber).toEqual([]);

  const seitlich = await seite.evaluate(() => {
    window.scrollTo(50, window.scrollY);
    const x = window.scrollX;
    window.scrollTo(0, window.scrollY);
    return x;
  });
  expect(seitlich).toBe(0);
});
