import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLAN_AREAS } from "@/lib/plan/areas";

// jsdom fuehrt kein CSS aus -- wo die Leiste steht, ob sie eingeklappt nur
// Symbole zeigt und ob sie mit dem Finger zu treffen ist, wird deshalb direkt
// am CSS geprueft statt am gerenderten DOM (siehe
// components/bereichsleiste.layout.test.ts, bug-014).
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

/** Der Zahlenwert einer Eigenschaft in Pixeln. */
function px(regel: string, eigenschaft: string) {
  const treffer = regel.match(
    new RegExp(`${eigenschaft}:\\s*(-?[\\d.]+)px`, "i"),
  );
  return treffer ? Number(treffer[1]) : null;
}

/** Der Zahlenwert einer Eigenschaft ohne Einheit (z.B. z-index). */
function zahl(regel: string, eigenschaft: string) {
  const treffer = regel.match(
    new RegExp(`${eigenschaft}:\\s*(-?[\\d.]+)`, "i"),
  );
  return treffer ? Number(treffer[1]) : null;
}

/**
 * Wie `px`, aber auch dann, wenn der Wert ueber eine Variable kommt: die
 * Abstaende der Leiste stehen als Design Tokens an `.spur` (bug-058).
 */
function pxVar(css: string, regel: string, eigenschaft: string) {
  const direkt = px(regel, eigenschaft);
  if (direkt !== null) return direkt;
  const name = regel.match(
    new RegExp(`${eigenschaft}:\\s*var\\((--[\\w-]+)\\)`, "i"),
  )?.[1];
  return name ? px(rule(css, ".spur"), name) : null;
}

describe("Seitenleiste Layout (req-077)", () => {
  const css = readCss("./seitenleiste.module.css");
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

    const tafel = rule(css, ".tafel");
    expect(tafel).toMatch(/top:\s*0/);
    expect(tafel).toMatch(/bottom:\s*0/);
    expect(tafel).toMatch(/left:\s*0/);
    expect(rule(css, ".tafel")).toMatch(/flex-direction:\s*column/);
  });

  /**
   * Der Zeitstrahl bekommt die Hoehe der alten Kopfleiste zurueck: ueber dem
   * Inhalt steht nichts mehr, was Hoehe kostet. Die alte Leiste war
   * mindestens 66px hoch (components/bereichsleiste.module.css) -- die
   * Seitenleiste gibt sich keine solche Hoehe, sie nimmt Breite.
   */
  it("nimmt dem Inhalt keine Höhe mehr weg", () => {
    expect(rule(css, ".tafel")).not.toMatch(/min-height/);
    expect(rule(planer, ".content")).not.toMatch(/margin-top|padding-top/);
    // Die Mindestbreite des Planers liegt seit req-077 an der Reihe, damit
    // Leiste und Inhalt zusammen darin bleiben, statt sie um die Leiste zu
    // ueberschreiten (Regel 1, stack.md).
    expect(rule(planer, ".rahmen")).toMatch(/min-width:\s*1180px/);
    expect(rule(planer, ".content")).toMatch(/min-width:\s*0/);
  });

  /**
   * Aufgeklappt liegt die Leiste ueber der Seite, statt sie
   * beiseitezuschieben: die Spur behaelt ihre Breite, nur die Tafel darauf
   * waechst -- und die liegt absolut darin.
   */
  it("legt sich beim Aufklappen über den Inhalt, statt ihn zu verschieben", () => {
    const spur = rule(css, ".spur");
    expect(spur).toMatch(/position:\s*relative/);
    expect(spur).toMatch(/width:\s*var\(--leiste-breite\)/);

    expect(rule(css, ".tafel")).toMatch(/position:\s*absolute/);
    expect(rule(css, ".offen .tafel")).toMatch(
      /width:\s*var\(--leiste-breite-offen\)/,
    );
    // Keine Regel im Aufklapp-Zustand ruehrt die Breite der Spur an.
    expect(rule(css, ".spur.offen")).toBe("");
    expect(rule(css, ".offen")).toBe("");
  });

  /**
   * Ein Tipp daneben klappt die Leiste zu, ohne darunter etwas zu oeffnen
   * (req-077): die Flaeche davor bedeckt die ganze Seite und liegt unter der
   * Leiste, aber ueber allem anderen.
   */
  it("legt vor die Seite eine Fläche, die den Tipp daneben abfängt", () => {
    const davor = rule(css, ".davor");
    expect(davor).toMatch(/position:\s*fixed/);
    expect(davor).toMatch(/inset:\s*0/);

    const zDavor = zahl(davor, "z-index");
    const zSpur = zahl(rule(css, ".spur"), "z-index");
    expect(zDavor).not.toBeNull();
    expect(zSpur).toBeGreaterThan(zDavor!);
  });

  /**
   * Eingeklappt zeigt die Leiste nur Symbole; aufgeklappt stehen die
   * Beschriftungen daneben. Im Dokument bleibt der Text beide Male stehen --
   * fuer Vorleseprogramme (req-077, Constraints).
   */
  it("versteckt die Beschriftungen eingeklappt und zeigt sie aufgeklappt", () => {
    const label = rule(css, ".label");
    expect(label).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(label).toMatch(/width:\s*1px/);
    expect(label).toMatch(/height:\s*1px/);

    const offen = rule(css, ".offen .label");
    expect(offen).toMatch(/position:\s*static/);
    expect(offen).toMatch(/clip-path:\s*none/);
    expect(offen).toMatch(/width:\s*auto/);
  });

  it("versteckt Name und Slogan eingeklappt genauso", () => {
    expect(rule(css, ".marke")).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(rule(css, ".offen .marke")).toMatch(/clip-path:\s*none/);
  });

  /**
   * Der Inhalt daneben bleibt lesbar (req-077) -- auch bei der schmalsten
   * Breite, auf der der Planer ueberhaupt laeuft (1180 px, siehe
   * lib/plan/viewport.ts; darunter steht statt seiner der Hinweis auf den
   * Begleiter). Die Leiste darf dort nicht so viel Breite nehmen, dass der
   * Inhalt unbrauchbar wird.
   */
  it("lässt dem Inhalt auch bei 1180 px genug Breite", () => {
    const schmalste = 1180;
    const eingeklappt = px(rule(css, ".spur"), "--leiste-breite")!;
    const aufgeklappt = px(rule(css, ".spur"), "--leiste-breite-offen")!;

    // Die beiden festen Spalten der Planung stehen weiterhin neben der
    // Leiste, und fuer die Tageskarte bleibt Platz.
    const auswahl = px(
      rule(readCss("./unplanned-column.module.css"), ".column"),
      "width",
    )!;
    const zeitstrahl = px(
      rule(readCss("./timeline-column.module.css"), ".column"),
      "width",
    )!;
    expect(eingeklappt + auswahl + zeitstrahl).toBeLessThan(schmalste);

    // Aufgeklappt deckt sie hoechstens ein Drittel davon ab -- was darunter
    // liegt, bleibt zu lesen.
    expect(aufgeklappt).toBeLessThanOrEqual(schmalste / 3);
  });

  /**
   * req-078: Aufgeklappt ist die Leiste so breit wie bei LivingGardenTwin,
   * an dem sie sich ausrichtet -- 320 px statt der 256 px aus req-077.
   * Eingeklappt bleibt sie, wie sie war.
   */
  it("ist aufgeklappt so breit wie bei LGT (req-078)", () => {
    const spur = rule(css, ".spur");
    expect(px(spur, "--leiste-breite-offen")).toBe(320);
    expect(px(spur, "--leiste-breite")).toBe(66);
  });

  /**
   * req-078: Bei 320 px aufgeklappter Breite ist zu pruefen, was die Leiste
   * verdeckt -- sie liegt ueber der Seite und schiebt nichts weg (req-077).
   * Verdeckt wird hoechstens die Spalte "Noch unverplant"; der Zeitstrahl
   * beginnt rechts davon und bleibt auch auf der schmalsten Breite des
   * Planers (1180 px) ganz zu sehen.
   */
  it("verdeckt aufgeklappt höchstens die erste Spalte (req-078)", () => {
    const spur = rule(css, ".spur");
    const eingeklappt = px(spur, "--leiste-breite")!;
    const aufgeklappt = px(spur, "--leiste-breite-offen")!;
    const auswahl = px(
      rule(readCss("./unplanned-column.module.css"), ".column"),
      "width",
    )!;

    // Die Leiste beginnt am linken Rand; hinter ihrer Spur folgt die erste
    // Spalte. Wo die zweite anfaengt, reicht die aufgeklappte Leiste nicht
    // mehr hin.
    expect(aufgeklappt).toBeLessThanOrEqual(eingeklappt + auswahl);
  });

  /**
   * req-078: Gewachsen sind allein Slogan und aufgeklappte Breite. Die
   * uebrigen Masse, die schon mit LGT uebereinstimmen, bleiben, wie sie
   * sind -- Beschriftung und Zeilenhoehe der Eintraege.
   */
  it("lässt Beschriftung und Zeilenhöhe der Einträge, wie sie waren (req-078)", () => {
    const eintrag = rule(css, ".eintrag");
    expect(px(eintrag, "font-size")).toBe(13);
    expect(px(eintrag, "min-height")).toBe(44);
    // Auch am Abmelden am Fuss steht die Beschriftung in derselben Groesse.
    expect(px(rule(css, ".abmelden"), "font-size")).toBe(13);
  });
});

/**
 * req-077: Aufgeklappt steht unter dem Namen ein Slogan in Handschrift, leicht
 * schraeg gestellt -- wie ein angehefteter Zettel. Er nimmt dabei nicht mehr
 * Hoehe ein als eine gerade Zeile, passt in eine Zeile und wird nicht
 * abgeschnitten.
 */
describe("Seitenleiste -- der Slogan (req-077)", () => {
  const css = readCss("./seitenleiste.module.css");
  const slogan = rule(css, ".slogan");

  it("schreibt ihn in Handschrift", () => {
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
    // nicht -- der Slogan bleibt so hoch wie eine gerade Zeile.
    const grad = slogan.match(/transform:\s*rotate\((-?[\d.]+)deg\)/);
    expect(grad).not.toBeNull();
    expect(Math.abs(Number(grad![1]))).toBeGreaterThan(0);
    expect(Math.abs(Number(grad![1]))).toBeLessThanOrEqual(8);
    expect(zahl(slogan, "line-height")).toBeLessThanOrEqual(1.2);
    // Keine eigene Hoehe -- line-height allein bestimmt sie.
    expect(slogan).not.toMatch(/[^-]height:/);
  });

  it("hält ihn in einer Zeile und schneidet ihn nicht ab", () => {
    expect(slogan).toMatch(/white-space:\s*nowrap/);
    expect(slogan).not.toMatch(/text-overflow|overflow:\s*hidden/);
    // Nichts darueber schneidet ihn ab: die Tafel laesst ihn stehen, und
    // aufgeklappt gibt die Marke ihn frei.
    expect(rule(css, ".tafel")).not.toMatch(/overflow/);
    expect(rule(css, ".offen .marke")).toMatch(/overflow:\s*visible/);
  });

  /**
   * Und er passt auch hinein: die aufgeklappte Breite laesst neben dem
   * Schalter genug Platz. Gerechnet wird mit 0,5em je Zeichen -- eine
   * Obergrenze fuer eine Handschrift, die deutlich schmaler laeuft.
   */
  it("findet in der aufgeklappten Breite Platz", () => {
    const spur = rule(css, ".spur");
    const tafel = rule(css, ".tafel");
    const kopf = rule(css, ".kopf");
    const platz =
      px(spur, "--leiste-breite-offen")! -
      2 * px(tafel, "padding")! -
      px(tafel, "border-right")! -
      px(rule(css, ".schalter"), "width")! -
      px(kopf, "gap")!;
    const breiteDesSlogans =
      "Wohin es euch zieht".length * 0.5 * px(slogan, "font-size")!;

    expect(breiteDesSlogans).toBeLessThanOrEqual(platz);
  });

  /**
   * req-078: Der Slogan ist so gross wie bei LivingGardenTwin, an dem sich
   * die Leiste ausrichtet -- 21 px statt der 16 px aus req-077. Dass er
   * dabei in einer Zeile bleibt und nicht abgeschnitten wird, pruefen die
   * beiden Tests darueber; sie rechnen mit eben dieser Groesse.
   */
  it("ist so groß wie bei LGT (req-078)", () => {
    expect(px(slogan, "font-size")).toBe(21);
  });

  /**
   * bug-058: Der Slogan hing mit 3 px praktisch am Namen. Er bekommt Luft --
   * aber weniger, als zwischen den Gruppen steht: Name und Slogan bleiben
   * erkennbar ein Paar (siehe den Abschnitt zu den Gruppen weiter unten).
   */
  it("hängt nicht mehr am Namen (bug-058)", () => {
    expect(px(slogan, "margin-top")).toBeGreaterThan(3);
  });

  /**
   * Jedes Symbol ist mit dem Finger zu treffen: mindestens 44x44 px
   * (stack.md, Bildschirmbreiten, Regel 4). In der Breite bleibt nach
   * Innenabstand und Rand der Leiste genau so viel uebrig.
   */
  it("gibt jedem Symbol mindestens 44 x 44 px", () => {
    const eintrag = rule(css, ".eintrag");
    expect(eintrag).toMatch(/min-height:\s*44px/);
    expect(eintrag).toMatch(/box-sizing:\s*border-box/);

    const schalter = rule(css, ".schalter");
    expect(schalter).toMatch(/width:\s*44px/);
    expect(schalter).toMatch(/height:\s*44px/);
    expect(schalter).toMatch(/box-sizing:\s*border-box/);

    const spur = rule(css, ".spur");
    const tafel = rule(css, ".tafel");
    const breite = px(spur, "--leiste-breite");
    const innen = px(tafel, "padding");
    const rand = px(tafel, "border-right");
    expect(tafel).toMatch(/box-sizing:\s*border-box/);
    expect(breite).not.toBeNull();
    expect(innen).not.toBeNull();
    expect(rand).not.toBeNull();
    expect(breite! - 2 * innen! - rand!).toBeGreaterThanOrEqual(44);
  });
});

/**
 * bug-058: Untereinander stehen in der Leiste drei Gruppen -- der Name mit
 * dem Slogan, die gewaehlte Reise, die Menuepunkte. Bis dahin trennte sie ein
 * einziger Abstand fuer alles (`.tafel { gap: 10px }`) -- dieselben 10 px, die
 * innerhalb einer Zeile zwischen Symbol und Text stehen. Am Abstand war damit
 * nicht zu erkennen, was zusammengehoert.
 *
 * Jetzt trennt die Gruppen mehr Luft, als in ihnen steht. Die Masse sind die
 * von LivingGardenTwin, an dem sich die Leiste seit req-078 ausrichtet: 16 px
 * vor und 20 px nach der Mitte (`--rail-clock-lead`, `--rail-clock-trail`),
 * waehrend die Eintraege dicht beieinander bleiben.
 */
describe("Seitenleiste -- Abstand zwischen den Gruppen (bug-058)", () => {
  const css = readCss("./seitenleiste.module.css");

  /** Die Abstaende zwischen zwei Gruppen -- einer je Fuge. */
  const zwischenGruppen = {
    "Name → Reise": pxVar(css, rule(css, ".kopf"), "margin-bottom"),
    "Reise → Bereiche": pxVar(css, rule(css, ".nav"), "margin-top"),
    "Bereiche → Fuß": pxVar(css, rule(css, ".fuss"), "margin-top"),
  };

  /** Die Abstaende innerhalb einer Gruppe. */
  const inGruppen = {
    "Menüpunkt → Menüpunkt": pxVar(css, rule(css, ".nav"), "gap"),
    "Eintrag → Eintrag am Fuß": pxVar(css, rule(css, ".fuss"), "gap"),
    "Kompassrose → Name": pxVar(css, rule(css, ".kopf"), "gap"),
    "Symbol → Beschriftung": pxVar(css, rule(css, ".eintrag"), "gap"),
    "Name → Slogan": pxVar(css, rule(css, ".slogan"), "margin-top"),
  };

  /**
   * Ein gemeinsamer Abstand der Tafel legte sich auf jede Fuge zugleich --
   * genau daran scheiterte der Unterschied. Die Gruppen bringen ihn jetzt
   * einzeln mit.
   */
  it("verteilt keinen Abstand mehr über alle Fugen zugleich", () => {
    expect(rule(css, ".tafel")).not.toMatch(/gap:/);
    for (const [fuge, abstand] of Object.entries(zwischenGruppen)) {
      expect(abstand, fuge).not.toBeNull();
    }
  });

  /**
   * Der Unterschied muss auf einen Blick zu sehen sein: jeder Abstand
   * zwischen zwei Gruppen ist ein Mehrfaches jedes Abstands innerhalb einer.
   */
  it("trennt die Gruppen sichtbar weiter, als in ihnen Abstand steht", () => {
    const engster = Math.min(...Object.values(zwischenGruppen).map((a) => a!));
    for (const [stelle, abstand] of Object.entries(inGruppen)) {
      expect(abstand, stelle).not.toBeNull();
      expect(engster, stelle).toBeGreaterThanOrEqual(abstand! + 6);
    }
    // Und gegenueber den Menuepunkten, an denen der Bug es festmacht, ist es
    // ein Vielfaches.
    expect(engster).toBeGreaterThanOrEqual(
      4 * inGruppen["Menüpunkt → Menüpunkt"]!,
    );
  });

  /**
   * Name und Slogan bleiben dabei ein Paar: der Slogan steht naeher am Namen
   * als die Gruppen aneinander -- nur nicht mehr so nah, dass er an ihm
   * klebt.
   */
  it("hält Name und Slogan zusammen", () => {
    const slogan = inGruppen["Name → Slogan"]!;
    expect(slogan).toBeGreaterThan(3);
    expect(slogan).toBeLessThan(zwischenGruppen["Name → Reise"]!);
  });

  /**
   * Die Masse aus req-078 bleiben, wie sie sind -- gewachsen ist allein der
   * Abstand (die aufgeklappte Breite und der Slogan pruefen die Abschnitte
   * darueber).
   */
  it("lässt die Maße aus req-078 unberührt", () => {
    expect(px(rule(css, ".eintrag"), "font-size")).toBe(13);
    expect(px(rule(css, ".eintrag"), "min-height")).toBe(44);
    expect(px(rule(css, ".spur"), "--leiste-breite-offen")).toBe(320);
    expect(px(rule(css, ".slogan"), "font-size")).toBe(21);
  });

  /**
   * Mehr Abstand darf die Leiste nicht aus dem Bild treiben (stack.md,
   * Bildschirmbreiten, Regel 3). Bei der Hoehe, mit der die E2E-Pruefung
   * misst (900 px, siehe tests/e2e/screen-check.ts), steht die volle Leiste
   * darin -- mit allen Bereichen, dem Begleiter und dem Fuss des
   * Gesamt-Admins.
   */
  it("passt mit dem größeren Abstand weiterhin ganz auf den Schirm", () => {
    const zeile = px(rule(css, ".eintrag"), "min-height")!;
    const innen = px(rule(css, ".tafel"), "padding")!;
    // Der Kopf ist so hoch wie sein groesstes Kind: der Schalter oder, offen,
    // Name und Slogan untereinander.
    const wordmark = rule(css, ".wordmark");
    const kopf = Math.max(
      px(rule(css, ".schalter"), "height")!,
      px(wordmark, "font-size")! * zahl(wordmark, "line-height")! +
        inGruppen["Name → Slogan"]! +
        px(rule(css, ".slogan"), "font-size")! *
          zahl(rule(css, ".slogan"), "line-height")!,
    );
    // Bereiche, darunter der Begleiter -- am Fuss "Mein Bereich", die
    // "Verwaltung" des Gesamt-Admins und das Abmelden.
    const bereiche = PLAN_AREAS.length + 1;
    const amFuss = 3;
    const liste = (anzahl: number, abstand: number) =>
      anzahl * zeile + (anzahl - 1) * abstand;

    const hoehe =
      2 * innen +
      kopf +
      zwischenGruppen["Name → Reise"]! +
      zeile + // die Reisewahl (reisewahl.module.css, .tripButton)
      zwischenGruppen["Reise → Bereiche"]! +
      liste(bereiche, inGruppen["Menüpunkt → Menüpunkt"]!) +
      zwischenGruppen["Bereiche → Fuß"]! +
      px(rule(css, ".fuss"), "padding-top")! +
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
