---
id: req-059
title: Echte Route für Transfers
app: wegfara
area: Planung
priority: normal
created: 2026-09-10
changes: req-052
---

# Goal (Why)

Als Reiseleiter sehe ich beim Transfer heute nur zwei Zahlen und auf der
Karte eine gepunktete Gerade — dabei liegt zwischen zwei Orten an der
Amalfiküste selten eine Gerade. Ich will den wirklichen Weg sehen, eine
Fahrzeit, die zum gewählten Verkehrsmittel passt, und von dort aus die
Navigation starten können.

# Function (What)

**Fahrrad als achtes Verkehrsmittel.** Zu den bisherigen sieben (zu Fuß,
Auto, Bus, Boot, Flug, Bahn, Fähre) kommt **Fahrrad**.

**Die Fahrzeit richtet sich nach dem Verkehrsmittel.** Heute wird immer
mit dem Auto gerechnet, auch bei „zu Fuß". Künftig:

| Verkehrsmittel | Vorschlag |
|---|---|
| zu Fuß | zu Fuß gerechnet |
| Fahrrad | mit dem Rad gerechnet |
| Auto, Bus | mit dem Auto gerechnet |
| Boot, Flug, Bahn, Fähre | kein Vorschlag |

Für die vier ohne Vorschlag bleiben Dauer und Strecke leer, und im
Formular steht: „Für dieses Verkehrsmittel gibt es keinen
Streckenvorschlag — Dauer und Strecke bitte eintragen."

**Die Wegbeschreibung** steht im Transfer-Formular unter den Feldern: bis
zu fünf Zeilen mit den Abschnitten der Strecke, je Zeile die Straße und
ihre Länge — etwa „SS163 Richtung Amalfi, 8 km". Sie dient dem Einschätzen,
nicht dem Navigieren.

**„In Google Maps öffnen"** daneben: ein Knopf, der die Navigation mit
Start, Ziel und dem gewählten Verkehrsmittel in Google Maps öffnet. Er
erscheint bei **jedem** Verkehrsmittel — gerade bei Bahn und Flug ist er
der Weg zur Verbindung. Übergeben wird nur der Link; wegfara schickt
keine Daten an Google.

**Die Route auf der Tageskarte.** Wo ein Transfer liegt, zeigt die Karte
im Planer den wirklichen Streckenverlauf statt der gepunkteten Geraden.
Ohne Transfer bleibt die Gerade wie bisher, ebenso wenn sich die Strecke
nicht ermitteln lässt.

# Änderung gegenüber heute (req-052)

- Es gibt sieben Verkehrsmittel; Fahrrad kommt hinzu.
- Die Fahrzeit wird immer mit dem Auto gerechnet, unabhängig vom
  gewählten Verkehrsmittel.
- Es gibt weder Wegbeschreibung noch Navigations-Knopf im Formular.
- Die Tageskarte verbindet die Programmpunkte immer mit einer Geraden.

# Acceptance Criteria

- [ ] Gegeben ich lege einen Transfer an, wenn ich die Auswahl der
      Verkehrsmittel öffne, dann steht dort „Fahrrad".
- [ ] Gegeben zwei Programmpunkte 3 km voneinander entfernt, wenn ich als
      Verkehrsmittel „zu Fuß" wähle, dann ist die vorgeschlagene Dauer
      länger als beim Verkehrsmittel „Auto".
- [ ] Gegeben ein Transfer mit „zu Fuß", wenn ich auf „Fahrrad" wechsle,
      dann werden Dauer und Strecke neu vorgeschlagen.
- [ ] Gegeben ich wähle „Flug", wenn ich das Formular ansehe, dann sehe
      ich den Hinweis, dass es für dieses Verkehrsmittel keinen
      Streckenvorschlag gibt.
- [ ] Gegeben ich wähle „Flug", wenn ich Dauer und Strecke selbst eintrage
      und speichere, dann wird der Transfer gespeichert.
- [ ] Gegeben ein Transfer mit „Auto" zwischen zwei Orten an der
      Amalfiküste, wenn ich das Formular ansehe, dann steht dort eine
      Wegbeschreibung mit höchstens fünf Zeilen.
- [ ] Gegeben ein Transfer, wenn ich „In Google Maps öffnen" wähle, dann
      öffnet sich Google Maps mit Start und Ziel dieses Transfers.
- [ ] Gegeben ein Transfer mit „Bahn", wenn ich das Formular ansehe, dann
      ist „In Google Maps öffnen" trotzdem vorhanden.
- [ ] Gegeben ein gespeicherter Transfer mit „Auto", wenn ich die
      Tageskarte ansehe, dann folgt die Linie zwischen den beiden
      Programmpunkten dem Straßenverlauf.
- [ ] Gegeben zwei Programmpunkte ohne Transfer dazwischen, wenn ich die
      Tageskarte ansehe, dann sind sie weiterhin durch eine gepunktete
      Gerade verbunden.
- [ ] Gegeben der Routing-Dienst ist nicht erreichbar, wenn ich die
      Tageskarte ansehe, dann sehe ich die gepunktete Gerade und KEINE
      Fehlermeldung auf der Karte.
- [ ] Gegeben der Routing-Dienst ist nicht erreichbar, wenn ich einen
      Transfer anlege, dann sehe ich einen Hinweis und kann Dauer und
      Strecke selbst eintragen.
- [ ] Gegeben ein Transfer mit „Flug", wenn ich die Tageskarte ansehe,
      dann wird dafür KEIN Straßenverlauf gezeichnet.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [datenbank.md](../../datenbank.md) öffne, dann ist „Fahrrad" bei den
      Verkehrsmitteln beschrieben.

# Constraints

- Strecke, Fahrzeit und Wegbeschreibung kommen von OSRM auf
  OpenStreetMap-Daten (siehe [stack.md](../../stack.md)), hinter der
  austauschbaren Schnittstelle in `lib/routing/`. OSRM bietet genau drei
  Profile — Auto, Rad, zu Fuß; mehr gibt es nicht zu verteilen.
- An Google werden keine Positionen übergeben: die Navigation läuft über
  einen Link, den der Nutzer öffnet ([vision.md](../../vision.md)).
- Navigiert wird in Google Maps, nicht in wegfara — die Wegbeschreibung
  dient dem Einschätzen.

# Out of Scope

- Abbiegehinweise Schritt für Schritt in wegfara.
- Fahrpläne von Bahn, Bus oder Fähre abrufen.
- Verkehrslage in die Fahrzeit einrechnen.
- Die Route im Begleiter anzeigen.
- Routen zwischen Programmpunkten ohne Transfer zeichnen.
- Ein Routing-Dienst, der Positionen an einen bezahlten Anbieter
  übergibt.
