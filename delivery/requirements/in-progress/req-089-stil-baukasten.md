---
id: req-089
title: Stil-Baukasten und gemeinsame Design-Tokens
app: wegfara
area: Planung
priority: hoch
created: 2026-10-26
---

# Goal (Why)

Die Oberfläche passt nicht — am deutlichsten auf dem iPad, aber die
Ursache liegt tiefer. Es gibt keine gemeinsame Stil-Grundlage: 68
CSS-Module bestimmen jedes für sich, wie ein Knopf, eine Kachel oder ein
Abstand aussieht. Dieselben Farben stehen mehrfach, und **kein einziges
Modul reagiert auf die Bildschirmbreite**.

Gemessen am 26.10.2026:

| Befund | Zahl |
|---|---|
| CSS-Module | 68 |
| Gemeinsame Token-Datei | keine (`app/globals.css` hat 12 Zeilen, 0 Tokens) |
| `--card: #131730` einzeln definiert | 5× |
| `--page`, `--deep` einzeln definiert | 5× bzw. 3× |
| Module mit einem Breiten-Breakpoint | **0 von 68** |

Solange jede Ansicht ihre Maße selbst erfindet, ist jede Korrektur eine
Einzelkorrektur: bug-051 (Kontrast), bug-058 (Abstände in der
Seitenleiste), bug-059 (Routenfarbe), bug-069, bug-070 (Pillenhöhe) —
alle gleicher Bauart, alle an einer Stelle behoben, während die
Schwesterstelle blieb.

Als Entwickler brauche ich eine Seite, auf der jeder Baustein **bei allen
drei Breiten gleichzeitig** zu sehen ist. Dann wird vor dem Bauen
entschieden, wie etwas bei 375, 768 und 1280 px aussieht — und nicht
hinterher je Ansicht nachgebessert.

Vorbild ist der Baukasten von Knipsa
(`delivery/design/design 1.0/baukasten/`): eine Katalogseite, die eine
gemeinsame Stil-Datei einbindet und jeden Baustein einmal zeigt.

# Function (What)

Dieses Requirement liefert **die Grundlage und den Katalog**. Die
Umstellung der bestehenden 68 Module folgt danach Bereich für Bereich in
eigenen Requirements — keines dieser Module wird hier angefasst.

## 1. Die gemeinsame Stil-Datei

Eine Datei trägt die Design-Tokens für den Planer, dort, wo sie alle
Ansichten erreicht. Die Werte werden **nicht neu erfunden**: Sie kommen
aus `app/plan/plan-view.module.css`, wo der vollständige Satz heute schon
steht (`--page`, `--deep`, `--card`, `--card-alt`, `--acc`, `--text` bis
`--text-4`, `--bd`, `--pos`, `--neg` und die übrigen). Sie wandern
unverändert dorthin und werden an ihren alten Stellen entfernt.

Dazu kommen die Maße, die es heute **nicht** als Token gibt und die
deshalb überall als Zahl stehen:

- **Abstände** als Stufenleiter (4, 8, 12, 16, 24, 32 px)
- **Radien**, **Schriftgrößen** und **Zeilenhöhen** je Stufe
- **Tippziel** 44 px als benannter Wert (`stack.md`, Regel 4)
- **Die drei Breiten** 375, 768, 1280 px als benannte Breakpoints

Der Begleiter behält seine eigene Farbschicht
(`app/go/theme.module.css`): Er hat **wählbare Themes** (`lib/theme/`)
und ist hell, wo der Planer dunkel ist. Gemeinsam genutzt werden
Abstände, Radien, Schriftstufen und die Breakpoints — nicht die Farben.

## 2. Die Katalogseite

Eine Seite im Planer zeigt jeden Baustein. Sie ist **für die
Entwicklung**, nicht für Reisende: erreichbar unter einem eigenen Pfad,
nur für den Gesamt-Admin.

Sie zeigt: Farben und Schriftstufen, Knöpfe in allen Zuständen
(gewöhnlich, betont, abgeschaltet, mit Symbol), Felder mit Beschriftung
und Fehlertext, Umschalter und Filter, Kacheln, Meldungen (Hinweis,
Erfolg, Fehler), Pillen und Plaketten, Dialoge, Listen und Tabellen,
Fortschritt, die Seitenleiste in beiden Zuständen.

**Der Unterschied zum Knipsa-Baukasten:** Jeder Baustein ist dort
**gleichzeitig bei 375, 768 und 1280 px** zu sehen, nebeneinander in
Rahmen der jeweiligen Breite. Genau das ist der Zweck — bei Knipsa zeigt
der Katalog jeden Baustein nur einmal in der aktuellen Fensterbreite.

## 3. Die Prüfung ausweiten

`tests/e2e/screen-check.ts` prüft schon gegen die vier Regeln aus
`stack.md`, bei genau diesen drei Breiten, und `tests/e2e/fixtures.ts`
hängt sie automatisch an jedes `page.goto`. Sie hat einen blinden Fleck:

Sie läuft **nur bei `goto`**. Zustände ohne eigene Adresse — offene
Dialoge, aufgeklappte Seitenleiste, ausgefüllte Formulare, offene
Dropdowns — werden bei **keiner** Breite geprüft. Und per `goto` geöffnet
werden heute nur `/anmeldung`, `/einladung`, `/go` und `/plan`.

Die Prüfung wird deshalb **auch von Hand aufrufbar**, nicht nur
automatisch bei `goto`. Die Katalogseite selbst wird bei allen drei
Breiten geprüft — ein Baukasten, der die eigenen Regeln bricht, ist
keiner.

# GUI

- Vorbild: `delivery/design/design 1.0/baukasten/stil.html` von Knipsa —
  Aufbau und Gliederung, nicht die Farben.
- Verbindlichkeit: der Aufbau locker, die Werte streng. Die Tokens sind
  die bestehenden aus `plan-view.module.css`; es wird keine Farbe
  erfunden und keine geändert.
- Die Katalogseite selbst erfüllt die vier Regeln aus `stack.md` bei 375,
  768 und 1280 px.
- Kontrast nach `lib/design/kontrast.ts`: jede Schriftstufe auf der
  Fläche, auf der sie im Katalog steht, mindestens 4,5:1 (3:1 für große
  Schrift).

# Acceptance Criteria

- [x] Gegeben die Stil-Datei, wenn ich sie ansehe, dann stehen dort alle
      Farb-Tokens, die heute in `plan-view.module.css` stehen — mit
      denselben Werten.
- [ ] Gegeben die Stil-Datei, wenn ich sie ansehe, dann stehen dort
      Abstände, Radien, Schriftstufen, das Tippziel von 44 px und die
      drei Breakpoints als benannte Werte.
- [x] Gegeben die Tokens sind in die Stil-Datei gewandert, wenn ich
      `app`, `components` und `lib` durchsuche, dann ist `--card` genau
      **einmal** definiert — und `--page`, `--deep`, `--acc` ebenso (die
      Farbschicht des Begleiters ausgenommen).
- [x] Gegeben der Planer, wenn ich ihn nach der Umstellung ansehe, dann
      sieht er aus wie vorher — es ändert sich kein Pixel.
- [ ] Gegeben ich bin Gesamt-Admin, wenn ich die Katalogseite aufrufe,
      dann sehe ich die Bausteine.
- [ ] Gegeben ich bin nicht Gesamt-Admin, wenn ich die Katalogseite
      aufrufe, dann sehe ich sie NICHT.
- [ ] Gegeben die Katalogseite, wenn ich einen Baustein ansehe, dann sehe
      ich ihn gleichzeitig bei 375, 768 und 1280 px.
- [ ] Gegeben die Katalogseite, wenn ich sie ansehe, dann sind Knöpfe
      auch im abgeschalteten Zustand zu sehen — nicht nur im
      gewöhnlichen.
- [ ] Gegeben die Katalogseite, wenn ich die Seitenleiste darauf ansehe,
      dann sehe ich sie eingeklappt UND aufgeklappt.
- [ ] Gegeben die Katalogseite bei 375, 768 und 1280 px, wenn die
      Bildschirmprüfung läuft, dann ist sie grün.
- [ ] Gegeben ein Zustand ohne eigene Adresse (ein offener Dialog), wenn
      der E2E-Fluss die Prüfung von Hand aufruft, dann wird dieser
      Zustand bei allen drei Breiten geprüft.
- [ ] Gegeben ein Baustein verletzt eine der vier Regeln, wenn die
      Prüfung läuft, dann schlägt sie fehl und nennt Baustein, Breite und
      Regel.

# Constraints

- **Kein bestehendes Modul wird in diesem Requirement umgestellt.** Nur
  die Token-Definitionen wandern an eine Stelle; `var(--card)` und
  dergleichen bleiben unverändert und greifen danach auf die gemeinsame
  Datei zu. Die Umstellung der Bausteine folgt je Bereich einzeln.
- Der Planer sieht nach diesem Requirement genau aus wie davor. Es ist
  eine Umstellung ohne sichtbare Wirkung — das ist die Bedingung dafür,
  dass sie gefahrlos ist.
- Die drei Breiten stehen an **einer** Stelle, gemeinsam genutzt von CSS
  und Tests. `SCREEN_WIDTHS_PX` in `tests/e2e/screen-check.ts` nennt sie
  heute schon; eine zweite Liste darf nicht entstehen (vgl. req-082, wo
  dasselbe Raster dreimal stand). Dasselbe gilt für die Breiten, die
  `lib/plan/viewport.ts` und `lib/plan/spalten.ts` seit req-088 nennen.
- Die Katalogseite ist kein Reiseinhalt: kein Eintrag in der
  Seitenleiste, keine Reise nötig, keine Daten aus der Datenbank.
- Die bestehenden 32 `*.layout.test.ts` müssen unverändert grün bleiben.
  Sie lesen CSS als Text und kennen die heutigen Selektoren.

# Out of Scope

- Die 68 Module auf die Bausteine umstellen — je Bereich ein eigenes
  Requirement danach.
- Den Planer schmal machen (das ist req-088) oder den Begleiter breit.
- Farben, Schriften oder Abstände ändern. Hier wird nur zusammengetragen,
  was es gibt. Was dabei als unstimmig auffällt, wird notiert, nicht
  behoben.
- Helles Thema für den Planer.
- Die Themes des Begleiters umbauen.
- Den gedruckten Reiseplan (req-080) — der hat eine eigene
  Gestaltungswelt und bleibt davon unberührt.

# Notes

Beim Zusammentragen aufgefallen -- notiert, nicht behoben (Out of Scope):

- Die Stil-Datei ist `lib/design/stil.ts`, kein Stylesheet: CSS und Tests
  brauchen dieselben Werte. Das Root-Layout schreibt sie als `<style>` in
  jede Seite (`components/stil-blatt.tsx`); die fünf früheren Träger holen
  die Farbwelt mit `composes: farbwelt-planer from global;` an ihre Wurzel.
  Die Farbwelt hängt an einer Klasse, nicht an `:root` -- sonst bekäme der
  Begleiter sie mit, und die Bereichsleiste dort sähe anders aus.
- Die Verwaltung (`/plan/accounts`) trug nur einen Teil der Farbwelt; es
  fehlten `--hint-bg` und `--hint-fg`. Der Hinweis „Mail ging nicht hinaus“
  im Einladungsfeld (`components/cards.module.css`, `.notice`) stand dort
  deshalb ohne Hinweisgrund. Mit der gemeinsamen Farbwelt bekommt er ihn --
  die einzige sichtbare Wirkung der Umstellung, und nicht im Planer.
- `components/auth-panel.module.css` führt als einziges Blatt `--warn`
  (#e8a87c); es bleibt dort.
- „Mein Bereich“ verletzt Regel 4 aus `stack.md` bei allen drei Breiten
  (Knöpfe 33–35 px hoch, Ankreuzbox 13 px, Stift 28 px).
