---
id: req-073
title: Zeitpuffer am Transfer als + / − Minuten
app: wegfara
area: Planung
priority: normal
created: 2026-09-19
---

# Goal (Why)

Als Reiseleiter plane ich einen Transfer zwischen zwei Programmpunkten und
sehe heute nur dann etwas, wenn die Zeit **nicht** reicht — dann steht ein
Satz da. Reicht sie, schweigt die App.

Damit fehlt mir beim Planen die wichtigere Hälfte: **wie viel Luft** habe
ich? Zehn Minuten Puffer sind etwas anderes als zwei Stunden, und beides
sieht heute gleich aus. Erst wenn ich weiß, wo es eng wird und wo Zeit
übrig ist, kann ich einen Tag sinnvoll füllen.

# Function (What)

Am Transfer steht **immer** der Zeitpuffer: die Differenz zwischen der
Lücke und der Fahrzeit, als Zahl mit Vorzeichen in Minuten.

- **Reicht die Zeit** — es bleibt Puffer: `+25 Min`, in **Grün**
  (`--pos`).
- **Reicht sie nicht** — die Fahrt dauert länger: `−15 Min`, in **Rot**
  (`--neg`).
- **Geht es genau auf** — `±0 Min`, in Grün: es passt, wenn auch knapp.

Die Anzeige steht **immer an derselben Stelle** am Transfer, gleich ob
grün oder rot. Sie springt nicht und erscheint nicht mal hier, mal dort.

Sie ersetzt den bisherigen Warnsatz am Transfer-Block: Das Vorzeichen und
die Farbe sagen dasselbe kürzer. Der rote Rahmen am knappen Transfer
bleibt — die Zahl tritt an die Stelle des Textes, nicht des Rahmens.

Im **Transfer-Formular** bleibt der ausführliche Satz erhalten. Dort ist
Platz dafür, und beim Eintragen hilft die Begründung mehr als eine Zahl.

# Acceptance Criteria

- [x] Gegeben zwischen zwei Programmpunkten liegen 60 Min und der
      Transfer dauert 35 Min, wenn ich den Zeitstrahl ansehe, dann steht
      am Transfer `+25 Min` in Grün.
- [x] Gegeben die Lücke beträgt 20 Min und der Transfer dauert 35 Min,
      wenn ich den Zeitstrahl ansehe, dann steht dort `−15 Min` in Rot.
- [x] Gegeben Lücke und Fahrzeit sind gleich lang, wenn ich den
      Zeitstrahl ansehe, dann steht dort `±0 Min` in Grün.
- [x] Gegeben ein Transfer mit Puffer und einer ohne, wenn ich beide
      ansehe, dann steht die Zahl bei beiden an derselben Stelle des
      Blocks.
- [x] Gegeben die Zeit reicht nicht, wenn ich den Transfer-Block ansehe,
      dann ist er weiterhin als knapp erkennbar (roter Rahmen) und der
      bisherige Warnsatz steht NICHT zusätzlich daneben.
- [x] Gegeben ich öffne das Transfer-Formular bei zu knapper Zeit, wenn
      ich es ansehe, dann steht dort weiterhin der ausführliche Satz mit
      beiden Zahlen.
- [x] Gegeben zwischen den Programmpunkten liegt keine Lücke, wenn ich
      den Transfer ansehe, dann zeigt die Zahl die volle Fahrzeit als
      Minus — nicht `±0`.
- [x] Gegeben ich verschiebe einen Programmpunkt, sodass die Lücke
      wächst, wenn ich danach den Transfer ansehe, dann ist die Zahl
      angepasst.
- [ ] Gegeben ein Transfer-Block ist sehr flach, weil die Lücke kurz ist,
      wenn ich ihn ansehe, dann ist die Zahl trotzdem lesbar und nicht
      abgeschnitten.
- [ ] Gegeben der Zeitstrahl ist auf 375 px, 768 px und 1280 px zu sehen,
      wenn ein Transfer darin liegt, dann ist die Zahl auf allen dreien
      lesbar (siehe [stack.md](../../stack.md)).

# Constraints

- Gerechnet wird mit den vorhandenen Funktionen aus
  [luecke.ts](../../../lib/transfers/luecke.ts) — `lueckeMinuten` und
  `passtInLuecke`. Es entsteht keine zweite Rechnung daneben.
- Genaues Aufgehen gilt weiterhin als passend (`passtInLuecke`), nicht als
  Engpass.
- Die Farben sind die vorhandenen `--pos` (`#8fd6a4`) und `--neg`
  (`#e896a4`). Beide haben auf den Kartenflächen über 7:1 Kontrast und
  sind damit auch klein lesbar (vgl. bug-051).
- Die Farbe ist nicht der einzige Unterschied: Das Vorzeichen trägt
  dieselbe Aussage, damit die Anzeige auch ohne Farbunterscheidung
  eindeutig ist.
- Es wird nach wie vor **nichts von selbst umgeplant** (siehe
  [vision.md](../../vision.md)) — die Zahl informiert, sie greift nicht
  ein.

# Out of Scope

- Den Tagesplan automatisch anpassen, damit der Puffer positiv wird.
- Eine Warnung, wenn der Puffer nur sehr knapp positiv ist.
- Den Puffer in der Tagesübersicht oder im Begleiter (`/go`) zeigen.
- Puffer über mehrere Transfers eines Tages aufsummieren.
- Die Fahrzeit selbst ändern oder neu berechnen lassen.
