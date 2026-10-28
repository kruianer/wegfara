---
id: req-095
title: Gegend am POI, zum Gruppieren und Filtern
app: wegfara
area: Planung
priority: normal
created: 2026-10-28
---

# Goal (Why)

Bei einer Reise mit mehreren Stationen — Bilbao, San Sebastián, Rioja —
sammeln sich POIs aus allen Gegenden in einer Liste. Als Reiseleiter will
ich sie zu Gegenden zusammenfassen und danach filtern: beim Durchsehen
der Sammlung und beim Planen eines Tages.

Der vorhandene **Ort** am POI (req-041) genügt dafür nicht. Er kommt aus
OpenStreetMap und nennt die *Ortschaft*: Ein POI in Getxo trägt „Getxo",
gehört in der Planung aber zu „Bilbao". Zwei Bodegas im Rioja Alavesa
liegen in verschiedenen Dörfern und sind für mich derselbe Block.

Die Gegend ist deshalb keine Ableitung, sondern eine Entscheidung des
Reiseleiters.

# Function (What)

## Die Gegend am POI

In den POI-Details steht ein Feld **Gegend**. Es lässt sich frei
eintippen, und die in dieser Reise schon vorhandenen Gegenden stehen als
Vorschlagsliste dabei — eine neue entsteht durch Eintippen, eine
vorhandene durch Auswählen.

Leer heißt: keine Gegend zugeordnet. Das ist der Normalfall für POIs, bei
denen es nicht nötig ist.

**Die Gegend gilt je Reise.** Derselbe Name in zwei Reisen sind zwei
Gegenden; gefiltert wird ohnehin nur innerhalb einer Reise.

## Es gibt keine Verwaltung der Gegenden

Eine Gegend existiert **genau so lange, wie mindestens ein POI sie
trägt**. Wird sie beim letzten POI entfernt, verschwindet sie aus allen
Listen — ohne Aufräumen, ohne verwaiste Zeile, ohne eigene Oberfläche.

Deshalb gibt es keine Tabelle für Gegenden und keine Stelle, an der man
sie anlegt, umbenennt oder löscht. Die Liste der Gegenden einer Reise ist
immer genau die Menge der tatsächlich verwendeten Namen.

## Aufräumen der Eingabe

Damit nicht zwei Schreibweisen als zwei Gegenden dastehen:

- Leerzeichen am Rand fallen weg, der leere Text wird zu „keine".
- Mehrfache Leerzeichen innen werden zu einem („Rioja  Alavesa" und
  „Rioja Alavesa" sind dieselbe Gegend).
- Groß- und Kleinschreibung entscheidet nicht: Wer „bilbao" tippt, kommt
  zu „Bilbao" dazu und legt keine zweite Gegend an.

## Filtern

An **zwei** Stellen, beide als Auswahlfeld neben den bestehenden Filtern:

| Stelle | |
|---|---|
| **POI-Liste** (Bereich POIs) | neben Typ, Status und Sortierung |
| **POI-Auswahl der Tagesplanung** | neben dem Filter nach Verplanung (req-083) |

Zur Wahl stehen „Alle", jede Gegend der Reise, und **„Ohne Gegend"** —
letzteres, um die noch nicht zugeordneten zu finden.

Die Auswahl **erscheint nicht**, solange kein POI eine Gegend trägt. Ein
Filter ohne Inhalt wäre nur ein leeres Feld.

Der Filter wird je Reise gemerkt, wie die übrigen (bug-052). Entfiel die
gefilterte Gegend inzwischen, fällt er auf „Alle" zurück — sonst zeigte
die Liste dauerhaft nichts.

## Wo die Gegend nicht vorkommt

Im **Begleiter** und auf der **Karte** nicht. Unterwegs zählt der Tag,
nicht die Gegend, und die Karte zeigt den Zusammenhang schon räumlich.

# GUI

- Das Feld steht in den POI-Details unter dem Ort — dort, wo auch der Ort
  steht, aus dem es sich meist ergibt.
- Die Filter folgen dem Muster der bestehenden Auswahlfelder
  (`filterSelect` in `poi-list`, `unplanned-column`). Es kommt kein neues
  Gestaltungsmittel hinzu.
- **Am Aussehen wird später gearbeitet.** Dieses Requirement bringt die
  Funktion; die Gestaltung der Filterzeile — vor allem bei 768 px, wo nun
  vier Felder nebeneinander stehen — ist eine eigene Aufgabe.
- Bei 375, 768 und 1280 px gelten die vier Regeln aus `stack.md`.

# Acceptance Criteria

- [x] Gegeben ich öffne die Details eines POI, wenn ich sie ansehe, dann
      gibt es ein Feld „Gegend".
- [x] Gegeben ich tippe „Bilbao" als Gegend ein und speichere, wenn ich
      den POI erneut öffne, dann steht dort „Bilbao".
- [x] Gegeben ein POI der Reise trägt „Bilbao", wenn ich einen anderen
      POI öffne, dann steht „Bilbao" als Vorschlag am Feld.
- [x] Gegeben ich lasse das Feld leer, wenn ich speichere, dann trägt der
      POI keine Gegend.
- [x] Gegeben ich tippe „  Bilbao  ", wenn ich speichere, dann steht
      „Bilbao" da.
- [x] Gegeben ein POI trägt „Bilbao" und ich tippe bei einem zweiten
      „bilbao", wenn ich die Liste der Gegenden ansehe, dann steht dort
      eine Gegend, nicht zwei.
- [x] Gegeben POIs mit den Gegenden „Bilbao" und „San Sebastián", wenn
      ich in der POI-Liste nach „Bilbao" filtere, dann stehen nur die
      POIs dieser Gegend da.
- [x] Gegeben POIs mit und ohne Gegend, wenn ich nach „Ohne Gegend"
      filtere, dann stehen nur die ohne da.
- [x] Gegeben kein POI der Reise trägt eine Gegend, wenn ich die
      POI-Liste ansehe, dann gibt es die Auswahl „Gegend" NICHT.
- [x] Gegeben die Tagesplanung, wenn ich die POI-Auswahl ansehe, dann
      lässt sie sich ebenfalls nach Gegend filtern.
- [x] Gegeben ich habe nach „Bilbao" gefiltert und entferne die Gegend
      beim letzten POI, der sie trug, wenn ich die Liste ansehe, dann
      steht der Filter auf „Alle" und die Liste zeigt wieder POIs.
- [x] Gegeben eine Gegend wird beim letzten POI entfernt, wenn ich die
      Vorschlagsliste am Feld ansehe, dann steht sie nicht mehr darin.
- [x] Gegeben zwei Reisen mit je einer Gegend „Bilbao", wenn ich in einer
      filtere, dann wirkt das nur auf ihre POIs.

# Constraints

- Die Gegend steht als Text am POI (`poi.gegend`), **nicht** in einer
  eigenen Tabelle. Das ist die Bedingung dafür, dass eine Gegend mit dem
  letzten POI verschwindet, ohne dass etwas aufzuräumen wäre.
- Das Aufräumen der Eingabe steht an **einer** Stelle
  (`normalisiereGegend` in `lib/pois/gegenden.ts`) und wird von Formular
  und Datenzugriff gemeinsam benutzt — nicht zweimal geschrieben.
- Die Gegend wird **nie abgeleitet**. Anders als beim Ort (req-041) heißt
  null hier „keine gewünscht" und nicht „nicht ermittelbar": Der
  bisherige Wert bleibt dabei nicht stehen.
- Der leere Text ist in der Datenbank nicht erlaubt (Bedingung an der
  Spalte) — er wäre eine zweite Schreibweise für „keine".
- Die beiden Filter nutzen dieselbe Funktion
  (`entsprichtGegendFilter`); es entsteht keine zweite Filterlogik
  (vgl. req-082).

# Out of Scope

- Die Gegend im Begleiter oder auf der Karte zeigen.
- Gegenden verwalten, umbenennen oder zusammenführen. Umbenennen heißt
  heute: an jedem POI ändern.
- Einen POI mehreren Gegenden zuordnen.
- Die Gegend aus der Position vorschlagen. Sie wäre eine Ableitung und
  damit genau das, was `ort` schon tut.
- Eine Gegend an den Programmpunkt hängen oder einen Reisetag einer
  Gegend zuordnen.
- Die Gestaltung der Filterzeile bei 768 px — eigene Aufgabe, siehe GUI.
- Den gedruckten Reiseplan (req-080) nach Gegenden gliedern.
