---
id: req-035
title: POIs von Hand anlegen, ändern und löschen
app: wegfara
area: Planung
priority: high
created: 2026-09-04
changes: req-026
---

# Ziel (Warum)

Heute entstehen POIs nur über die KI-Suche oder einen Google-Link.
Einen Ort, den mir jemand mündlich empfohlen hat, kann ich nicht
erfassen — und einen falschen Namen oder eine schiefe Position nicht
korrigieren. Alles außer dem Status ist unveränderlich.

# Funktion (Was)

**Anlegen.** Über der POI-Liste gibt es eine Schaltfläche „POI
anlegen". Sie öffnet ein leeres Formular. Erforderlich sind Name, Ort,
Typ und Position; Adresse, Webseite, Telefonnummer und Öffnungszeiten
dürfen leer bleiben. Der neue POI erhält die nächste freie Nummer und
den Status „Weiß noch nicht".

**Die Position** wird auf zwei Wegen erfasst: über eine Ortssuche mit
Vorschlägen — dann werden Adresse und Ort mit übernommen — oder durch
einen Klick auf die Karte, für Orte ohne eigenen Namen wie eine Bucht
oder einen Aussichtspunkt.

**Ändern.** Ein Klick auf eine POI-Zeile klappt sie zu einem Formular
auf. Änderbar sind alle Angaben außer der Nummer: Name, Ort, Typ,
Position, Adresse, Webseite, Telefonnummer, Öffnungszeiten und Status.
Die Nummer bleibt fest — über sie wird in der Gruppe und auf der Karte
gesprochen.

**Bilder.** Zu einem POI lassen sich Bilder hinzufügen — als Datei
oder mit der Kamera — und wieder entfernen. Ihre Reihenfolge ist
änderbar; das erste erscheint in der Liste. Erlaubt sind Bilder bis
20 MB je Datei.

**Löschen.** Vor dem Entfernen erscheint eine Rückfrage mit dem Namen
des POI. Ist er bereits einem Programmpunkt zugeordnet, nennt sie das
zusätzlich. Nach Bestätigung wird der POI samt seinen Bildern
entfernt; ein zugeordneter Programmpunkt bleibt bestehen und verliert
nur die Verknüpfung.

# Änderung gegenüber heute (req-026)

Frischt der Google-Import einen bereits vorhandenen POI auf, werden
**von Hand geänderte Angaben nicht überschrieben**. Nur Felder, die
seit dem Import unberührt geblieben sind, werden aktualisiert. Bilder,
die von Hand hinzugefügt wurden, bleiben erhalten.

Ohne diese Regel wäre jede Korrektur beim nächsten Import wieder weg.

# GUI

- Die Schaltfläche „POI anlegen" liegt über der Liste, neben der
  KI-Suche und dem Feld für den Google-Link.
- Das Formular erscheint in der Liste selbst — beim Anlegen als neue
  Zeile oben, beim Ändern als aufgeklappte Zeile. Die Karte daneben
  bleibt sichtbar, damit sich die Position setzen lässt.
- Beim Setzen der Position durch Klick ist auf der Karte erkennbar,
  dass dieser Modus aktiv ist.
- Erscheinungsbild wie der übrige Planer.

# Akzeptanzkriterien

- [ ] Gegeben der Bereich „POIs" ist geöffnet, wenn ich „POI anlegen"
      anklicke, dann erscheint ein leeres Formular.
- [ ] Gegeben das Formular, wenn ich Name „Bucht bei Praiano", Ort
      „Praiano", Typ „Strand" und eine Position eintrage und speichere,
      dann erscheint „Bucht bei Praiano" in der Liste.
- [ ] Gegeben derselbe Vorgang, wenn ich den neuen POI betrachte, dann
      hat er den Status „Weiß noch nicht".
- [ ] Gegeben das Formular, wenn ich ohne Namen speichere, dann wird
      KEIN POI angelegt.
- [ ] Gegeben das Formular, wenn ich auf die Karte klicke, dann
      übernimmt das Formular die angeklickte Position.
- [ ] Gegeben der POI „Villa Rufolo", wenn ich seine Zeile anklicke,
      dann erscheint ein Formular mit seinen Angaben.
- [ ] Gegeben dasselbe Formular, wenn ich den Namen auf „Villa Rufolo
      (Garten)" ändere und speichere, dann steht dieser Name in der
      Liste.
- [ ] Gegeben derselbe POI, wenn ich seine Nummer zu ändern versuche,
      dann bleibt sie unverändert.
- [ ] Gegeben ein POI, wenn ich ein Bild hinzufüge, dann erscheint es
      in seiner Bildliste.
- [ ] Gegeben ein POI mit zwei Bildern, wenn ich das zweite an die
      erste Stelle setze, dann erscheint es in der POI-Zeile.
- [ ] Gegeben ein POI mit einem Bild, wenn ich das Bild entferne, dann
      liegt im Bildverzeichnis KEINE Datei mehr dazu.
- [ ] Gegeben ein POI, der keinem Programmpunkt zugeordnet ist, wenn
      ich ihn zu löschen versuche, dann nennt die Rückfrage seinen
      Namen.
- [ ] Gegeben ein POI, der einem Programmpunkt zugeordnet ist, wenn ich
      ihn zu löschen versuche, dann weist die Rückfrage darauf hin.
- [ ] Gegeben ich habe einen zugeordneten POI gelöscht, wenn ich den
      Zeitstrahl betrachte, dann ist der Programmpunkt weiterhin
      vorhanden.
- [ ] Gegeben ein importierter POI, dessen Namen ich von Hand geändert
      habe, wenn ich seinen Google-Link erneut einfüge, dann steht dort
      weiterhin mein Name.

# Constraints

- Die Nummer eines POI ändert sich nach der Vergabe nicht (siehe
  req-013).
- Bilder folgen der Ablageregel aus [stack.md](../../stack.md): Datei
  im Bildverzeichnis, Datensatz in der Datenbank, keine verwaisten
  Dateien.
- Ein hochgeladener Dateiname bestimmt nicht den Ablageort auf dem
  Server.
- Die Ortssuche nutzt die Ortsdaten von OpenStreetMap (siehe
  req-017).

# Nicht Teil dieses Requirements

- Mehrere POIs auf einmal anlegen oder löschen
- Verschieben eines POI in eine andere Reise
- Verlauf der Änderungen an einem POI
- Wiederherstellen eines gelöschten POI
- Bearbeiten von Programmpunkten
- Bilder zuschneiden oder drehen
