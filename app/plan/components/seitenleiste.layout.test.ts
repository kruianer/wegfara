import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLAN_AREAS } from "@/lib/plan/areas";
import { SPALTEN_NEBENEINANDER_AB_PX } from "@/lib/plan/spalten";
import { FARBWELT_PLANER, TIPPZIEL_PX, masse } from "@/lib/design/stil";
import {
  MINDESTKONTRAST_FLIESSTEXT,
  kontrastVerhaeltnis,
} from "@/lib/design/kontrast";

// jsdom fuehrt kein CSS aus -- wo die Leiste steht, ob die Namen unter den
// Symbolen zu sehen sind und ob sie mit dem Finger zu treffen ist, wird
// deshalb direkt am CSS geprueft statt am gerenderten DOM (siehe
// components/bereichsleiste.layout.test.ts, bug-014). Was sich nur im
// Browser messen laesst -- die Breite des gerenderten Textes --, prueft
// tests/e2e/seitenleiste.e2e.ts.
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Die Regel zu genau diesem Selektor -- am Zeilenanfang, nie eine Teilmenge. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(^|\\n)${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

/** Der Wert einer Eigenschaft, wie er in der Regel steht. */
function wert(regel: string, eigenschaft: string) {
  return (
    regel
      .match(new RegExp(`(^|[\\s;{])${eigenschaft}:\\s*([^;]+);`, "i"))?.[2]
      ?.trim() ?? null
  );
}

/**
 * Der Zahlenwert einer Eigenschaft in Pixeln -- auch dann, wenn er ueber eine
 * Variable kommt: die eigenen Masse der Leiste stehen an `.leiste`, die
 * gemeinsamen (Schriftstufen, Abstaende, Tippziel) in lib/design/stil.ts
 * (req-089).
 */
function px(css: string, regel: string, eigenschaft: string): number | null {
  const roh = wert(regel, eigenschaft);
  if (roh === null) return null;
  const variable = roh.match(/^var\((--[\w-]+)\)$/)?.[1];
  if (variable) {
    const eigen = px(css, rule(css, ".leiste"), variable);
    if (eigen !== null) return eigen;
    const gemeinsam = masse()[variable as `--${string}`];
    return gemeinsam ? Number.parseFloat(gemeinsam) : null;
  }
  const zahl = roh.match(/^(-?[\d.]+)(px)?$/);
  return zahl ? Number(zahl[1]) : null;
}

/**
 * Einer von mehreren Werten in Pixeln: bei `padding: 10px 4px` ist 0 oben
 * und unten, 1 links und rechts.
 */
function pxTeil(regel: string, eigenschaft: string, index: 0 | 1) {
  const teile = (wert(regel, eigenschaft) ?? "").split(/\s+/);
  return Number.parseFloat(teile[index] ?? teile[0]);
}

const css = readCss("./seitenleiste.module.css");
const leiste = rule(css, ".leiste");
const BREITE = px(css, leiste, "--leiste-breite")!;
/** Was innen bleibt: die Breite ohne Innenabstand links und rechts und Rand. */
const INNEN =
  BREITE - 2 * pxTeil(leiste, "padding", 1) - px(css, leiste, "border-right")!;

describe("Seitenleiste Layout (req-077)", () => {
  const planer = readCss("../plan-view.module.css");

  /**
   * Die Navigation liegt am linken Rand und nicht ueber dem Kopf: Leiste und
   * Inhalt stehen nebeneinander in einer Reihe, und die Leiste reicht von
   * oben bis unten.
   */
  it("stellt die Bereiche neben den Inhalt, nicht darüber", () => {
    const rahmen = rule(planer, ".rahmen");
    expect(rahmen).toMatch(/display:\s*flex/);
    // Eine Reihe ist die Vorgabe von flex -- eine Spalte waere wieder eine
    // Leiste ueber dem Inhalt.
    expect(rahmen).not.toMatch(/flex-direction:\s*column/);

    expect(leiste).toMatch(/flex-direction:\s*column/);
    expect(leiste).toMatch(/flex:\s*none/);
  });

  /**
   * Der Zeitstrahl bekommt die Hoehe der alten Kopfleiste zurueck: ueber dem
   * Inhalt steht nichts mehr, was Hoehe kostet. Die alte Leiste war
   * mindestens 66px hoch (components/bereichsleiste.module.css) -- die
   * Seitenleiste gibt sich keine solche Hoehe, sie nimmt Breite.
   */
  it("nimmt dem Inhalt keine Höhe mehr weg", () => {
    expect(leiste).not.toMatch(/min-height/);
    expect(rule(planer, ".content")).not.toMatch(/margin-top|padding-top/);
    // Die Mindestbreite des Planers liegt seit req-077 an der Reihe, damit
    // Leiste und Inhalt zusammen darin bleiben, statt sie um die Leiste zu
    // ueberschreiten (Regel 1, stack.md). Seit req-088 setzt plan-view.tsx
    // sie aus PLANNER_MIN_WIDTH_PX -- als Zahl steht sie im CSS nicht mehr.
    expect(rule(planer, ".rahmen")).not.toMatch(/min-width/);
    expect(rule(planer, ".content")).toMatch(/min-width:\s*0/);
  });

  /**
   * Der Inhalt daneben bleibt lesbar (req-077) -- auch bei der schmalsten
   * Breite, auf der die drei Spalten der Planung nebeneinander stehen
   * (1180 px, siehe lib/plan/spalten.ts; darunter steht neben dem Zeitstrahl
   * nur eine von beiden, req-088).
   */
  it("lässt dem Inhalt auch bei 1180 px genug Breite", () => {
    const auswahl = Number.parseFloat(
      wert(rule(readCss("./unplanned-column.module.css"), ".column"), "width")!,
    );
    const zeitstrahl = Number.parseFloat(
      wert(rule(readCss("./timeline-column.module.css"), ".column"), "width")!,
    );
    expect(BREITE + auswahl + zeitstrahl).toBeLessThan(
      SPALTEN_NEBENEINANDER_AB_PX,
    );
  });
});

/**
 * req-094: Die Leiste hat nur noch eine Form -- schmal, mit dem Namen jedes
 * Eintrags klein unter seinem Symbol. Den aufgeklappten Zustand aus req-077
 * und req-078 gibt es nicht mehr, auch nicht als toten Rest im Stylesheet.
 */
describe("Seitenleiste -- immer schmal (req-094)", () => {
  it("kennt keinen aufgeklappten Zustand mehr", () => {
    expect(css).not.toMatch(/\.offen\b/);
    expect(css).not.toMatch(/\.davor\b/);
    expect(css).not.toMatch(/\.spur\b|\.tafel\b|\.schalter\b|\.marke\b/);
    expect(css).not.toMatch(/--leiste-breite-offen/);
    expect(readCss("./reisewahl.module.css")).not.toMatch(/\.offen\b/);
  });

  /** Die Breite steht an genau einer Stelle als Token. */
  it("nennt ihre Breite an genau einer Stelle", () => {
    expect(css.match(/--leiste-breite:/g)).toHaveLength(1);
    expect(leiste).toMatch(/width:\s*var\(--leiste-breite\)/);
    expect(leiste).toMatch(/box-sizing:\s*border-box/);
  });

  /**
   * Sie ist hoechstens so breit, wie der laengste Name plus Rand verlangt --
   * und in keinem Fall breiter als 72 px. Der laengste Name ist am
   * gerenderten Text gemessen ("Verwaltung", 50 px); dass er auch im
   * Browser hineinpasst, prueft tests/e2e/seitenleiste.e2e.ts.
   */
  it("ist nie breiter als 72 px", () => {
    expect(BREITE).toBeLessThanOrEqual(72);
  });

  it("lässt innen Platz für ein Tippziel", () => {
    expect(INNEN).toBeGreaterThanOrEqual(TIPPZIEL_PX);
  });

  /**
   * Symbol oben, Name darunter -- wie in der unteren Leiste des Begleiters
   * (bug-034), in derselben Schrift von 9,5 px.
   */
  it("stellt den Namen unter das Symbol", () => {
    for (const regel of [
      rule(css, ".eintrag"),
      rule(readCss("./reisewahl.module.css"), ".tripButton"),
    ]) {
      expect(regel).toMatch(/flex-direction:\s*column/);
      expect(regel).toMatch(/align-items:\s*center/);
      expect(regel).toMatch(/text-align:\s*center/);
      expect(px(css, regel, "font-size")).toBe(9.5);
    }
    expect(px(css, rule(css, ".abmelden"), "font-size")).toBe(9.5);
    expect(rule(css, ".abmelden")).toMatch(/flex-direction:\s*column/);
  });

  /**
   * Die Namen sind zu sehen -- nicht mehr nur fuer Vorleseprogramme
   * (req-077) -- und brechen um, statt die Leiste zu sprengen.
   */
  it("zeigt die Namen und lässt sie umbrechen", () => {
    for (const regel of [
      rule(css, ".label"),
      rule(readCss("./reisewahl.module.css"), ".tripLabel"),
    ]) {
      expect(regel).not.toMatch(/clip-path|position:\s*absolute|width:\s*1px/);
      expect(regel).toMatch(/max-width:\s*100%/);
      expect(regel).toMatch(/overflow-wrap:\s*break-word/);
    }
    expect(css).not.toMatch(/white-space:\s*nowrap/);
  });

  /**
   * Die Symbole bleiben die bestehenden in ihrer Groesse von 22 px
   * (SYMBOL_GROESSE_PX, seitenleiste.test.tsx); in der Hoehe zaehlt mit
   * dem Namen darunter das Tippziel.
   */
  it("gibt jedem Eintrag mindestens 44 px Höhe", () => {
    const eintrag = rule(css, ".eintrag");
    expect(px(css, eintrag, "min-height")).toBeGreaterThanOrEqual(44);
    expect(eintrag).toMatch(/box-sizing:\s*border-box/);
    const reise = rule(readCss("./reisewahl.module.css"), ".tripButton");
    expect(px(css, reise, "min-height")).toBeGreaterThanOrEqual(44);
    expect(reise).toMatch(/box-sizing:\s*border-box/);
    expect(reise).toMatch(/width:\s*100%/);
  });
});

/**
 * Die Marke: unter der Kompassrose "Wegfara" und der Slogan in Handschrift
 * (req-077), seit req-094 sehr klein und mittig, der Slogan auf zwei Zeilen
 * umbrechend.
 */
describe("Seitenleiste -- die Marke (req-077, req-094)", () => {
  const kopf = rule(css, ".kopf");
  const wordmark = rule(css, ".wordmark");
  const slogan = rule(css, ".slogan");

  it("stellt Name und Slogan mittig unter die Kompassrose", () => {
    expect(kopf).toMatch(/flex-direction:\s*column/);
    expect(kopf).toMatch(/align-items:\s*center/);
    expect(kopf).toMatch(/text-align:\s*center/);
  });

  it("hält beide sehr klein", () => {
    expect(px(css, wordmark, "font-size")).toBeLessThanOrEqual(12);
    expect(px(css, slogan, "font-size")).toBeLessThanOrEqual(12);
  });

  it("schreibt den Slogan in Handschrift", () => {
    expect(slogan).toMatch(/font-family:\s*var\(--font-hand\)/);
    // Die Rueckfaelle der Vorlage: Windows und Apple bringen sie mit.
    expect(slogan).toMatch(/"Segoe Script"/);
    expect(slogan).toMatch(/"Bradley Hand"/);
    expect(slogan).toMatch(/cursive/);
  });

  /**
   * Die Handschrift kommt aus dem eigenen Bundle und nicht von einem fremden
   * Dienst (req-077, Constraints): `next/font/google` laedt sie beim Bauen
   * herunter und liefert sie selbst aus.
   */
  it("liefert die Handschrift mit, statt sie fremd zu laden", () => {
    // readCss liest hier die Datei, die die Schrift bindet -- nicht CSS.
    const layout = readCss("../layout.tsx");

    expect(layout).toMatch(/import\s*{[^}]*Caveat[^}]*}\s*from\s*"next\/font/);
    expect(layout).toMatch(/variable:\s*"--font-hand"/);
    expect(layout).toMatch(/caveat\.variable/);
    // Kein Stylesheet von fonts.googleapis.com oder anderswo im Netz.
    expect(layout).not.toMatch(/https?:\/\//);
  });

  it("stellt ihn leicht schräg, ohne dafür Höhe zu brauchen", () => {
    // Eine Drehung ist eine Transformation: sie aendert die Hoehe im Layout
    // nicht.
    const grad = slogan.match(/transform:\s*rotate\((-?[\d.]+)deg\)/);
    expect(grad).not.toBeNull();
    expect(Math.abs(Number(grad![1]))).toBeGreaterThan(0);
    expect(Math.abs(Number(grad![1]))).toBeLessThanOrEqual(8);
    expect(Number(wert(slogan, "line-height"))).toBeLessThanOrEqual(1.2);
    expect(slogan).not.toMatch(/[^-]height:/);
  });

  /**
   * Er bricht um, statt ueber den Rand zu stehen -- und wird dabei nicht
   * abgeschnitten.
   */
  it("bricht den Slogan um und schneidet ihn nicht ab", () => {
    expect(slogan).not.toMatch(/white-space:\s*nowrap/);
    expect(slogan).toMatch(/max-width:\s*\d/);
    expect(slogan).not.toMatch(/text-overflow|overflow:\s*hidden/);
    expect(leiste).not.toMatch(/overflow/);
    expect(kopf).not.toMatch(/overflow/);
  });

  /** Beschriftung, kein Bedienelement: einen Schalter gibt es dort nicht. */
  it("macht aus der Kompassrose keinen Knopf mehr", () => {
    expect(css).not.toMatch(/\.schalter/);
    expect(rule(css, ".logo")).not.toMatch(/cursor:\s*pointer/);
  });
});

/**
 * Kontrast nach lib/design/kontrast.ts (req-094, GUI): die kleinen Namen und
 * der Slogan mindestens 4,5:1 auf --deep. Bei 9,5 px ist das die Stelle, an
 * der es leicht misslingt (vgl. bug-051).
 */
describe("Seitenleiste -- Kontrast der kleinen Schrift (req-094)", () => {
  /** Die Farbe eines Tokens der Farbwelt des Planers. */
  function farbe(regel: string) {
    const name = wert(regel, "color")?.match(/^var\((--[\w-]+)\)$/)?.[1];
    expect(name, regel).toBeDefined();
    return FARBWELT_PLANER[name as keyof typeof FARBWELT_PLANER];
  }

  it("liegt auf --deep", () => {
    expect(leiste).toMatch(/background:\s*var\(--deep\)/);
  });

  for (const [stelle, selektor] of [
    ["die Namen", ".eintrag"],
    ["ein abgeschalteter Bereich", ".eintrag:disabled"],
    ["das Abmelden", ".abmelden"],
    ["der Name „Wegfara“", ".wordmark"],
    ["der Slogan", ".slogan"],
  ] as const) {
    it(`gibt ${stelle} mindestens 4,5:1`, () => {
      const vorne = farbe(rule(css, selektor));
      expect(
        kontrastVerhaeltnis(vorne, FARBWELT_PLANER["--deep"]),
      ).toBeGreaterThanOrEqual(MINDESTKONTRAST_FLIESSTEXT);
    });
  }
});

/**
 * bug-058: Untereinander stehen in der Leiste drei Gruppen -- die Marke, die
 * gewaehlte Reise, die Menuepunkte -- und darunter der Fuss. Zwischen ihnen
 * steht mehr Luft als in ihnen; erst daran ist zu sehen, was zusammengehoert.
 * Die Masse sind die von LivingGardenTwin, an dem sich die Leiste seit
 * req-078 ausrichtet: 16 px vor und 20 px nach der Mitte.
 */
describe("Seitenleiste -- Abstand zwischen den Gruppen (bug-058)", () => {
  /** Die Abstaende zwischen zwei Gruppen -- einer je Fuge. */
  const zwischenGruppen = {
    "Marke → Reise": px(css, rule(css, ".kopf"), "margin-bottom"),
    "Reise → Bereiche": px(css, rule(css, ".nav"), "margin-top"),
    "Bereiche → Fuß": px(css, rule(css, ".fuss"), "margin-top"),
  };

  /** Die Abstaende innerhalb einer Gruppe. */
  const inGruppen = {
    "Menüpunkt → Menüpunkt": px(css, rule(css, ".nav"), "gap"),
    "Eintrag → Eintrag am Fuß": px(css, rule(css, ".fuss"), "gap"),
    "Kompassrose → Name": px(css, rule(css, ".kopf"), "gap"),
    "Symbol → Name": px(css, rule(css, ".eintrag"), "gap"),
    "Name → Slogan":
      px(css, rule(css, ".kopf"), "gap")! +
      px(css, rule(css, ".slogan"), "margin-top")!,
  };

  /**
   * Ein gemeinsamer Abstand der Leiste legte sich auf jede Fuge zugleich --
   * genau daran scheiterte der Unterschied. Die Gruppen bringen ihn einzeln
   * mit.
   */
  it("verteilt keinen Abstand über alle Fugen zugleich", () => {
    expect(leiste).not.toMatch(/(^|[\s;{])gap:/);
    for (const [fuge, abstand] of Object.entries(zwischenGruppen)) {
      expect(abstand, fuge).not.toBeNull();
    }
  });

  it("trennt die Gruppen sichtbar weiter, als in ihnen Abstand steht", () => {
    const engster = Math.min(...Object.values(zwischenGruppen).map((a) => a!));
    for (const [stelle, abstand] of Object.entries(inGruppen)) {
      expect(abstand, stelle).not.toBeNull();
      expect(engster, stelle).toBeGreaterThanOrEqual(abstand! + 6);
    }
    expect(engster).toBeGreaterThanOrEqual(
      4 * inGruppen["Menüpunkt → Menüpunkt"]!,
    );
  });

  /** Name und Slogan bleiben ein Paar -- ohne aneinanderzukleben. */
  it("hält Name und Slogan zusammen", () => {
    const slogan = inGruppen["Name → Slogan"];
    expect(slogan).toBeGreaterThan(3);
    expect(slogan).toBeLessThan(zwischenGruppen["Marke → Reise"]!);
  });

  /**
   * Die Leiste passt ganz auf den Schirm (stack.md, Bildschirmbreiten,
   * Regel 3) -- bei der Hoehe, mit der die E2E-Pruefung misst (900 px, siehe
   * tests/e2e/screen-check.ts), mit allen Bereichen, dem Begleiter, dem
   * Reiseplan und dem Fuss des Gesamt-Admins. Mit dem Namen unter dem Symbol
   * ist jeder Eintrag hoeher als zuvor; "Mein Bereich" steht auf zwei Zeilen.
   */
  it("passt mit den Namen unter den Symbolen ganz auf den Schirm", () => {
    const eintrag = rule(css, ".eintrag");
    const zeile = 9.5 * Number(masse()["--zeile-xxs"]);
    const eintragsHoehe = (zeilen: number) =>
      Math.max(
        px(css, eintrag, "min-height")!,
        2 * pxTeil(eintrag, "padding", 0) +
          22 +
          px(css, eintrag, "gap")! +
          zeilen * zeile,
      );
    const liste = (hoehen: number[], abstand: number) =>
      hoehen.reduce((summe, h) => summe + h, 0) + (hoehen.length - 1) * abstand;

    const wordmark = rule(css, ".wordmark");
    const slogan = rule(css, ".slogan");
    const kopf =
      Number.parseFloat(wert(rule(css, ".logo"), "width")!) +
      inGruppen["Kompassrose → Name"]! +
      px(css, wordmark, "font-size")! * Number(wert(wordmark, "line-height")) +
      inGruppen["Name → Slogan"]! +
      2 * px(css, slogan, "font-size")! * Number(wert(slogan, "line-height"));

    // Bereiche, dazu Begleiter und Reiseplan.
    const bereiche = Array(PLAN_AREAS.length + 2).fill(eintragsHoehe(1));
    // Am Fuss "Mein Bereich" (zwei Zeilen), die Verwaltung, das Abmelden.
    const amFuss = [eintragsHoehe(2), eintragsHoehe(1), TIPPZIEL_PX + zeile];

    const hoehe =
      2 * pxTeil(leiste, "padding", 0) +
      kopf +
      zwischenGruppen["Marke → Reise"]! +
      eintragsHoehe(1) + // die Reisewahl
      zwischenGruppen["Reise → Bereiche"]! +
      liste(bereiche, inGruppen["Menüpunkt → Menüpunkt"]!) +
      zwischenGruppen["Bereiche → Fuß"]! +
      px(css, rule(css, ".fuss"), "padding-top")! +
      liste(amFuss, inGruppen["Eintrag → Eintrag am Fuß"]!);

    expect(hoehe).toBeLessThanOrEqual(900);
  });

  /**
   * Und wird es doch einmal zu niedrig (iPad quer im geteilten Fenster),
   * rollt die Liste, statt Eintraege abzuschneiden -- Kopf, Reisewahl und
   * Fuss bleiben stehen.
   */
  it("lässt die Liste rollen, wenn es doch zu niedrig wird", () => {
    expect(rule(css, ".nav")).toMatch(/overflow-y:\s*auto/);
    expect(rule(css, ".nav")).toMatch(/min-height:\s*0/);
    expect(rule(css, ".kopf")).toMatch(/flex:\s*none/);
    expect(rule(css, ".fuss")).toMatch(/flex:\s*none/);
  });
});
