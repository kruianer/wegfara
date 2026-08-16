---
id: req-017
title: Reisen anlegen, ändern und löschen
app: wegfara
area: Planung
priority: high
created: 2026-08-06
---

# Ziel (Warum)

Als Reiseleiter will ich eine neue Reise selbst anlegen können. Heute
existieren nur die drei Reisen aus dem Bestand — für jede weitere
müsste jemand an die Datenbank. Damit ist die App für eine echte Reise
nicht benutzbar.

# Funktion (Was)

**Anlegen.** Im Aufklappmenü am Reisenamen steht unter der Liste der
Eintrag „Neue Reise". Er öffnet ein Formular mit drei Angaben:

- Titel der Reise
- Beginn und Ende
- Hauptort

Der Hauptort wird über eine Suche erfasst: Man tippt einen Namen ein
und erhält passende Orte zur Auswahl; die geografische Position ergibt
sich daraus. Koordinaten werden nie von Hand eingegeben.

Nach dem Anlegen wird die neue Reise geöffnet.

**Ändern.** Titel, Zeitraum und Hauptort einer Reise lassen sich
nachträglich korrigieren. Der Zugang dazu liegt an derselben Stelle wie
das Anlegen.

**Löschen.** Eine Reise lässt sich entfernen. Zuvor erscheint eine
Rückfrage, die benennt, was dabei verloren geht — die Anzahl der POIs,
Programmpunkte und Transfers dieser Reise. Erst nach Bestätigung wird
gelöscht, zusammen mit allen daran hängenden Daten: POIs,
Programmpunkte, Transfers, getroffene Optionswahlen und das
Suchgebiet.

War die gelöschte Reise gerade geöffnet, wird danach eine andere
geöffnet — nach derselben Regel wie beim ersten Aufruf. Gibt es keine
Reise mehr, erscheint an Stelle der Ansicht die Aufforderung, eine
anzulegen.

**Regeln für die Eingaben.** Ein Titel ist erforderlich und höchstens
80 Zeichen lang. Beginn und Ende sind erforderlich; das Ende darf nicht
vor dem Beginn liegen. Ein Hauptort ist erforderlich. Fehlt eine Angabe
oder ist sie unzulässig, wird nicht gespeichert und die betroffene
Stelle benannt.

Zurückliegende Zeiträume sind zulässig, damit vergangene Reisen
nachgetragen werden können.

# GUI

- Erscheinungsbild wie der übrige Planer: Farbwelt „Indigo-Nacht",
  Playfair Display für Überschriften, Figtree für die
  Bedienoberfläche.
- Das Formular erscheint als überlagernde Fläche über dem Planer, im
  Stil der Karten des Designs (Radius 18, Hintergrund `card`,
  Umrandung `bd`).
- Die Schaltfläche zum Speichern folgt den gefüllten Schaltflächen
  (Akzentfarbe, Pillenform); die Rückfrage vor dem Löschen nutzt die
  Farbe `neg`.
- Die Ortssuche zeigt höchstens acht Vorschläge mit Name und
  einordnender Angabe (Region, Land).

# Akzeptanzkriterien

- [ ] Gegeben der Planer ist geöffnet, wenn ich das Aufklappmenü am
      Reisenamen öffne, dann sehe ich den Eintrag „Neue Reise".
- [ ] Gegeben ich habe „Neue Reise" gewählt, wenn ich Titel
      „Toskana 2027", Zeitraum 12.05.2027 bis 19.05.2027 und Hauptort
      Florenz angebe und speichere, dann steht „Toskana 2027" im
      Kopfbereich.
- [ ] Gegeben ich habe die Reise angelegt, wenn ich das Aufklappmenü
      öffne, dann enthält die Liste vier Reisen.
- [ ] Gegeben ich lege eine Reise an, wenn ich im Feld für den
      Hauptort „Floren" eintippe, dann erscheinen Ortsvorschläge zur
      Auswahl.
- [ ] Gegeben das Formular ist offen, wenn ich ohne Titel speichere,
      dann wird die Reise NICHT angelegt.
- [ ] Gegeben das Formular ist offen, wenn ich als Beginn den
      12.05.2027 und als Ende den 05.05.2027 angebe und speichere,
      dann wird die Reise NICHT angelegt.
- [ ] Gegeben die geöffnete Reise „Toskana 2027", wenn ich ihren Titel
      auf „Toskana Frühling 2027" ändere und speichere, dann steht
      „Toskana Frühling 2027" im Kopfbereich.
- [ ] Gegeben die Reise „Süditalien Rundreise" mit POIs und
      Programmpunkten, wenn ich sie zu löschen versuche, dann nennt
      die Rückfrage die Anzahl der betroffenen POIs.
- [ ] Gegeben die Rückfrage vor dem Löschen, wenn ich sie abbreche,
      dann ist die Reise weiterhin vorhanden.
- [ ] Gegeben die Rückfrage vor dem Löschen, wenn ich bestätige, dann
      erscheint die Reise NICHT mehr in der Liste.
- [ ] Gegeben ich habe die gerade geöffnete Reise gelöscht, wenn die
      Ansicht sich neu aufbaut, dann ist eine andere Reise geöffnet.
- [ ] Gegeben eine neu angelegte Reise ohne POIs, wenn ich den Bereich
      „POIs" öffne, dann ist die Liste leer.

# Constraints

- Eine Reise gehört zum Account des angemeldeten Nutzers; es werden
  keine Reisen anderer Accounts angezeigt oder verändert.
- Die Ortssuche nutzt die Ortsdaten von OpenStreetMap. Deren
  Nutzungsbedingungen erlauben das Speichern der ermittelten Angaben.
- Beim Löschen dürfen keine verwaisten Daten zurückbleiben — weder
  POIs noch Programmpunkte, Transfers, Optionswahlen oder Suchgebiete.

# Nicht Teil dieses Requirements

- Reiseart, Budget und Währung als Eckdaten der Reise
- Teilnehmer einer Reise anlegen oder einladen
- Anlegen einer Reise im Begleiter
- Kopieren einer bestehenden Reise als Vorlage
- Wiederherstellen einer gelöschten Reise
- Anlegen von POIs, Programmpunkten oder Transfers von Hand
- Import einer Reise aus einer Datei
