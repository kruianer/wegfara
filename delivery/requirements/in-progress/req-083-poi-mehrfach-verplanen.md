---
id: req-083
title: Einen POI mehrmals verplanen
app: wegfara
area: Planung
priority: normal
created: 2026-10-19
---

# Goal (Why)

Als Reiseleiter starte ich den Tag im Hotel und ende dort — zweimal
dasselbe POI, und dazwischen zwei Transfers, die ich einplanen muss.
Heute geht das nicht: Sobald das Hotel einmal im Zeitstrahl liegt,
verschwindet es aus der Auswahl und ist nicht mehr greifbar.

Das trifft nicht nur das Hotel. Ein Parkplatz, von dem man morgens
losgeht und abends zurückkommt; ein Café, in dem man sich zweimal trifft;
ein Bahnhof. Bei einer Reise über mehrere Tage kann dasselbe Hotel
**jeden Tag zweimal** vorkommen.

# Function (What)

## Mehrmals verplanen

Ein POI lässt sich **beliebig oft** in den Zeitstrahl ziehen — am selben
Tag und an verschiedenen Tagen. Jeder Programmpunkt ist für sich: eigene
Zeit, eigene Dauer, eigenes Verschieben und Entfernen.

Das Entfernen eines Programmpunkts lässt die übrigen desselben POI
unberührt.

## Die Spalte der POI-Auswahl

Die linke Spalte zeigt **alle verplanbaren POIs** (Status „Gesetzt" und
„Wahrscheinlich", wie heute) — auch die, die schon verplant sind. Ihr
Titel ist nicht mehr „Noch unverplant", sondern neutral.

Auf jeder Kachel steht, **wie oft dieser POI verplant ist**. Ein noch
nicht verplanter POI trägt keine Zahl — nicht „0", sondern nichts.

Gezählt wird über die **ganze Reise**, nicht nur über den gewählten Tag:
Dass das Hotel an Tag 1 zweimal liegt, will ich auch sehen, wenn ich an
Tag 3 arbeite.

## Der Filter

Über der Spalte ein Filter mit drei Stellungen:

- **Alle** — die Vorgabe
- **Noch unverplant** — was keinen Programmpunkt hat
- **Mindestens einmal verplant** — das Gegenstück

Der Filter überdauert den Wechsel des Reisetags. Beim Neustart der App und
beim Wechsel der Reise darf er auf „Alle" zurückfallen (wie die POI-Filter
in bug-052).

## Die KI-Planung

Die KI-Planung (req-056) lässt bereits verplante POIs weiterhin aus, wenn
sie nur Lücken füllt. Sie soll keinen POI doppelt einplanen, weil ihr das
nun erlaubt wäre — mehrmals verplanen ist eine Entscheidung des
Reiseleiters, keine der KI.

# Acceptance Criteria

- [x] Gegeben ein POI liegt bereits im Zeitstrahl, wenn ich die
      POI-Auswahl ansehe, dann steht er weiterhin dort.
- [x] Gegeben ein POI liegt bereits im Zeitstrahl, wenn ich ihn ein
      zweites Mal hineinziehe, dann entsteht ein zweiter Programmpunkt.
- [x] Gegeben ein POI liegt zweimal am selben Tag, wenn ich den ersten
      verschiebe, dann bleibt der zweite, wo er war.
- [x] Gegeben ein POI liegt zweimal am selben Tag, wenn ich den ersten
      entferne, dann bleibt der zweite erhalten.
- [x] Gegeben ein POI ist dreimal verplant, wenn ich seine Kachel ansehe,
      dann steht dort die Zahl 3.
- [x] Gegeben ein POI ist noch nicht verplant, wenn ich seine Kachel
      ansehe, dann steht dort keine Zahl — insbesondere keine „0".
- [x] Gegeben ein POI ist an Tag 1 verplant, wenn ich an Tag 3 arbeite
      und seine Kachel ansehe, dann steht die Zahl trotzdem dort.
- [x] Gegeben ich ziehe einen POI in den Zeitstrahl, wenn ich danach
      seine Kachel ansehe, dann ist die Zahl um eins gewachsen.
- [x] Gegeben ich entferne einen Programmpunkt, wenn ich danach die
      Kachel seines POI ansehe, dann ist die Zahl um eins gefallen.
- [x] Gegeben ich öffne die Planung, wenn ich den Filter ansehe, dann
      steht er auf „Alle".
- [x] Gegeben ich stelle den Filter auf „Noch unverplant", wenn ich die
      Spalte ansehe, dann stehen dort nur POIs ohne Programmpunkt.
- [x] Gegeben ich stelle den Filter auf „Mindestens einmal verplant",
      wenn ich die Spalte ansehe, dann stehen dort nur POIs mit
      mindestens einem Programmpunkt.
- [x] Gegeben ich habe den Filter gesetzt, wenn ich den Reisetag wechsle
      und zurückkomme, dann gilt derselbe Filter.
- [x] Gegeben ein POI mit Status „Weiß noch nicht", wenn ich die Spalte
      ansehe, dann steht er dort nicht — gleich welcher Filter gewählt
      ist (req-039).
- [ ] Gegeben ich lasse die KI die Lücken füllen, wenn sie plant, dann
      plant sie keinen POI ein, der schon einen Programmpunkt hat.
- [ ] Gegeben ein POI liegt zweimal am selben Tag, wenn ich die Karte
      ansehe, dann sind beide Programmpunkte erkennbar und die POI-Nummer
      stimmt (req-074, bug-055).
- [ ] Gegeben ein POI liegt zweimal am selben Tag, wenn ich zwischen
      beiden einen Transfer plane, dann geht das (req-052).
- [ ] Gegeben die Spalte ist auf 375 px, 768 px und 1280 px zu sehen,
      wenn ich Filter und Kacheln ansehe, dann sind sie auf allen dreien
      bedienbar (siehe [stack.md](../../stack.md)).

# Constraints

- **Keine Migration nötig.** Die Datenbank erlaubt es bereits: Auf
  `activity.poi_id` liegt kein Unique-Index (geprüft am 19.10.2026). Die
  Sperre steckt allein in der Anwendung.
- Die Sperre sitzt in
  [unplanned.ts](../../../lib/pois/unplanned.ts): `unplannedPois` filtert
  jeden POI heraus, auf den **irgendein** Programmpunkt verweist. Dieselbe
  Annahme steht in
  [ki-planung.ts](../../../lib/plan/ki-planung.ts) (Zeilen 115–120) — dort
  ist sie richtig und bleibt.
- Welche POIs überhaupt verplanbar sind, entscheidet weiterhin
  `isPlannablePoi`: nur „Gesetzt" und „Wahrscheinlich" (req-039).
- Der Zähler wird aus den Programmpunkten der Reise gerechnet, nicht am
  POI gespeichert — eine gespeicherte Zahl liefe irgendwann auseinander.
- Zwei Programmpunkte desselben POI zur **gleichen Zeit** bilden wie alle
  zeitgleichen eine Options-Gruppe (req-004). Das ist hier unsinnig, aber
  kein Sonderfall, der eigens verhindert werden muss.

# Out of Scope

- Die Programmpunkte eines POI miteinander verknüpfen („Rückweg zu …").
- Beim zweiten Verplanen Zeit oder Dauer vorschlagen.
- Den Zähler in der POI-Liste (`/plan`, Bereich POIs) zeigen.
- Den Zähler im Begleiter (`/go`) zeigen.
- Nach der Anzahl sortieren.
- Die KI mehrmals verplanen lassen.
