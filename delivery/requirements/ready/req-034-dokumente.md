---
id: req-034
title: Dokumente ablegen und ansehen
app: wegfara
area: Planung
priority: high
created: 2026-09-04
---

# Ziel (Warum)

Tickets, Buchungsbestätigungen und Mietwagenverträge liegen heute im
Postfach oder auf dem Handy verstreut. Ich will sie bei der Reise
ablegen — und unterwegs am Bahnhof ein Ticket abfotografieren, statt
es später zu suchen.

# Funktion (Was)

Der Bereich „Dokumente" des Planers zeigt die Dokumente der geöffneten
Reise als Karten mit Dateisymbol, Name, Größe, Datum und der Person,
die es abgelegt hat.

**Ablegen** geschieht auf zwei Wegen: eine Datei vom Gerät auswählen
oder mit der Kamera fotografieren. Beides ist im Planer und im
Begleiter möglich — unterwegs am Handy ist das Fotografieren der
Normalfall.

Erlaubt sind Bilder und PDF-Dateien, höchstens 20 MB je Datei. Andere
Dateien werden abgewiesen; ein Hinweis nennt den Grund.

Jedes Dokument gehört zu einer Reise. Zusätzlich kann es mit einem POI
oder einem Transfer dieser Reise verknüpft werden. Filter zeigen
wahlweise alle, die mit einem POI verknüpften, die mit einem Transfer
verknüpften oder die ohne Verknüpfung.

**Ansehen**: Ein Klick öffnet das Dokument formatfüllend über der
Seite, mit abgedunkeltem Hintergrund. Bei mehrseitigen PDF-Dateien
lässt sich blättern. Ein Klick daneben oder auf „Schließen" beendet
die Ansicht.

**Ändern** betrifft Name und Verknüpfung. Die Datei selbst wird nicht
ersetzt — dafür wird ein neues Dokument abgelegt und das alte entfernt.

**Entfernen** erfolgt nach einer Rückfrage mit dem Namen des
Dokuments. Datei und Datensatz verschwinden gemeinsam.

Hat eine Reise keine Dokumente, erscheint der Hinweis „Noch keine
Dokumente abgelegt".

# Datei und Datensatz

Die Datei liegt im Bildverzeichnis auf dem Server, der Datensatz in der
Datenbank (siehe [stack.md](../../stack.md)). Beide müssen jederzeit
zueinander passen:

- **Beim Ablegen** wird zuerst die Datei geschrieben, dann der
  Datensatz. Scheitert der Datensatz, wird die Datei wieder entfernt.
- **Beim Entfernen** wird zuerst der Datensatz entfernt, dann die
  Datei. Scheitert die Datei, bleibt kein Datensatz zurück, der ins
  Leere zeigt.
- **Täglich** prüft ein Lauf beide Seiten gegeneinander: Dateien ohne
  Datensatz werden entfernt — sie sind wertlos. Datensätze ohne Datei
  werden **gemeldet, nicht entfernt** — dort ist etwas verlorengegangen,
  und das soll auffallen.

Beim Entfernen einer Reise verschwinden ihre Dokumente mitsamt den
Dateien.

# GUI

- Vorlage: `delivery/design/planer/README (1).md`, Abschnitt
  „5. Dokumente" — Kachelraster, Dateisymbol mit Endung, Name, Meta
  „Größe · Datum · Uploader", Verknüpfungs-Kennzeichnung und die
  Filterleiste.
- Verbindlichkeit: eng folgen.
- Die Vollbildansicht folgt dem Beleg-Overlay aus
  `delivery/design/design 1.0/Reise Companion.dc.html`, Abschnitt
  „3. Kosten".
- Im Begleiter erscheinen die Dokumente in einer einspaltigen Liste;
  das Fotografieren liegt dort als Schaltfläche oben.

# Akzeptanzkriterien

- [ ] Gegeben eine Reise ohne Dokumente, wenn ich den Bereich
      „Dokumente" öffne, dann steht dort „Noch keine Dokumente
      abgelegt".
- [ ] Gegeben der Bereich „Dokumente", wenn ich eine PDF-Datei
      „Flugticket.pdf" ablege, dann erscheint sie als Karte in der
      Liste.
- [ ] Gegeben dieselbe Datei, wenn ich ihre Karte betrachte, dann
      stehen dort ihre Größe und das Datum.
- [ ] Gegeben der Bereich „Dokumente", wenn ich eine Datei mit 25 MB
      abzulegen versuche, dann wird sie NICHT abgelegt.
- [ ] Gegeben der Bereich „Dokumente", wenn ich eine Datei mit der
      Endung „.zip" abzulegen versuche, dann wird sie NICHT abgelegt.
- [ ] Gegeben ein abgelegtes Dokument, wenn ich seine Karte anklicke,
      dann erscheint es formatfüllend über der Seite.
- [ ] Gegeben die Vollbildansicht, wenn ich daneben klicke, dann ist
      sie geschlossen.
- [ ] Gegeben ein Dokument, wenn ich es mit dem POI „Villa Rufolo"
      verknüpfe, dann erscheint diese Verknüpfung auf seiner Karte.
- [ ] Gegeben Dokumente mit und ohne Verknüpfung, wenn ich den Filter
      „Ohne Verknüpfung" wähle, dann erscheinen nur die unverknüpften.
- [ ] Gegeben ein abgelegtes Dokument, wenn ich es zu entfernen
      versuche, dann nennt die Rückfrage seinen Namen.
- [ ] Gegeben ich habe die Rückfrage bestätigt, wenn ich das
      Bildverzeichnis betrachte, dann liegt dort KEINE Datei zu diesem
      Dokument mehr.
- [ ] Gegeben ich öffne den Begleiter auf einem Gerät mit Kamera, wenn
      ich den Bereich „Dokumente" betrachte, dann gibt es dort eine
      Schaltfläche zum Fotografieren.
- [ ] Gegeben eine Datei im Bildverzeichnis ohne zugehörigen
      Datensatz, wenn die tägliche Prüfung gelaufen ist, dann ist die
      Datei entfernt.
- [ ] Gegeben ein Datensatz ohne zugehörige Datei, wenn die tägliche
      Prüfung gelaufen ist, dann ist der Datensatz NICHT entfernt.

# Constraints

- Dateien liegen im Dateisystem, die Wahrheit steht in der Datenbank
  (siehe [stack.md](../../stack.md)). Kein Dokument ohne Datensatz,
  kein Datensatz ohne Datei.
- Dokumente sind nur für angemeldete Personen des Accounts abrufbar,
  nie über eine erratbare Adresse (siehe
  [security.md](../../security.md)).
- Der Ablageort ergibt sich aus der Umgebungsvariablen des
  Bildverzeichnisses, nie aus einem fest verdrahteten Pfad.
- Ein hochgeladener Dateiname bestimmt nicht den Ablageort auf dem
  Server — sonst ließe sich über einen Namen wie `../` außerhalb des
  Verzeichnisses schreiben.

# Nicht Teil dieses Requirements

- Belege zu Ausgaben (siehe req-029)
- Auslesen von Inhalten per KI
- Ordner oder Kategorien für Dokumente
- Teilen eines Dokuments über einen Link nach außen
- Versionen desselben Dokuments
- Dokumente ohne Bezug zu einer Reise
