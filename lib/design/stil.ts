/**
 * Die gemeinsame Stil-Datei (req-089): die Design-Tokens der Anwendung an
 * genau einer Stelle. Bis dahin brachte jede Seite ausserhalb des Planers
 * ihre Farbwelt selbst mit -- `--card` stand fuenfmal, `--page` fuenfmal,
 * `--deep` dreimal, jedes Mal gleichlautend und jedes Mal einzeln zu pflegen.
 *
 * Sie ist eine TypeScript-Datei und kein Stylesheet, weil CSS und Tests
 * dieselben Werte brauchen: das Root-Layout schreibt sie als Stylesheet in
 * jede Seite (components/stil-blatt.tsx, `stilCss()`), die Tests lesen sie
 * als Zahlen. So entsteht keine zweite Liste, die unbemerkt veraltet
 * (vgl. req-082).
 *
 * In den CSS-Modulen bleibt alles beim Alten: `var(--card)` greift danach
 * auf diese Datei zu. Wer die Farbwelt braucht, holt sie mit
 * `composes: farbwelt-planer from global;` an seine Wurzel.
 */

/**
 * Die Farbwelt "Indigo-Nacht" des Planers (delivery/design/planer,
 * Abschnitt "Design Tokens") -- unveraendert aus app/plan/plan-view.module.css
 * hierher gewandert. Sie gilt ausserdem fuer "Mein Bereich", die Verwaltung,
 * die Anmeldung und den Wartungshinweis, die bis req-089 je eine Kopie
 * davon trugen.
 *
 * --text-3 und --text-4 weichen bewusst von der Vorlage ab (bug-051): dort
 * trugen sie #7b83a8 und #4a5170 und erreichten auf --card-alt nur 4,49:1
 * und 2,2:1 -- zu wenig fuer die sehr kleine Schrift, die sie tragen
 * (Stundenbeschriftung 10px, Detail-Labels 9,5px). Aufgehellt auf 6,5:1 und
 * 4,9:1; die Abstufung der vier Stufen bleibt erhalten. Geprueft in
 * components/farbwelt.kontrast.test.ts.
 *
 * Der Begleiter hat seine eigene, helle Farbschicht mit waehlbaren Themes
 * (app/go/theme.module.css, lib/theme/) und bekommt diese hier nicht: sie
 * haengt an einer Klasse, nicht an `:root`.
 */
export const FARBWELT_PLANER = {
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
} as const;

export type FarbToken = keyof typeof FARBWELT_PLANER;

/**
 * Die globale Klasse, an der die Farbwelt haengt. Ein CSS-Modul holt sie mit
 * `composes: farbwelt-planer from global;` an seine Wurzel.
 */
export const FARBWELT_KLASSE = "farbwelt-planer";

function block(selektor: string, werte: Record<string, string>): string {
  const zeilen = Object.entries(werte).map(
    ([name, wert]) => `  ${name}: ${wert};`,
  );
  return `${selektor} {\n${zeilen.join("\n")}\n}`;
}

/** Die Tokens als Stylesheet, so wie das Root-Layout es in jede Seite schreibt. */
export function stilCss(): string {
  return [block(`.${FARBWELT_KLASSE}`, FARBWELT_PLANER)].join("\n\n");
}
