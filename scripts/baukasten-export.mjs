// Schreibt den Baukasten fuer die Seiten-Mockups (req-091) nach
// delivery/design/baukasten/: `npm run baukasten`.
//
// Die Mockups sind reines HTML -- kein React, kein Server, keine CSS-Module.
// Sie brauchen die Bausteine deshalb als gewoehnliches Stylesheet und die
// Layout-Pruefung als gewoehnliches Skript. Beides entsteht hier aus den
// Quellen der App, damit es keine zweite Fassung gibt, die unbemerkt
// veraltet (vgl. req-082):
//
//   baukasten.css  aus app/globals.css, lib/design/stil.ts (Tokens), der
//                  Farbschicht des Begleiters (lib/theme/themes.ts, das
//                  vorgewaehlte Thema) und den CSS-Modulen des Katalogs
//                  (app/plan/baukasten/*.module.css) -- mit denselben
//                  Klassennamen, ohne den Hash der CSS-Module.
//   pruef.js       aus lib/design/bildschirm-regeln.ts (die vier Regeln aus
//                  stack.md, dieselben wie in tests/e2e/screen-check.ts) und
//                  lib/design/mockup-pruefung.ts.
//
// Wer einen Baustein aendert oder ergaenzt, aendert ihn im Katalog und ruft
// danach dieses Skript auf. Ob beide Dateien aktuell sind, prueft
// lib/design/baukasten-export.test.ts.

import { readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRUEF_HOEHE_PX } from "../lib/design/bildschirm-regeln.ts";
import {
  FARBWELT_KLASSE,
  SCREEN_WIDTHS_PX,
  TIPPZIEL_PX,
  stilCss,
} from "../lib/design/stil.ts";
import { DEFAULT_THEME_ID, THEMES } from "../lib/theme/themes.ts";

export const WURZEL = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Wohin der Baukasten geschrieben wird -- neben die Mockups. */
export const BAUKASTEN_ORDNER = path.join(
  WURZEL,
  "delivery",
  "design",
  "baukasten",
);

/** Die Klassen, an denen die Farbwelten haengen. */
export const FARBWELT_BEGLEITER_KLASSE = "farbwelt-begleiter";

/** Die CSS-Module des Katalogs, in dieser Reihenfolge ins Stylesheet. */
export const BAUSTEIN_MODULE = [
  "app/plan/baukasten/bausteine.module.css",
  "app/plan/baukasten/begleiter-bausteine.module.css",
];

const KOPF = (quellen) =>
  [
    "/* ERZEUGT von scripts/baukasten-export.mjs (`npm run baukasten`) --",
    "   nicht von Hand aendern. Ein Baustein wird im Katalog ergaenzt",
    "   (app/plan/baukasten/), nicht hier und nicht im Mockup (req-091).",
    "",
    "   Quellen:",
    ...quellen.map((q) => `     ${q}`),
    "*/",
  ].join("\n");

function lies(relativ) {
  return readFileSync(path.join(WURZEL, relativ), "utf8");
}

/**
 * Loest `composes: <klasse> from global;` auf: die Zeile entfaellt, und die
 * Klasse, in der sie stand, kommt zum Selektor der globalen Klasse dazu. So
 * traegt `.seite` im Mockup die Farbwelt, wie sie es in der App tut.
 */
export function loeseComposes(css) {
  const traeger = new Map();
  const regel = /^(\.[A-Za-z][\w-]*)\s*\{([^}]*)\}/gm;
  const ohne = css.replace(regel, (ganz, selektor, rumpf) => {
    let neu = rumpf;
    for (const treffer of rumpf.matchAll(
      /^[ \t]*composes:[ \t]*([\w-]+)[ \t]+from[ \t]+global;[ \t]*\n([ \t]*\n)?/gm,
    )) {
      const liste = traeger.get(treffer[1]) ?? [];
      liste.push(selektor);
      traeger.set(treffer[1], liste);
      neu = neu.replace(treffer[0], "");
    }
    return `${selektor} {${neu}}`;
  });
  if (/composes:/.test(ohne)) {
    throw new Error(
      "baukasten-export: nur `composes: … from global;` laesst sich ins Mockup-Stylesheet uebertragen.",
    );
  }
  return { css: ohne, traeger };
}

function block(selektoren, werte) {
  const zeilen = Object.entries(werte).map(([n, w]) => `  ${n}: ${w};`);
  return `${selektoren.join(",\n")} {\n${zeilen.join("\n")}\n}`;
}

/** Das Stylesheet, das jedes Mockup einbindet -- und sonst nichts. */
export function baukastenCss() {
  const bausteinModule = BAUSTEIN_MODULE.map((datei) => ({
    datei,
    ...loeseComposes(lies(datei)),
  }));
  const traegerVon = (klasse) =>
    bausteinModule.flatMap((m) => m.traeger.get(klasse) ?? []);

  const thema = THEMES.find((t) => t.id === DEFAULT_THEME_ID);
  if (!thema)
    throw new Error(`baukasten-export: Thema ${DEFAULT_THEME_ID} fehlt`);

  // Die Tokens wie im Root-Layout; die Farbwelt des Planers zusaetzlich an den
  // Klassen, die sie per composes holen.
  const tokens = stilCss().replace(
    `.${FARBWELT_KLASSE} {`,
    `${[`.${FARBWELT_KLASSE}`, ...traegerVon(FARBWELT_KLASSE)].join(",\n")} {`,
  );

  return [
    KOPF([
      "app/globals.css",
      "lib/design/stil.ts",
      `lib/theme/themes.ts (Thema "${thema.id}")`,
      ...BAUSTEIN_MODULE,
    ]),
    "/* --- app/globals.css --- */",
    lies("app/globals.css").trim(),
    "/* --- Schriften ---\n   In der App setzt next/font diese beiden Variablen; ausserhalb gibt es\n   sie nicht. Fehlt die Schrift, greift der Ersatz in jeder Regel. */",
    block([":root"], {
      "--font-body": '"Albert Sans"',
      "--font-heading": '"Space Grotesk"',
    }),
    "/* --- lib/design/stil.ts --- */",
    tokens,
    `/* --- Farbschicht des Begleiters: lib/theme/themes.ts, Thema "${thema.id}" --- */`,
    block(
      [
        `.${FARBWELT_BEGLEITER_KLASSE}`,
        ...traegerVon(FARBWELT_BEGLEITER_KLASSE),
      ],
      thema.vars,
    ),
    ...bausteinModule.map((m) => `/* --- ${m.datei} --- */\n${m.css.trim()}`),
  ]
    .join("\n\n")
    .concat("\n");
}

/** TypeScript ohne Typen, ohne Importe und ohne `export` -- als Skriptteil. */
function alsSkriptteil(relativ) {
  return stripTypeScriptTypes(lies(relativ))
    .replace(/^import\s[\s\S]*?;\n/gm, "")
    .replace(/^export /gm, "")
    .trim();
}

/** Die Layout-Pruefung, die jedes Mockup einbindet. */
export function pruefSkript() {
  const einstellungen = {
    breiten: [...SCREEN_WIDTHS_PX],
    hoehe: PRUEF_HOEHE_PX,
    tippziel: TIPPZIEL_PX,
  };
  return [
    "// ERZEUGT von scripts/baukasten-export.mjs (`npm run baukasten`) --",
    "// nicht von Hand aendern. Quellen: lib/design/bildschirm-regeln.ts,",
    "// lib/design/mockup-pruefung.ts, lib/design/stil.ts.",
    "(function () {",
    '"use strict";',
    alsSkriptteil("lib/design/bildschirm-regeln.ts"),
    alsSkriptteil("lib/design/mockup-pruefung.ts"),
    `starteMockupPruefung(${JSON.stringify(einstellungen)});`,
    "})();",
    "",
  ].join("\n");
}

export const DATEIEN = {
  "baukasten.css": baukastenCss,
  "pruef.js": pruefSkript,
};

function schreibe() {
  for (const [name, erzeuge] of Object.entries(DATEIEN)) {
    const ziel = path.join(BAUKASTEN_ORDNER, name);
    writeFileSync(ziel, erzeuge());
    console.log(`[baukasten] ${path.relative(WURZEL, ziel)}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  schreibe();
}
