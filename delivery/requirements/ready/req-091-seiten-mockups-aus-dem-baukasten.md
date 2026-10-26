---
id: req-091
title: Seiten-Mockups aus dem Baukasten, je Gerätebreite
app: wegfara
area: Planung
priority: normal
created: 2026-10-26
---

# Goal (Why)

Der Stil-Baukasten (req-089) zeigt die Bausteine einzeln. Das genügt
nicht, um zu sehen, ob eine **Seite** auf einem Gerät funktioniert: Ein
Knopf kann für sich richtig sein und trotzdem im Kopf einer Ansicht
neben vier anderen keinen Platz haben — genau das war bug-063.

Als Reiseleiter will ich **vor** dem Bauen sehen, wie jede Seite bei 375,
768 und 1280 px aussieht. Heute entsteht das Gegenteil: Die Ansicht wird
gebaut, dann fällt auf dem iPad etwas auf, dann folgt ein Bug. Diese
Kette ist belegt — bug-058, bug-059, bug-063, bug-069, bug-070.

Vorbild ist Knipsa. Dort liegen neben dem Katalog inzwischen
**Seiten-Mockups** im selben Ordner (`cockpit.html`, `import.html`), und
die entscheidende Regel steht als Kommentar in der Datei:

> „Diese Seite hat absichtlich KEIN eigenes CSS: alles kommt aus
> baukasten.css."

Das ist der Kern. Ein Mockup, das eigene Stile mitbringt, kann vom Stil
abweichen — und tut es dann auch. Ein Mockup, das nur Bausteine
zusammensetzt, kann es nicht.

Für wegfara ist der Umfang grösser als bei Knipsa: 11 Routen, und `/plan`
trägt allein sieben Bereiche. Dazu zwei Gestaltungswelten — der Planer
dunkel, der Begleiter hell mit wählbaren Themes.

# Function (What)

Für jede Seite entsteht ein Mockup als HTML-Datei neben dem Baukasten.
Sie zeigt die Seite **mit echten Inhalten** und **ohne eigenes CSS**.

## Die eiserne Regel

Ein Seiten-Mockup bindet die Stil-Datei aus req-089 ein und **sonst
nichts**. Kein `<style>`-Block, keine eigene Klasse, keine Farbe und
keine Zahl in der Datei selbst.

Fehlt ein Baustein, wird er **im Katalog ergänzt** — nicht in der Seite
erfunden. Dieser Zwang ist der Zweck: Was in den Mockups entsteht, ist
damit automatisch das, was die App später baut.

## Welche Seiten

**Planer** (dunkel), je Bereich eine Datei:

| Seite | |
|---|---|
| POIs | mit Sammlung und Karte |
| Planung | Zeitstrahl mit Tagesroute |
| Bewertungen | laufende Runde |
| Kosten | Aufstellung und Ausgleich |
| Dokumente | |
| Reisedetails | Formular |
| Chat | mit Modellauswahl |
| Accounts | Verwaltung (Gesamt-Admin) |
| Keine Reise | der leere Anfang |

**Begleiter** (hell): Plan, Karte, Kosten, Dokumente, Meldungen,
Concierge, Wer fährt mit, das Menü „Mehr".

**Gemeinsam:** Anmeldung, Einladung, Passkey einrichten,
Ersteinrichtung, Mein Bereich.

## Je Seite drei Breiten

Jedes Mockup ist bei **375, 768 und 1280 px** zu beurteilen. Nicht
dreimal dieselbe Datei, sondern eine Datei, die sich bei diesen Breiten
richtig verhält — so wie die App es tun muss.

Welche Breiten für welche Seite gelten, folgt der App: Der Planer läuft
ab 768 px (req-088), darunter steht der Hinweis auf den Begleiter. Ein
Planer-Mockup bei 375 px zeigt deshalb **diesen Hinweis**, nicht eine
gequetschte Ansicht.

Die Breiten sind die aus `stack.md`. Die Werte von Knipsa (699/1099 px)
werden **nicht** übernommen — wegfara prüft gegen andere.

## Echte Inhalte

Gefüllt wird mit den Daten einer wirklichen Reise, wie beim gedruckten
Reiseplan (req-080): „30 Johr zämma – Rothenburg". An erfundenen
Kurztexten lässt sich nicht sehen, ob die Gestaltung mit wirklichen
Längen zurechtkommt — das war beim Druck-Mockup die nützlichste
Entscheidung.

Dazu gehören die unbequemen Fälle, denn sie brechen die Gestaltung:
ein sehr langer POI-Name, ein Tag mit zehn Programmpunkten, eine
Options-Gruppe, ein Betrag mit fünf Stellen, ein leerer Zustand.

## Die Prüfung im Mockup

Knipsa hat dafür ein kleines Skript (`_pruef.js`, `kb.pruefeLayout()`):
Es meldet im Browser, wenn die Seite scrollt, wenn ein Rollbalken
ausserhalb einer Box auftaucht oder die Fussleiste zu hoch wird. Über
den URL-Hash lassen sich Zustände herstellen (`#zustand=`, `#klick=`),
damit auch ein offener Dialog prüfbar ist.

Das wird übernommen und auf die **vier Regeln aus `stack.md`** gebracht
— dieselben, gegen die `tests/e2e/screen-check.ts` die App prüft. Die
Regeln stehen damit an einer Stelle und gelten für Mockup und App gleich.

## Die Reihenfolge

Die Mockups entstehen **nacheinander, nicht alle zugleich**: erst
Planung und Plan (Begleiter) — die beiden Ansichten, in denen die meiste
Zeit vergeht —, dann die übrigen. Nach jeder Seite ist zu sehen, ob der
Baukasten trägt oder ob ihm etwas fehlt.

# GUI

- Ablage: neben dem Baukasten aus req-089, eine Datei je Seite.
- Vorbild für Aufbau und Dateinamen:
  `../knipsa/delivery/design/design 1.0/baukasten/cockpit.html`.
- Verbindlichkeit: die Regel „kein eigenes CSS" ist bindend. Alles
  andere ist Gestaltung und darf sich entwickeln.
- Die Mockups folgen den bestehenden Vorlagen, wo es sie gibt:
  `delivery/design/planer/Reiseplaner v4.dc.html` für den Planer,
  `delivery/design/design 1.0/Reise Companion.dc.html` für den
  Begleiter. Sie ersetzen diese nicht, sondern führen sie je Seite
  und Breite aus.
- Jedes Mockup erfüllt die vier Regeln aus `stack.md` bei den für seine
  Ansicht geltenden Breiten.

# Acceptance Criteria

- [ ] Gegeben ein Seiten-Mockup, wenn ich seine Datei ansehe, dann
      enthält sie keinen `<style>`-Block und keine eigene Klasse — nur
      Bausteine und die eingebundene Stil-Datei.
- [ ] Gegeben ein Seiten-Mockup, wenn ich es bei 375, 768 und 1280 px
      öffne, dann ragt bei keiner Breite etwas über den Rand und die
      Seite lässt sich nicht seitlich scrollen.
- [ ] Gegeben ein Mockup des Planers bei 375 px, wenn ich es öffne, dann
      zeigt es den Hinweis auf den Begleiter — nicht eine gequetschte
      Planer-Ansicht.
- [ ] Gegeben ein Mockup, wenn ich es öffne, dann steht darin die
      Layout-Prüfung und meldet „OK" oder nennt die Verstösse mit Regel
      und Breite.
- [ ] Gegeben ein Mockup mit einem Dialog, wenn ich seinen Zustand über
      den URL-Hash herstelle, dann wird auch dieser Zustand geprüft.
- [ ] Gegeben die Mockups der Planung und des Plans, wenn ich sie ansehe,
      dann sind sie mit den Daten der Reise „30 Johr zämma – Rothenburg"
      gefüllt.
- [ ] Gegeben ein Mockup mit einer Liste, wenn ich es ansehe, dann
      enthält es einen sehr langen Namen UND einen leeren Zustand.
- [ ] Gegeben ein Baustein fehlte und wurde gebraucht, wenn ich den
      Katalog aus req-089 danach ansehe, dann steht er dort — und nicht
      nur im Mockup.
- [ ] Gegeben alle Mockups, wenn ich sie durchgehe, dann gibt es je
      Planer-Bereich, je Begleiter-Ansicht und je gemeinsamer Seite eine
      Datei.
- [ ] Gegeben ein Mockup des Begleiters, wenn ich es ansehe, dann trägt
      es die helle Gestaltungswelt — nicht die dunkle des Planers.

# Constraints

- **Setzt req-089 voraus.** Ohne Stil-Datei und Katalog gibt es keine
  Bausteine, aus denen sich eine Seite zusammensetzen lässt. Die Mockups
  entstehen danach, nicht gleichzeitig.
- Kein Mockup bringt eigene Stile mit. Das ist nicht nur Empfehlung: Ein
  Mockup mit eigenem CSS gilt als nicht fertig.
- Die drei Breiten und die vier Regeln kommen aus `stack.md` und stehen
  an einer Stelle, gemeinsam mit `tests/e2e/screen-check.ts`. Es
  entsteht keine zweite Liste (vgl. req-082).
- Die Mockups sind **Entwurf, nicht Anwendung**: reines HTML, kein React,
  keine Datenbank, kein Server. Sie liegen unter `delivery/`, nicht unter
  `app/`.
- Sie ersetzen die bestehenden Vorlagen nicht. `Reiseplaner v4.dc.html`
  und `Reise Companion.dc.html` bleiben als Herkunft liegen.
- Was beim Bauen als unstimmig auffällt, wird notiert, nicht behoben. Ein
  Mockup ist der Ort, an dem solche Fragen sichtbar werden — geändert
  wird die App in eigenen Requirements.

# Out of Scope

- Die 68 CSS-Module der App auf die Bausteine umstellen — das folgt je
  Bereich einzeln, nach req-089.
- Den Baukasten selbst bauen (req-089).
- Den gedruckten Reiseplan (req-080). Er hat eine eigene
  Gestaltungswelt, hell und ohne die Tokens des Planers, und bleibt
  unberührt.
- Die Themes des Begleiters je Mockup durchspielen. Ein Mockup zeigt das
  vorgewählte Thema.
- Aufnahmen (Screenshots) der Mockups erzeugen oder versionieren.
- Die Mockups in die laufende Anwendung einbinden oder ausliefern.
