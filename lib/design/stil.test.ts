// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { FARBWELT_KLASSE, FARBWELT_PLANER, stilCss } from "./stil";

/**
 * Die gemeinsame Stil-Datei (req-089). Die Farbwelt ist nur umgezogen, nicht
 * veraendert: hier steht der Satz, den app/plan/plan-view.module.css bis
 * req-089 an `.app` trug -- als Momentaufnahme, gegen die die Stil-Datei
 * geprueft wird.
 */
const PLANER_VOR_REQ_089 = {
  "--page": "#0c0f1e",
  "--card": "#131730",
  "--card-alt": "#171c38",
  "--field": "#1c2242",
  "--bd": "rgba(166, 180, 232, 0.16)",
  "--bd-soft": "rgba(166, 180, 232, 0.1)",
  "--bd-faint": "rgba(166, 180, 232, 0.06)",
  "--track": "#1c2240",
  "--muted-tint": "rgba(166, 180, 232, 0.08)",
  "--text": "#e9ebf7",
  "--text-2": "#b3bad8",
  "--text-3": "#9aa0bc",
  "--text-4": "#8189ac",
  "--card-glass": "rgba(19, 23, 48, 0.84)",
  "--pos": "#8fd6a4",
  "--neg": "#e896a4",
  "--deep": "#090c18",
  "--deep-hover": "#12172e",
  "--head": "#f0ead8",
  "--acc": "#d9c589",
  "--on-acc": "#131022",
  "--acc-text": "#e5d6a5",
  "--acc-tint": "rgba(217, 197, 137, 0.11)",
  "--hi": "#efe3b8",
  "--hint-bg": "rgba(217, 197, 137, 0.08)",
  "--hint-bd": "rgba(217, 197, 137, 0.3)",
  "--hint-fg": "#decfa6",
  "--glow": "rgba(217, 197, 137, 0.2)",
};

/** Die Blaetter, die bis req-089 je eine Kopie der Farbwelt trugen. */
const FRUEHERE_TRAEGER = [
  "app/plan/plan-view.module.css",
  "app/plan/accounts/accounts-view.module.css",
  "app/mein-bereich/mein-bereich.module.css",
  "components/auth-panel.module.css",
  "components/wartungs-hinweis.module.css",
];

/**
 * Die Farbschicht des Begleiters: hell, mit waehlbaren Themes. Sie fuehrt
 * ihr eigenes `--acc` und ist von der Zaehlung ausgenommen (req-089).
 */
const BEGLEITER_FARBSCHICHT = ["app/go/theme.module.css", "lib/theme/"];

function lies(datei: string): string {
  return readFileSync(path.join(process.cwd(), datei), "utf8");
}

function dateienUnter(ordner: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(path.join(process.cwd(), ordner))) {
    const relativ = path.posix.join(ordner, eintrag);
    if (statSync(path.join(process.cwd(), relativ)).isDirectory()) {
      gefunden.push(...dateienUnter(relativ));
    } else if (/\.(css|ts|tsx)$/.test(eintrag) && !/\.test\./.test(eintrag)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/**
 * Wo ein Token definiert wird: als Eigenschaft in einem Stylesheet
 * (`--card: ...`) oder als Schluessel in TypeScript (`"--card": ...`).
 * Ein Aufruf wie `var(--card)` ist keine Definition.
 */
function definitionen(name: string): string[] {
  const css = new RegExp(`(^|[\\s;{])${name}\\s*:`, "m");
  const ts = new RegExp(`["']${name}["']\\s*:`);
  return ["app", "components", "lib"]
    .flatMap(dateienUnter)
    .filter(
      (datei) => !BEGLEITER_FARBSCHICHT.some((teil) => datei.startsWith(teil)),
    )
    .filter((datei) =>
      datei.endsWith(".css") ? css.test(lies(datei)) : ts.test(lies(datei)),
    );
}

describe("Stil-Datei -- die Farbwelt des Planers (req-089)", () => {
  it("fuehrt jedes Farb-Token des Planers mit demselben Wert", () => {
    expect(FARBWELT_PLANER).toEqual(PLANER_VOR_REQ_089);
  });

  it("schreibt die Farbwelt als Stylesheet an ihre Klasse", () => {
    const css = stilCss();
    const regel =
      css.match(new RegExp(`\\.${FARBWELT_KLASSE}\\s*{[^}]*}`))?.[0] ?? "";
    for (const [name, wert] of Object.entries(PLANER_VOR_REQ_089)) {
      expect(regel).toContain(`${name}: ${wert};`);
    }
  });

  it("legt die Farbwelt nicht an :root -- der Begleiter bleibt hell", () => {
    const wurzel = stilCss().match(/:root\s*{[^}]*}/)?.[0] ?? "";
    expect(wurzel).not.toMatch(/--card\s*:/);
    expect(wurzel).not.toMatch(/--acc\s*:/);
  });

  it.each(["--card", "--page", "--deep", "--acc"])(
    "definiert %s in app, components und lib genau einmal",
    (name) => {
      expect(definitionen(name)).toEqual(["lib/design/stil.ts"]);
    },
  );
});

describe("Stil-Datei -- der Planer sieht aus wie vorher (req-089)", () => {
  it.each(FRUEHERE_TRAEGER)(
    "%s holt die Farbwelt an dieselbe Wurzel wie bisher",
    (datei) => {
      const css = lies(datei);
      const wurzel = datei.endsWith("plan-view.module.css") ? ".app" : ".page";
      const regel =
        css.match(new RegExp(`^\\${wurzel}\\s*{[^}]*}`, "m"))?.[0] ?? "";
      expect(regel).toMatch(
        new RegExp(`composes:\\s*${FARBWELT_KLASSE}\\s+from\\s+global\\s*;`),
      );
      // Keine Kopie mehr daneben: die Werte stehen allein in der Stil-Datei.
      for (const name of Object.keys(PLANER_VOR_REQ_089)) {
        expect(regel).not.toMatch(new RegExp(`(^|\\s)${name}\\s*:`));
      }
    },
  );

  it("schreibt das Stylesheet in jede Seite, auch in den Wartungshinweis", () => {
    const layout = lies("app/layout.tsx");
    expect(layout).toMatch(
      /import\s+{\s*StilBlatt\s*}\s+from\s+"@\/components\/stil-blatt"/,
    );
    // Einmal fuer die gewohnte Seite, einmal waehrend einer Wiederherstellung.
    expect(layout.match(/<StilBlatt \/>/g)).toHaveLength(2);
  });
});
