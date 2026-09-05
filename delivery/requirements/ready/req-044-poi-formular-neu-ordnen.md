---
id: req-044
title: POI-Formular neu ordnen und um Beschreibung ergänzen
app: wegfara
area: Planung
priority: normal
created: 2026-09-05
changes: req-035, req-041
---

# Goal (Why)

Als Reiseleiter lege ich einen POI meistens über seine Adresse an — die
Position ergibt sich daraus. Heute steht die Position im Formular über
der Adresse, und die Karte reagiert jederzeit auf Klicks, sodass ich sie
beim Verschieben versehentlich verstelle. Außerdem fehlt mir am POI ein
Platz für die Beschreibung, die ich beim Sammeln notiere.

# Function (What)

Das POI-Formular bekommt diese Reihenfolge:

1. Name
2. Typ
3. Status
4. Kurztext
5. Langtext
6. Adresse
7. Ort — abgeleitet, nicht eingebbar (req-041)
8. Position

**Kurztext und Langtext** sind neu am POI. Der Kurztext fasst höchstens
200 Zeichen, der Langtext ist unbegrenzt. Beide sind freiwillig.

**Die Position** wird aus der Adresse gesetzt. Für den Kartenklick gibt
es einen Schalter „Position auf der Karte setzen"; solange er aus ist,
verändert ein Klick auf die Karte die Position nicht. Nach einem
gesetzten Klick schaltet er sich wieder aus.

**Beim Verplanen** (req-039) übernimmt der Programmpunkt Kurztext und
Langtext des POI, statt sie leer zu lassen.

**Beim Anlegen aus einem Google-Maps-Link** (req-026) werden beide Texte
aus den Google-Angaben gefüllt. Die KI-Suche (req-014) lässt sie leer.
Ein selbst geänderter Text überlebt ein erneutes Auffrischen aus
demselben Link, wie die übrigen von Hand geänderten Angaben (req-035).

Nach der Umsetzung wird [datenbank.md](../../datenbank.md) auf den neuen
Stand des Schemas gebracht.

# Änderung gegenüber heute (req-035, req-041)

- Die Reihenfolge der Felder ändert sich; heute steht die Position vor
  der Adresse.
- Der Kartenklick wirkt heute jederzeit — künftig nur nach dem
  Einschalten des Schalters.
- Kurztext und Langtext gibt es am POI heute nicht.
- Der abgeleitete Ort bleibt, wie req-041 ihn eingeführt hat; er wandert
  nur unter die Adresse.

# Acceptance Criteria

- [ ] Gegeben ich öffne einen POI zum Bearbeiten, wenn ich das Formular
      von oben nach unten lese, dann folgen die Felder in der
      Reihenfolge Name, Typ, Status, Kurztext, Langtext, Adresse, Ort,
      Position.
- [ ] Gegeben ich lege einen POI an, wenn ich das Formular öffne, dann
      ist der Schalter „Position auf der Karte setzen" ausgeschaltet.
- [ ] Gegeben der Schalter ist ausgeschaltet, wenn ich auf die Karte
      klicke, dann ändert sich die Position NICHT.
- [ ] Gegeben ich schalte „Position auf der Karte setzen" ein, wenn ich
      auf die Karte klicke, dann steht die angeklickte Position im
      Formular.
- [ ] Gegeben ich habe per Kartenklick eine Position gesetzt, wenn ich
      danach den Schalter ansehe, dann ist er wieder ausgeschaltet.
- [ ] Gegeben ich trage die Adresse „Via Richard Wagner 5, 84010 Ravello
      SA" ein, wenn ich den POI speichere, dann steht als Ort „Ravello".
- [ ] Gegeben ich schreibe in den Kurztext 200 Zeichen, wenn ich
      speichere, dann wird der POI gespeichert.
- [ ] Gegeben ich versuche, in den Kurztext 201 Zeichen zu schreiben,
      wenn ich das Feld verlasse, dann wird die Eingabe abgelehnt.
- [ ] Gegeben ein POI mit dem Kurztext „Gärten mit Meerblick", wenn ich
      ihn auf den Zeitstrahl ziehe, dann trägt der entstandene
      Programmpunkt denselben Kurztext.
- [ ] Gegeben ich lege einen POI aus einem Google-Maps-Link an, wenn ich
      ihn danach öffne, dann sind Kurztext und Langtext aus den
      Google-Angaben gefüllt.
- [ ] Gegeben ich habe den Kurztext eines aus Google angelegten POI
      selbst geändert, wenn ich ihn aus demselben Link auffrische, dann
      bleibt mein Text stehen.
- [ ] Gegeben ich lasse POIs per KI suchen, wenn ich einen davon öffne,
      dann sind Kurztext und Langtext leer.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [datenbank.md](../../datenbank.md) öffne, dann sind Kurztext und
      Langtext des POI dort beschrieben.

# Constraints

- Der Kurztext erscheint in der POI-Liste; die Grenze von 200 Zeichen
  hält deren Darstellung zusammen.

# Out of Scope

- Adresse und Position selbst — beide bleiben eingebbar wie heute.
- Ableiten der Adresse aus der Position.
- Beschreibungstexte durch die KI erzeugen lassen.
- Kurztext und Langtext im Begleiter anzeigen.
- Nachträgliches Füllen der Texte bei bestehenden POIs.
