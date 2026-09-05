import {
  test as basis,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import {
  schliesseE2ePool,
  seedKontext,
  type E2eKontext,
  type SeedOptionen,
} from "./seed";

/**
 * Der gemeinsame Rahmen der E2E-Fluesse (req-047).
 *
 * Zwei Dinge nimmt er jedem Test ab:
 *
 * - Der Browser kommt nicht nach draussen. Alles ausser der Anwendung selbst
 *   wird abgewiesen -- Kartenkacheln ebenso wie alles andere. Serverseitig
 *   sorgt tests/e2e/offline-fetch.cjs fuer dasselbe; zusammen gilt: waehrend
 *   dieser Tests geht keine Anfrage an einen fremden Dienst hinaus.
 * - Die Sitzung steht schon. Wie man sich anmeldet, prueft ein eigener Fluss
 *   (anmelden.e2e.ts); die uebrigen beginnen bei einer angemeldeten Person,
 *   so wie ein Mensch sie im Alltag vorfindet.
 */

const LOKALE_HOSTS = new Set(["localhost", "127.0.0.1"]);

export interface E2eFixtures {
  /** Wie der Ausgangszustand aussehen soll -- je Test ueberschreibbar. */
  seed: SeedOptionen;
  /** Account, Person, Sitzung und gefuehrte Reise dieses Tests. */
  kontext: E2eKontext;
  /** Die Seite mit gesetzter Sitzung und gesperrtem Weg nach draussen. */
  seite: Page;
}

interface E2eWorkerFixtures {
  /** Schliesst die Verbindung zur Wegwerf-Datenbank am Ende des Laufs. */
  datenbankVerbindung: void;
}

export const test = basis.extend<E2eFixtures, E2eWorkerFixtures>({
  datenbankVerbindung: [
    async ({}, benutze) => {
      await benutze();
      await schliesseE2ePool();
    },
    { scope: "worker", auto: true },
  ],

  seed: [{}, { option: true }],

  kontext: async ({ seed }, benutze) => {
    await benutze(await seedKontext(seed));
  },

  seite: async ({ page, context, baseURL, kontext }, benutze) => {
    await context.route("**/*", (route) => {
      const ziel = new URL(route.request().url());
      if (LOKALE_HOSTS.has(ziel.hostname)) return route.continue();
      return route.abort();
    });
    await context.addCookies([
      { name: SESSION_COOKIE, value: kontext.sessionToken, url: baseURL! },
    ]);
    await benutze(page);
  },
});

export { expect };

/**
 * Waehlt einen Ort ueber die Ortssuche. Der Hauptort einer Reise und die
 * Position eines POI entstehen ausschliesslich so -- Koordinaten werden nie
 * von Hand eingegeben (req-017, req-035). Was Nominatim dabei antwortet,
 * steht in tests/e2e/offline-fetch.cjs.
 */
export async function waehleOrt(
  bereich: Locator,
  feldName: string,
  suchbegriff: string,
): Promise<void> {
  await bereich.getByLabel(feldName, { exact: true }).fill(suchbegriff);
  await bereich
    .getByRole("list", { name: "Ortsvorschläge" })
    .getByRole("button", { name: suchbegriff })
    .click();
}
