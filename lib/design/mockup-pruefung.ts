import {
  REGEL_TEXT,
  sammleVerstoesse,
  type Verstoss,
} from "./bildschirm-regeln";

/**
 * Die Layout-Pruefung der Seiten-Mockups (req-091). Jedes Mockup unter
 * delivery/design/baukasten/ bindet sie als pruef.js ein; das Skript wird von
 * scripts/baukasten-export.mjs aus dieser Datei und
 * lib/design/bildschirm-regeln.ts erzeugt. Die Regeln sind damit dieselben,
 * gegen die tests/e2e/screen-check.ts die App prueft.
 *
 * Ablauf im geoeffneten Mockup: es laedt sich selbst dreimal in unsichtbaren
 * Rahmen der Breiten aus delivery/stack.md (375, 768, 1280 px). Jeder Rahmen
 * stellt den Zustand aus dem URL-Hash her, prueft sich und meldet sein
 * Ergebnis per postMessage -- das geht auch, wenn die Datei ohne Server
 * (file://) geoeffnet ist. Das Mockup zeigt danach "OK" oder die Verstoesse
 * mit Regel und Breite.
 *
 * Zustaende ohne eigene Datei stellt der Hash her:
 * - `#zustand=name` zeigt jedes Element mit `data-zustand="name"`, alle
 *   uebrigen mit `data-zustand` bleiben verborgen (ein offener Dialog);
 * - `#klick=id` klickt das Element mit dieser id (eine aufgeklappte Leiste).
 * Mehrere Werte stehen durch Komma getrennt. Aendert sich der Hash, laeuft
 * die Pruefung neu -- ein Verweis auf `#zustand=…` oeffnet so den Dialog und
 * prueft ihn zugleich.
 *
 * Wie bildschirm-regeln.ts laeuft diese Datei im Browser und hat ausser den
 * Regeln keine Importe.
 */

/** Der Parameter, an dem ein Mockup erkennt, dass es selbst ein Pruefrahmen ist. */
export const PRUEF_PARAMETER = "pruefbreite";

/** Kennung der Nachricht, mit der ein Pruefrahmen sein Ergebnis meldet. */
export const PRUEF_NACHRICHT = "wegfara-mockup-pruefung";

export interface Zustand {
  zustaende: string[];
  klicks: string[];
}

export interface BreitenErgebnis {
  breite: number;
  verstoesse: Verstoss[];
}

export interface PruefEinstellungen {
  breiten: readonly number[];
  hoehe: number;
  tippziel: number;
}

/** Liest `#zustand=a,b&klick=c` aus dem Hash der Adresse. */
export function leseZustand(hash: string): Zustand {
  const teile = new URLSearchParams(hash.replace(/^#/, ""));
  function liste(name: string): string[] {
    return teile
      .getAll(name)
      .flatMap((wert) => wert.split(","))
      .map((wert) => wert.trim())
      .filter((wert) => wert.length > 0);
  }
  return { zustaende: liste("zustand"), klicks: liste("klick") };
}

/** Stellt den Zustand im Dokument her -- zeigt, verbirgt und klickt. */
export function stelleZustandHer(dokument: Document, zustand: Zustand): void {
  for (const el of Array.from(
    dokument.querySelectorAll<HTMLElement>("[data-zustand]"),
  )) {
    el.hidden = !zustand.zustaende.includes(el.dataset.zustand ?? "");
  }
  for (const id of zustand.klicks) {
    const ziel = dokument.getElementById(id);
    if (ziel) ziel.click();
  }
}

/** Eine Zeile je Verstoss: Regel, Breite, Element, Beschreibung. */
export function meldeZeilen(ergebnisse: BreitenErgebnis[]): string[] {
  const zeilen: string[] = [];
  for (const { breite, verstoesse } of ergebnisse) {
    for (const v of verstoesse) {
      zeilen.push(
        `${REGEL_TEXT[v.regel]} — bei ${breite} px: ${v.element} (${v.beschreibung})`,
      );
    }
  }
  return zeilen;
}

/** Was im Mockup zu lesen ist: "OK" oder die Zahl der Verstoesse. */
export function zusammenfassung(ergebnisse: BreitenErgebnis[]): string {
  const anzahl = meldeZeilen(ergebnisse).length;
  const breiten = ergebnisse.map((e) => `${e.breite}`).join(", ");
  if (anzahl === 0) return `OK — geprüft bei ${breiten} px`;
  return anzahl === 1 ? "1 Verstoß" : `${anzahl} Verstöße`;
}

function pruefeImRahmen(einstellungen: PruefEinstellungen): void {
  stelleZustandHer(document, leseZustand(location.hash));
  // Erst nach dem Zeichnen messen. Bewusst kein requestAnimationFrame: ein
  // Rahmen ausserhalb des Bildes bekommt keine Frames.
  window.setTimeout(() => {
    const ergebnis: BreitenErgebnis = {
      breite: window.innerWidth,
      verstoesse: sammleVerstoesse(einstellungen.tippziel),
    };
    window.parent.postMessage({ art: PRUEF_NACHRICHT, ...ergebnis }, "*");
  }, 50);
}

/** Die Anzeige im Mockup. Sie traegt eigene Stile: sie gehoert nicht zur Seite. */
function baueAnzeige(): {
  zeige: (stand: "laeuft" | "fertig", ergebnisse: BreitenErgebnis[]) => void;
} {
  const anzeige = document.createElement("aside");
  anzeige.setAttribute("data-pruefung", "");
  anzeige.setAttribute("aria-label", "Layout-Prüfung");
  Object.assign(anzeige.style, {
    position: "fixed",
    right: "8px",
    bottom: "8px",
    zIndex: "2147483647",
    boxSizing: "border-box",
    maxWidth: "min(420px, calc(100vw - 16px))",
    maxHeight: "40vh",
    overflow: "auto",
    padding: "8px 12px",
    borderRadius: "10px",
    font: "12px/1.4 system-ui, sans-serif",
    color: "#fff",
    background: "rgba(20, 20, 20, 0.88)",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
    cursor: "pointer",
  });
  const titel = document.createElement("strong");
  const ergebnis = document.createElement("span");
  ergebnis.setAttribute("data-pruefung-ergebnis", "");
  const liste = document.createElement("ul");
  Object.assign(liste.style, { margin: "6px 0 0", paddingLeft: "18px" });
  titel.textContent = "Layout-Prüfung: ";
  anzeige.append(titel, ergebnis, liste);
  // Ein Klick klappt die Liste ein, damit sie nichts von der Seite verdeckt.
  anzeige.addEventListener("click", () => {
    liste.hidden = !liste.hidden;
  });
  document.body.append(anzeige);

  return {
    zeige(stand, ergebnisse) {
      anzeige.setAttribute("data-stand", stand);
      if (stand === "laeuft") {
        ergebnis.textContent = "läuft …";
        liste.replaceChildren();
        return;
      }
      const zeilen = meldeZeilen(ergebnisse);
      anzeige.setAttribute("data-ergebnis", zeilen.length ? "verstoss" : "ok");
      anzeige.style.background = zeilen.length
        ? "rgba(150, 24, 24, 0.92)"
        : "rgba(20, 90, 50, 0.92)";
      ergebnis.textContent = zusammenfassung(ergebnisse);
      liste.replaceChildren(
        ...zeilen.map((zeile) => {
          const eintrag = document.createElement("li");
          eintrag.textContent = zeile;
          return eintrag;
        }),
      );
      for (const zeile of zeilen) console.warn(`Layout-Prüfung: ${zeile}`);
    },
  };
}

function pruefeOben(einstellungen: PruefEinstellungen): void {
  const anzeige = baueAnzeige();
  const buehne = document.createElement("div");
  buehne.setAttribute("aria-hidden", "true");
  Object.assign(buehne.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    pointerEvents: "none",
  });
  document.body.append(buehne);

  let rahmen: HTMLIFrameElement[] = [];
  let ergebnisse: BreitenErgebnis[] = [];

  window.addEventListener("message", (ereignis: MessageEvent) => {
    const daten = ereignis.data as (BreitenErgebnis & { art?: string }) | null;
    if (!daten || daten.art !== PRUEF_NACHRICHT) return;
    // Nur die Rahmen des laufenden Durchgangs zaehlen.
    if (!rahmen.some((r) => r.contentWindow === ereignis.source)) return;
    ergebnisse.push({ breite: daten.breite, verstoesse: daten.verstoesse });
    if (ergebnisse.length < einstellungen.breiten.length) return;
    ergebnisse.sort((a, b) => a.breite - b.breite);
    anzeige.zeige("fertig", ergebnisse);
  });

  function pruefe(): void {
    stelleZustandHer(document, leseZustand(location.hash));
    ergebnisse = [];
    buehne.replaceChildren();
    anzeige.zeige("laeuft", []);
    rahmen = einstellungen.breiten.map((breite) => {
      const ziel = new URL(location.href);
      ziel.searchParams.set(PRUEF_PARAMETER, String(breite));
      const r = document.createElement("iframe");
      r.width = String(breite);
      r.height = String(einstellungen.hoehe);
      r.title = `Prüfung bei ${breite} px`;
      r.tabIndex = -1;
      r.src = ziel.href;
      return r;
    });
    buehne.append(...rahmen);
  }

  window.addEventListener("hashchange", pruefe);
  pruefe();
}

/** Der Einstieg in pruef.js: prueft das Mockup oder -- im Rahmen -- sich selbst. */
export function starteMockupPruefung(einstellungen: PruefEinstellungen): void {
  const imRahmen = new URL(location.href).searchParams.has(PRUEF_PARAMETER);
  const los = () =>
    imRahmen ? pruefeImRahmen(einstellungen) : pruefeOben(einstellungen);
  if (document.readyState === "complete") los();
  else window.addEventListener("load", los);
}
