// ERZEUGT von scripts/baukasten-export.mjs (`npm run baukasten`) --
// nicht von Hand aendern. Quellen: lib/design/bildschirm-regeln.ts,
// lib/design/mockup-pruefung.ts, lib/design/stil.ts.
(function () {
"use strict";
/**
 * Die vier Regeln aus delivery/stack.md, Abschnitt "Bildschirmbreiten"
 * (req-049), als Pruefung im Browser -- an genau einer Stelle fuer die App und
 * die Seiten-Mockups (req-091). Die E2E-Tests schleusen `sammleVerstoesse` per
 * `page.evaluate` in die geoeffnete Seite (tests/e2e/screen-check.ts); die
 * Mockups unter delivery/design/baukasten/ tragen dieselbe Funktion in ihrem
 * Pruefskript (pruef.js, erzeugt von scripts/baukasten-export.mjs).
 *
 * `sammleVerstoesse` muss deshalb fuer sich stehen: kein Zugriff auf
 * aeusseren Zustand, keine Importe -- alles Noetige steht im DOM oder kommt
 * als Argument.
 */

/**
 * Feste Hoehe des Fensters fuer die Pruefung -- die Breite ist es, worauf es
 * ankommt. Die E2E-Tests setzen sie als Sichtfenster, die Mockups als Hoehe
 * ihrer Pruefrahmen.
 */
const PRUEF_HOEHE_PX = 900;

                                                                            

const REGEL_TEXT                        = {
  rand: "Nichts steht über den Rand",
  ueberlappung: "Nichts überlappt",
  erreichbarkeit: "Alles Bedienbare ist erreichbar",
  tippziel: "Tippziele sind mindestens 44×44 px groß",
};

                           
               
                                                                           
                  
                       
 

/**
 * Sammelt die Verstoesse der vier Regeln gegen die aktuell gerenderte Seite,
 * bei der Breite, die das Fenster gerade hat.
 */
function sammleVerstoesse(MIN_TIPPZIEL        )             {
  const gefunden                                                             =
    [];

  function istSichtbar(el         )          {
    const stil = getComputedStyle(el);
    if (stil.display === "none" || stil.visibility === "hidden") return false;
    if (el.closest('[aria-hidden="true"]')) return false;
    return true;
  }

  /**
   * MapLibre-Marker (POIs, Aktivitaeten): eigene Bibliothek, eigene
   * Groessen- und Positionslogik ohne Kollisionsvermeidung -- POIs am
   * selben Ort ueberlappen dort bewusst. Sie gehoeren nicht zu den
   * Formularen und Knoepfen, um die es in diesem Requirement geht.
   */
  function istKartenMarker(el         )          {
    return el.closest(".maplibregl-marker") !== null;
  }

  /**
   * Die Bedienelemente, die MapLibre selbst in die Karte setzt: der
   * Herkunftsnachweis ("© MapLibre", "© OpenStreetMap") und sein
   * Umschalter. Sie stammen aus der Bibliothek, nicht aus dieser
   * Anwendung -- ihre Groesse laesst sich nicht aendern, ohne den
   * Nachweis zu verfaelschen, und OpenStreetMap verlangt ihn (siehe
   * delivery/stack.md). Sie liegen zudem fest in der Ecke der Karte und
   * geraten dort unter jeden Knopf, der darueber schwebt.
   *
   * Die Regeln aus req-049 gelten den Formularen und Knoepfen dieser
   * Anwendung; was eine fremde Bibliothek beitraegt, laesst sich damit
   * nicht pruefen.
   */
  function istKartenSteuerung(el         )          {
    return el.closest(".maplibregl-ctrl") !== null;
  }

  /**
   * Eine Trefferflaeche, die selbst nichts zeichnet (opacity: 0) -- etwa
   * das unsichtbare Eingabefeld hinter einer Ankreuzbox
   * (components/tippziel-checkbox.tsx). Solche Flaechen duerfen groesser
   * sein als das Sichtbare und einander ueberlagern (bug-029): sie schieben
   * dichte Zeilen sonst auf 44px auseinander. Fuer Regel 2 zaehlen sie
   * deshalb nicht mit -- was man nicht sieht, kann nichts verdecken. Dass
   * sie sich gegenseitig nicht unbedienbar machen, prueft Regel 3: dort
   * muss jedes Bedienelement an seiner eigenen Mittelposition obenauf
   * liegen.
   */
  function zeichnetNichts(el         )          {
    return getComputedStyle(el).opacity === "0";
  }

  /**
   * Ob der Nutzer in diesem Element selbst rollen kann: eine Leiste mit
   * "overflow: auto" oder "scroll", die mehr Inhalt hat als Platz -- etwa
   * die Reisetage des Begleiters oder die Karten einer Options-Gruppe. Bei
   * "overflow: hidden" kann er es nicht: was dort hinausragt, bekommt er nie
   * zu sehen, auch wenn scrollIntoView es programmatisch hereinholen wuerde.
   */
  function rollbarVomNutzer(el         , achse           )          {
    const stil = getComputedStyle(el);
    const ueberlauf = achse === "x" ? stil.overflowX : stil.overflowY;
    if (ueberlauf !== "auto" && ueberlauf !== "scroll") return false;
    return achse === "x"
      ? el.scrollWidth > el.clientWidth + 1
      : el.scrollHeight > el.clientHeight + 1;
  }

  /**
   * Wo die Mitte eines Bedienelements von einem Vorfahren abgeschnitten
   * wird: der erste, dessen Kasten sie nicht enthaelt, samt Achse und der
   * Frage, ob der Nutzer dort rollen kann.
   */
  function abgeschnittenVon(
    el         ,
  )                                                                   {
    const r = el.getBoundingClientRect();
    const mx = r.left + r.width / 2;
    const my = r.top + r.height / 2;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const stil = getComputedStyle(p);
      const k = p.getBoundingClientRect();
      if (stil.overflowX !== "visible" && (mx < k.left || mx > k.right)) {
        return { vorfahre: p, achse: "x", rollbar: rollbarVomNutzer(p, "x") };
      }
      if (stil.overflowY !== "visible" && (my < k.top || my > k.bottom)) {
        return { vorfahre: p, achse: "y", rollbar: rollbarVomNutzer(p, "y") };
      }
    }
    return null;
  }

  /**
   * Rollt ein Bedienelement senkrecht ins Bild -- in jeder rollenden Flaeche
   * darum und zuletzt im Fenster selbst. Bewusst nur senkrecht und bewusst
   * ohne scrollIntoView: waagerecht wischen heisst in dieser Anwendung
   * bedienen (die Options-Gruppe uebernimmt die eingerastete Karte als
   * Wahl, siehe app/go/components/activity-option-group.tsx), und die
   * Pruefung bedient nicht. Senkrecht rollen loest nichts aus -- das tut
   * jeder Nutzer auf jeder Seite.
   */
  function rolleSenkrechtInsBild(el         )       {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (!rollbarVomNutzer(p, "y")) continue;
      const k = p.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      p.scrollTop += r.top + r.height / 2 - (k.top + p.clientHeight / 2);
    }
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      window.scrollBy(0, r.top + r.height / 2 - window.innerHeight / 2);
    }
  }

  /**
   * Der rollende Bereich, der ein Element gerade ganz aus dem Bild geschoben
   * hat -- etwa ein Programmpunkt unterhalb des sichtbaren Teils der
   * Tagesliste, ueber der Leiste am unteren Rand (req-091). Sein Rechteck
   * liegt dann zwar auf der Leiste, zu sehen ist dort aber nur die Leiste:
   * zwei Elemente koennen sich nur ueberlappen, wenn sie im selben
   * Ausschnitt stehen. Erreichbar muss es trotzdem sein -- das prueft
   * Regel 3, die es dafuer ins Bild rollt.
   */
  function ausgeblendetVon(el         , r         )                 {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const stil = getComputedStyle(p);
      if (stil.overflowX === "visible" && stil.overflowY === "visible") {
        continue;
      }
      const k = p.getBoundingClientRect();
      if (
        r.bottom <= k.top ||
        r.top >= k.bottom ||
        r.right <= k.left ||
        r.left >= k.right
      ) {
        return p;
      }
    }
    return null;
  }

  function istDeaktiviert(el         )          {
    return (
      "disabled" in el &&
      Boolean((el                                     ).disabled)
    );
  }

  function beschreibeElement(el         )         {
    const testid = el.getAttribute("data-testid");
    if (testid) return `[data-testid="${testid}"]`;
    const label = el.getAttribute("aria-label");
    if (label) return `${el.tagName.toLowerCase()}[aria-label="${label}"]`;
    const text = (el.textContent ?? "").trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${text ? ` "${text}"` : ""}`;
  }

  /**
   * Liegt das Element in einem Baustein des Baukastens (req-089), steht
   * dessen Name vorn -- die Meldung nennt dann Baustein, Breite und Regel.
   */
  function beschreibe(el         )         {
    const baustein = el
      .closest("[data-baustein]")
      ?.getAttribute("data-baustein");
    const element = beschreibeElement(el);
    return baustein ? `Baustein "${baustein}" › ${element}` : element;
  }

  // Regel 1: Nichts steht ueber den Rand -- die Seite laesst sich nicht
  // seitlich scrollen.
  const fensterBreite = window.innerWidth;
  if (document.documentElement.scrollWidth > fensterBreite + 1) {
    const kandidaten = Array.from(document.body.querySelectorAll("*")).filter(
      (el) => {
        if (!istSichtbar(el)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > fensterBreite + 1 || r.left < -1);
      },
    );
    const oberste = kandidaten.filter(
      (el) =>
        !kandidaten.some((andere) => andere !== el && andere.contains(el)),
    );
    const ziel = oberste[0] ?? document.body;
    gefunden.push({
      regel: "rand",
      element: beschreibe(ziel),
      beschreibung: `Seite ist ${document.documentElement.scrollWidth}px breit bei ${fensterBreite}px Sichtfenster`,
    });
  }

  // Offene Dialoge (role="dialog"/aria-modal): was dahinter liegt, ist
  // waehrend sie offen sind bewusst nicht erreichbar -- kein Verstoss.
  const dialoge = Array.from(
    document.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
  ).filter(istSichtbar);

  function hinterDialogVersteckt(el         )          {
    if (dialoge.length === 0) return false;
    return !dialoge.some((dialog) => dialog.contains(el));
  }

  const bedienbarSelektor =
    'button, a[href], input:not([type="hidden"]), select, textarea, ' +
    '[role="button"], [role="link"], [role="checkbox"], [role="radio"], ' +
    '[role="switch"], [role="tab"], summary';
  const bedienelemente = Array.from(
    document.querySelectorAll(bedienbarSelektor),
  ).filter((el) => {
    if (istKartenMarker(el)) return false;
    if (istKartenSteuerung(el)) return false;
    if (!istSichtbar(el)) return false;
    if (istDeaktiviert(el)) return false;
    if (hinterDialogVersteckt(el)) return false;
    return true;
  });

  // Alle Bedienelemente einmal ausmessen, ohne dabei zu rollen: nur so
  // liegen alle Rechtecke im selben Koordinatensystem, was der paarweise
  // Vergleich (Regel 2) voraussetzt. Zuvor wurde mitten in dieser Schleife
  // hingescrollt -- danach stimmten die zuvor genommenen Rechtecke nicht
  // mehr, und auf einer Seite, die laenger ist als das Sichtfenster, meldete
  // die Pruefung Bedienelemente als verdeckt, die es nicht waren (bug-057,
  // aufgefallen am Begleiter). Regel 4 braucht ohnehin nur die Groesse, und
  // die aendert sich beim Rollen nicht; Regel 3 rollt selbst, Element fuer
  // Element, und misst dabei frisch.
  const infos                                   = [];
  for (const el of bedienelemente) {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 || rect.width === 0) continue;
    infos.push({ el, rect });
  }

  // Regel 4: Tippziele sind mindestens 44x44 px gross.
  for (const { el, rect } of infos) {
    if (rect.width < MIN_TIPPZIEL - 0.5 || rect.height < MIN_TIPPZIEL - 0.5) {
      gefunden.push({
        regel: "tippziel",
        element: beschreibe(el),
        beschreibung: `${Math.round(rect.width)}×${Math.round(rect.height)}px`,
      });
    }
  }

  // Regel 2: Nichts ueberlappt -- paarweiser Vergleich der Bedienelemente,
  // ohne Vorfahren/Nachfahren-Paare, ohne Kartenmarker und ohne
  // Trefferflaechen, die nichts zeichnen (s.o.).
  const gemeldet = new Set        ();
  for (let i = 0; i < infos.length; i++) {
    for (let j = i + 1; j < infos.length; j++) {
      const a = infos[i];
      const b = infos[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      if (zeichnetNichts(a.el) || zeichnetNichts(b.el)) continue;
      if (ausgeblendetVon(a.el, a.rect) !== ausgeblendetVon(b.el, b.rect)) {
        continue;
      }
      const schnittBreite =
        Math.min(a.rect.right, b.rect.right) -
        Math.max(a.rect.left, b.rect.left);
      const schnittHoehe =
        Math.min(a.rect.bottom, b.rect.bottom) -
        Math.max(a.rect.top, b.rect.top);
      if (schnittBreite > 4 && schnittHoehe > 4) {
        const schluessel = [beschreibe(a.el), beschreibe(b.el)]
          .sort()
          .join("|");
        if (gemeldet.has(schluessel)) continue;
        gemeldet.add(schluessel);
        gefunden.push({
          regel: "ueberlappung",
          element: `${beschreibe(a.el)} und ${beschreibe(b.el)}`,
          beschreibung: `${Math.round(schnittBreite)}×${Math.round(schnittHoehe)}px Überlappung`,
        });
      }
    }
  }

  // Regel 3: Alles Bedienbare ist erreichbar -- am eigenen Mittelpunkt liegt
  // es selbst obenauf, nichts deckt es ab oder schneidet es ab. Sie kommt
  // zuletzt, weil sie rollt: jedes Element wird einzeln ins Bild geholt und
  // dort frisch gemessen, damit der Vergleich nicht an einem veralteten
  // Rechteck haengt.
  for (const { el } of infos) {
    const abschnitt = abgeschnittenVon(el);
    // Was der Nutzer mit dem Finger ins Bild wischt, ist erreichbar -- die
    // Reisetage des Begleiters oder die Karten einer Options-Gruppe stehen
    // absichtlich zum Teil ausserhalb ihrer Leiste. Gepruefte Elemente sind
    // die, die gerade im Bild stehen; die uebrigen sieht die Pruefung beim
    // naechsten Aufruf, wenn die Leiste anders steht.
    if (abschnitt && abschnitt.achse === "x" && abschnitt.rollbar) continue;
    // Was ein Vorfahre wegschneidet, ohne dass der Nutzer dort rollen kann
    // ("overflow: hidden"), bekommt er nie zu sehen.
    if (abschnitt && !abschnitt.rollbar) {
      gefunden.push({
        regel: "erreichbarkeit",
        element: beschreibe(el),
        beschreibung: `abgeschnitten von ${beschreibe(abschnitt.vorfahre)}`,
      });
      continue;
    }

    rolleSenkrechtInsBild(el);
    const rect = el.getBoundingClientRect();
    const cx = Math.min(
      Math.max(rect.left + rect.width / 2, 0),
      window.innerWidth - 1,
    );
    const cy = Math.min(
      Math.max(rect.top + rect.height / 2, 0),
      window.innerHeight - 1,
    );
    // Nur das Element selbst (oder etwas darin, z.B. ein Icon) zaehlt als
    // Treffer -- ein Vorfahre an dieser Stelle heisst, dass das Element dort
    // in Wahrheit gar nicht zu treffen ist.
    const oben = document.elementFromPoint(cx, cy);
    if (!oben || !(oben === el || el.contains(oben))) {
      gefunden.push({
        regel: "erreichbarkeit",
        element: beschreibe(el),
        beschreibung: oben
          ? `verdeckt durch ${beschreibe(oben)}`
          : "liegt außerhalb des sichtbaren Bereichs",
      });
    }
  }

  return gefunden              ;
}
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
const PRUEF_PARAMETER = "pruefbreite";

/** Kennung der Nachricht, mit der ein Pruefrahmen sein Ergebnis meldet. */
const PRUEF_NACHRICHT = "wegfara-mockup-pruefung";

                          
                      
                   
 

                                  
                 
                         
 

                                     
                             
                
                   
 

/** Liest `#zustand=a,b&klick=c` aus dem Hash der Adresse. */
function leseZustand(hash        )          {
  const teile = new URLSearchParams(hash.replace(/^#/, ""));
  function liste(name        )           {
    return teile
      .getAll(name)
      .flatMap((wert) => wert.split(","))
      .map((wert) => wert.trim())
      .filter((wert) => wert.length > 0);
  }
  return { zustaende: liste("zustand"), klicks: liste("klick") };
}

/** Stellt den Zustand im Dokument her -- zeigt, verbirgt und klickt. */
function stelleZustandHer(dokument          , zustand         )       {
  for (const el of Array.from(
    dokument.querySelectorAll             ("[data-zustand]"),
  )) {
    el.hidden = !zustand.zustaende.includes(el.dataset.zustand ?? "");
  }
  for (const id of zustand.klicks) {
    const ziel = dokument.getElementById(id);
    if (ziel) ziel.click();
  }
}

/** Eine Zeile je Verstoss: Regel, Breite, Element, Beschreibung. */
function meldeZeilen(ergebnisse                   )           {
  const zeilen           = [];
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
function zusammenfassung(ergebnisse                   )         {
  const anzahl = meldeZeilen(ergebnisse).length;
  const breiten = ergebnisse.map((e) => `${e.breite}`).join(", ");
  if (anzahl === 0) return `OK — geprüft bei ${breiten} px`;
  return anzahl === 1 ? "1 Verstoß" : `${anzahl} Verstöße`;
}

function pruefeImRahmen(einstellungen                    )       {
  stelleZustandHer(document, leseZustand(location.hash));
  // Erst nach dem Zeichnen messen. Bewusst kein requestAnimationFrame: ein
  // Rahmen ausserhalb des Bildes bekommt keine Frames.
  window.setTimeout(() => {
    const ergebnis                  = {
      breite: window.innerWidth,
      verstoesse: sammleVerstoesse(einstellungen.tippziel),
    };
    window.parent.postMessage({ art: PRUEF_NACHRICHT, ...ergebnis }, "*");
  }, 50);
}

/** Die Anzeige im Mockup. Sie traegt eigene Stile: sie gehoert nicht zur Seite. */
function baueAnzeige()   
                                                                             
  {
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

function pruefeOben(einstellungen                    )       {
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

  let rahmen                      = [];
  let ergebnisse                    = [];

  window.addEventListener("message", (ereignis              ) => {
    const daten = ereignis.data                                               ;
    if (!daten || daten.art !== PRUEF_NACHRICHT) return;
    // Nur die Rahmen des laufenden Durchgangs zaehlen.
    if (!rahmen.some((r) => r.contentWindow === ereignis.source)) return;
    ergebnisse.push({ breite: daten.breite, verstoesse: daten.verstoesse });
    if (ergebnisse.length < einstellungen.breiten.length) return;
    ergebnisse.sort((a, b) => a.breite - b.breite);
    anzeige.zeige("fertig", ergebnisse);
  });

  function pruefe()       {
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
function starteMockupPruefung(einstellungen                    )       {
  const imRahmen = new URL(location.href).searchParams.has(PRUEF_PARAMETER);
  const los = () =>
    imRahmen ? pruefeImRahmen(einstellungen) : pruefeOben(einstellungen);
  if (document.readyState === "complete") los();
  else window.addEventListener("load", los);
}
starteMockupPruefung({"breiten":[375,768,1280],"hoehe":900,"tippziel":44});
})();
