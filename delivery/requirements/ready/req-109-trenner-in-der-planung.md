---
id: req-109
title: Zwei Trenner in der Planung — die drei Spalten selbst einteilen
app: wegfara
area: Planung
priority: normal
changes: req-011, req-088, req-099
created: 2026-11-16
---

# Goal (Why)

In der Planung stehen drei Spalten nebeneinander, und **zwei davon sind
fest verdrahtet**:

| Spalte | Breite heute | woher |
| --- | --- | --- |
| POI-Auswahl | **340 px fest** (zugeklappt 44) | `POI_AUSWAHL_BREITE_PX`, req-099 |
| Zeitstrahl | **412 px fest** | `timeline-column.module.css:2` |
| Karte | der Rest | `flex: 1` |

Am Laptop (1280 px) bleiben der Karte also 528 px, bei 4K über 3000 —
während der Zeitstrahl immer 412 px breit ist, ganz gleich wie viel
Platz da wäre. Wer am Zeitstrahl arbeitet, kann ihm keinen Platz geben;
wer die Karte braucht, kann den Zeitstrahl nicht zurückdrängen.

**In der Orte-Ansicht gibt es das längst.** `SplitView` setzt dort einen
Trenner zwischen Liste und Karte, an dem sich ziehen lässt
(`role="separator"`, Zeiger-Ereignisse, seit bug-031 auch mit dem Finger
auf dem iPad). Die Planung hat davon nichts.

# Scope (What)

## Zwei Trenner, zwischen allen drei Spalten

```
[ POI-Auswahl ]│[ Zeitstrahl ]│[ Karte ]
               ^              ^
```

Jeder Trenner verschiebt die Grenze zwischen seinen beiden Nachbarn;
die Gesamtbreite bleibt. Die Karte nimmt weiterhin, was die anderen
zwei übrig lassen — sie braucht deshalb keine eigene Breite.

Der Trenner ist derselbe wie in der Orte-Ansicht: **`SplitView` wird
geteilt, nicht kopiert**, oder sein Trenner wird zu einem eigenen
Baustein, den beide benutzen. Zwei Fassungen desselben Trenners liefen
auseinander (vgl. req-082: dieselbe Konstante dreimal, bug-048 gegen
bug-065: der Fix an einer Stelle, nicht an der Schwester).

Mitgebracht wird damit auch, was dort schon erprobt ist: Ziehen über
Zeiger-Ereignisse, damit es am Finger funktioniert (bug-031), und
`role="separator"` mit `aria-orientation` und einem `aria-label`.

## Untergrenzen

Keine Spalte darf unbrauchbar schmal werden:

- **POI-Auswahl:** nicht schmaler als ihre offene Breite von 340 px
  (req-099). Schmaler bricht die Zeile mit Bild, Nummer und Typ.
- **Zeitstrahl:** nicht schmaler als seine heutigen 412 px. Darunter
  bricht das Raster, auf dem die Programmpunkte liegen.
- **Karte:** eine Mindestbreite, unter die der Trenner nicht geht —
  `SplitView` hält dafür schon einen Rand zum rechten Rand frei
  (`RIGHT_MARGIN_PX`).

Breiter als die Untergrenze darf jede werden, solange die anderen ihre
behalten.

## Der Zuklapp-Griff bleibt, wie er ist

Die POI-Auswahl lässt sich auf einen Streifen von 44 px zuklappen
(req-099). Das ist **etwas anderes als Ziehen** und bleibt unverändert:

- Zugeklappt ist ihr Trenner fort — es gibt nichts zu ziehen.
- Beim Aufklappen steht sie wieder so breit, wie sie gezogen war; war
  nie gezogen worden, auf ihren 340 px.

Die Trennlinie, die die Spalte heute als inneren Schatten trägt
(`unplanned-column.module.css:14`), geht im Trenner auf — sonst stünden
zwei Linien nebeneinander.

## Die Einteilung wird gemerkt

Je Reise, wie die Filter der POI-Liste (bug-052). Dafür gibt es das
Muster schon: `ladeListenEinstellungen` / `speichereListenEinstellungen`
in `lib/pois/ansicht-einstellungen.ts`, je Reise geschlüsselt.

`SplitView` merkt seine Breite heute **nur im Zustand** — nach dem
Neuladen ist sie fort. Bei zwei Trennern wäre das lästiger als bei
einem: Wer sich die Planung eingerichtet hat, will sie morgen wieder so
finden.

Gemerkt werden die beiden Breiten, nicht die der Karte — die ergibt
sich.

## Schmale Breiten bleiben unberührt

Unter `SPALTEN_NEBENEINANDER_AB_PX` (1180 px) steht der Zeitstrahl
allein, daneben die gewählte der beiden anderen Spalten, mit einem
Umschalter darüber (req-088). Dort gibt es keine drei Spalten und
deshalb auch keine Trenner.

# Acceptance Criteria

- [ ] Gegeben die Planung bei 1280 px oder breiter, dann stehen zwei
      Trenner: einer zwischen POI-Auswahl und Zeitstrahl, einer
      zwischen Zeitstrahl und Karte.
- [ ] Gegeben ich ziehe am rechten Trenner nach rechts, dann wird der
      Zeitstrahl breiter und die Karte schmaler.
- [ ] Gegeben ich ziehe am linken Trenner nach rechts, dann wird die
      POI-Auswahl breiter und der Zeitstrahl schmaler.
- [ ] Gegeben ich ziehe einen Trenner, dann bleibt die Summe der drei
      Spalten die Breite des Fensters — keine Spalte ragt hinaus
      (stack.md, Bildschirmbreiten, Regel 1).
- [ ] Gegeben ich ziehe die POI-Auswahl so schmal wie möglich, dann ist
      sie 340 px breit und nicht schmaler.
- [ ] Gegeben ich ziehe den Zeitstrahl so schmal wie möglich, dann ist
      er 412 px breit und nicht schmaler.
- [ ] Gegeben ich ziehe die Karte so schmal wie möglich, dann behält sie
      ihre Mindestbreite.
- [ ] Gegeben ich ziehe mit dem Finger auf dem iPad, dann verschiebt
      sich der Trenner (bug-031).
- [ ] Gegeben ein Trenner, wenn eine Vorlesehilfe ihn liest, dann nennt
      er sich als Trenner mit seiner Richtung und seiner Aufgabe.
- [ ] Gegeben ich habe gezogen und lade die Seite neu, dann stehen die
      Spalten, wie ich sie eingeteilt habe.
- [ ] Gegeben zwei Reisen, dann hat jede ihre eigene Einteilung
      (bug-052).
- [ ] Gegeben ich habe nie gezogen, dann stehen die Spalten wie heute:
      340, 412, Rest.
- [ ] Gegeben ich klappe die POI-Auswahl zu, dann ist ihr Trenner fort
      und der Streifen 44 px breit (req-099).
- [ ] Gegeben ich hatte die POI-Auswahl auf 500 px gezogen, wenn ich sie
      zuklappe und wieder aufklappe, dann steht sie wieder auf 500 px.
- [ ] Gegeben die zugeklappte POI-Auswahl, dann steht zwischen ihr und
      dem Zeitstrahl **eine** Trennlinie, nicht zwei.
- [ ] Gegeben eine Breite unter 1180 px, dann gibt es keine Trenner und
      es bleibt bei der schmalen Ordnung aus req-088.
- [ ] Gegeben die Bildschirmprüfung bei 1280 und 1920 px, dann ist sie
      mit den Trennern grün und ihr Tippziel mindestens 44 px breit
      (stack.md, Regel 4).

# Constraints

- **Der Trenner wird geteilt, nicht kopiert.** `SplitView` hat ihn
  schon, samt Zeiger-Ereignissen und Rollen. Eine zweite Fassung liefe
  auseinander.
- Die Untergrenzen stehen als Token an **einer** Stelle
  (`lib/design/stil.ts`, wie `POI_AUSWAHL_BREITE_PX` schon) — nicht als
  Zahl im Stylesheet und in der Komponente.
- Die 412 px des Zeitstrahls bleiben seine **Untergrenze**, nicht seine
  Breite. Was heute gilt, bleibt der Ausgangspunkt.
- Der Zuklapp-Griff aus req-099 bleibt unverändert. Ziehen und
  Zuklappen sind zwei Dinge.
- Die Einteilung wird je Reise gemerkt, nach dem Muster von
  `ansicht-einstellungen.ts` (bug-052).
- Unter 1180 px ändert sich nichts (req-088).
- Gezogen wird über Zeiger-Ereignisse, nie über Maus-Ereignisse: Safari
  auf dem iPad schickt zu einem Finger keine `mousemove` (bug-031).

# Out of Scope

- Die Karte zuklappbar zu machen. Nur die POI-Auswahl hat einen Griff
  (req-099).
- Die Höhen innerhalb einer Spalte einzuteilen.
- Eine Schaltfläche, die die Einteilung zurücksetzt. Wer sie zurück
  will, zieht sie zurück.
- Die Einteilung je Gerät oder je Person zu merken — sie liegt je Reise
  im Browser, wie die Filter.
- Die Trenner in der Orte-Ansicht oder im Chat zu ändern. Dort gibt es
  schon einen, und er bleibt, wie er ist.
- Die POI-Auswahl in der Planung inhaltlich zu ändern (req-099, req-100).
