import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { BausteinSeite } from "./bausteine";
import { BAUSTEINE } from "@/lib/design/baukasten";
import { PLAN_AREAS } from "@/lib/plan/areas";
import {
  GEFORDERTE_ANSICHTEN,
  LEER_SELEKTOR,
  LISTEN_SELEKTOR,
  MOCKUP_ORDNER,
  MOCKUP_PRUEFUNG,
  MOCKUP_STIL,
  MOCKUPS,
  NAMEN_SELEKTOR,
  SEHR_LANG_ZEICHEN,
  type Mockup,
} from "@/lib/design/mockups";

/**
 * Die Seiten-Mockups (req-091), als Dateien gelesen. Was sie im Browser bei
 * 375, 768 und 1280 px tun, prueft tests/e2e/mockups.e2e.ts.
 */

const WURZEL = path.resolve(__dirname, "..", "..", "..");

function lies(relativ: string): string {
  return readFileSync(path.join(WURZEL, relativ), "utf8");
}

function dokument(mockup: Mockup): Document {
  return new DOMParser().parseFromString(
    lies(`${MOCKUP_ORDNER}/${mockup.datei}`),
    "text/html",
  );
}

function klassenIn(wurzel: ParentNode): Set<string> {
  const klassen = new Set<string>();
  for (const el of Array.from(wurzel.querySelectorAll("[class]"))) {
    for (const k of Array.from(el.classList)) klassen.add(k);
  }
  return klassen;
}

/** Die Klassen, die ein Stylesheet als Selektor nennt. */
function klassenImCss(css: string): Set<string> {
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selektoren = ohneKommentare.match(/[^{}]+(?=\{)/g) ?? [];
  const klassen = new Set<string>();
  for (const selektor of selektoren) {
    for (const [, k] of selektor.matchAll(/\.([A-Za-z][\w-]*)/g)) {
      klassen.add(k);
    }
  }
  return klassen;
}

const STIL = lies(`${MOCKUP_ORDNER}/${MOCKUP_STIL}`);
const PLANER_KLASSEN = klassenImCss(
  lies("app/plan/baukasten/bausteine.module.css"),
);
const BEGLEITER_KLASSEN = klassenImCss(
  lies("app/plan/baukasten/begleiter-bausteine.module.css"),
);

function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe.each(MOCKUPS.map((m) => [m.datei, m] as const))(
  "Seiten-Mockup %s (req-091)",
  (_datei, mockup) => {
    const doc = dokument(mockup);
    const quelltext = lies(`${MOCKUP_ORDNER}/${mockup.datei}`);

    it("bringt kein eigenes CSS mit -- keinen <style>-Block, kein style-Attribut", () => {
      expect(doc.querySelectorAll("style")).toHaveLength(0);
      expect(doc.querySelectorAll("[style]")).toHaveLength(0);
      expect(quelltext).not.toMatch(/<style[\s>]/i);
    });

    it("bindet nur die Stil-Datei und die Pruefung ein", () => {
      const verweise = Array.from(doc.querySelectorAll("link"));
      expect(verweise.map((l) => [l.rel, l.getAttribute("href")])).toEqual([
        ["stylesheet", MOCKUP_STIL],
      ]);
      const skripte = Array.from(doc.querySelectorAll("script"));
      expect(skripte.map((s) => s.getAttribute("src"))).toEqual([
        MOCKUP_PRUEFUNG,
      ]);
      expect(skripte[0].textContent).toBe("");
    });

    it("traegt keine eigene Klasse -- nur Bausteine aus der Stil-Datei", () => {
      const definiert = klassenImCss(STIL);
      const fremd = [...klassenIn(doc)].filter((k) => !definiert.has(k));
      expect(fremd).toEqual([]);
    });

    it("traegt die Gestaltungswelt seiner Ansicht", () => {
      const wurzel = doc.body.classList;
      const genutzt = [...klassenIn(doc)];
      if (mockup.welt === "begleiter") {
        // Hell: die Wurzel des Begleiters, kein Baustein des Planers.
        expect(wurzel.contains("goSeite")).toBe(true);
        expect(
          genutzt.filter(
            (k) => PLANER_KLASSEN.has(k) && !BEGLEITER_KLASSEN.has(k),
          ),
        ).toEqual([]);
      } else {
        // Dunkel: die Wurzel traegt die Farbwelt des Planers.
        expect(wurzel.contains("seite")).toBe(true);
        expect(genutzt.filter((k) => BEGLEITER_KLASSEN.has(k))).toEqual([]);
      }
    });

    if (mockup.welt === "planer") {
      it("zeigt unter 768 px den Hinweis auf den Begleiter statt des Planers", () => {
        const planer = doc.querySelector(".planer");
        const hinweis = doc.querySelector(".schmalHinweis");
        expect(planer).not.toBeNull();
        expect(hinweis).not.toBeNull();
        expect(planer!.contains(hinweis)).toBe(false);
        expect(text(hinweis!)).toMatch(/Begleiter/);
        const verweis = hinweis!.querySelector("a[href]");
        expect(verweis?.getAttribute("href")).toMatch(/^begleiter-.*\.html$/);
      });
    }

    if (doc.querySelector(LISTEN_SELEKTOR)) {
      it(`zeigt zu seiner Liste einen sehr langen Namen (ab ${SEHR_LANG_ZEICHEN} Zeichen) und einen leeren Zustand`, () => {
        const laengster = Math.max(
          ...Array.from(doc.querySelectorAll(NAMEN_SELEKTOR)).map(
            (el) => text(el).length,
          ),
        );
        expect(laengster).toBeGreaterThanOrEqual(SEHR_LANG_ZEICHEN);
        expect(doc.querySelector(LEER_SELEKTOR)).not.toBeNull();
      });
    }

    for (const zustand of mockup.zustaende ?? []) {
      it(`kennt den Zustand "${zustand}": verborgen, bis der Hash ihn herstellt`, () => {
        const elemente = doc.querySelectorAll(`[data-zustand="${zustand}"]`);
        expect(elemente.length).toBeGreaterThan(0);
        for (const el of Array.from(elemente)) {
          expect(el.hasAttribute("hidden")).toBe(true);
        }
        // Man kommt von Hand hinein.
        expect(
          doc.querySelector(`a[href="#zustand=${zustand}"]`),
        ).not.toBeNull();
      });
    }

    if (mockup.reiseRothenburg) {
      it("ist mit der Reise „30 Johr zämma – Rothenburg“ gefuellt", () => {
        const inhalt = text(doc.body);
        expect(inhalt).toContain("30 Johr zämma – Rothenburg");
        for (const station of [
          "Dornbirn",
          "Caffè Vittoria",
          "Hotel Markusturm",
          "Gaststuben im Zunfthaus der Schiffleute",
          "HerR Restaurant",
          "Nachtwächter Tour",
        ]) {
          expect(inhalt).toContain(station);
        }
      });
    }
  },
);

describe("Seiten-Mockups und Katalog (req-091)", () => {
  /**
   * Fehlt einem Mockup ein Baustein, wird er im Katalog ergaenzt -- nicht nur
   * im Mockup. Jede Klasse, die ein Mockup traegt, zeigt der Katalog also
   * auch selbst.
   */
  it("zeigt jeden Baustein, den ein Mockup nutzt, auch im Katalog", () => {
    const imKatalog = new Set<string>();
    for (const baustein of BAUSTEINE) {
      const { container, unmount } = render(
        <BausteinSeite id={baustein.id} zustand={baustein.zustand ?? null} />,
      );
      for (const k of klassenIn(document.body)) {
        // CSS-Module heissen im Test `_name_hash`.
        imKatalog.add(k.match(/^_([A-Za-z][\w-]*)_[0-9a-f]+$/)?.[1] ?? k);
      }
      expect(container).toBeTruthy();
      unmount();
    }

    const genutzt = new Set(
      MOCKUPS.flatMap((m) => [...klassenIn(dokument(m))]),
    );
    expect([...genutzt].filter((k) => !imKatalog.has(k)).sort()).toEqual([]);
  });

  it("liegen neben dem Baukasten, eine Datei je Seite", () => {
    const dateien = MOCKUPS.map((m) => m.datei);
    expect(new Set(dateien).size).toBe(dateien.length);
    for (const datei of dateien) expect(datei).toMatch(/^[a-z-]+\.html$/);
  });
});

describe("Seiten-Mockups -- je Seite eine Datei (req-091)", () => {
  function ansichten(welt: Mockup["welt"]): string[] {
    return MOCKUPS.filter((m) => m.welt === welt).map((m) => m.ansicht);
  }

  it("hat je Bereich des Planers eine Datei -- dazu Verwaltung und den leeren Anfang", () => {
    expect(ansichten("planer")).toEqual(
      expect.arrayContaining([
        ...PLAN_AREAS.map((bereich) => bereich.id),
        ...GEFORDERTE_ANSICHTEN.planer,
      ]),
    );
  });

  it("hat je Ansicht des Begleiters eine Datei", () => {
    expect(ansichten("begleiter")).toEqual(
      expect.arrayContaining([...GEFORDERTE_ANSICHTEN.begleiter]),
    );
  });

  it("hat je gemeinsamer Seite eine Datei", () => {
    expect(ansichten("gemeinsam")).toEqual(
      expect.arrayContaining([...GEFORDERTE_ANSICHTEN.gemeinsam]),
    );
  });

  it("fuehrt jede Datei im Ordner -- keine liegt ungeprueft daneben", () => {
    const imOrdner = readdirSync(path.join(WURZEL, MOCKUP_ORDNER))
      .filter((d) => d.endsWith(".html"))
      .sort();
    expect(imOrdner).toEqual(MOCKUPS.map((m) => m.datei).sort());
  });

  it("verweist nur auf Mockups, die es gibt", () => {
    const dateien = new Set(MOCKUPS.map((m) => m.datei));
    for (const mockup of MOCKUPS) {
      for (const a of Array.from(
        dokument(mockup).querySelectorAll("a[href]"),
      )) {
        const ziel = a.getAttribute("href")!;
        if (ziel.startsWith("#")) continue;
        expect(dateien, `${mockup.datei} → ${ziel}`).toContain(ziel);
      }
    }
  });
});
