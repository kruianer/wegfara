---
id: req-045
title: Ortssuche zuerst, Felder selbst füllen, Dauer am POI
app: wegfara
area: Planung
priority: high
created: 2026-09-05
changes: req-044
---

# Goal (Why)

Als Reiseleiter lege ich einen POI an, indem ich seinen Namen suche —
alles Übrige weiß der Kartendienst besser als ich. Heute steht die
Ortssuche mitten im Formular, und ich tippe Felder ab, die sich von
selbst ergeben. Außerdem fehlt mir die Dauer am POI: wie lange ich dort
bleiben will, weiß ich beim Sammeln, nicht erst beim Verplanen.

# Function (What)

Die **Ortssuche steht ganz oben** im POI-Formular, vor allen anderen
Feldern.

Ein gewählter Vorschlag füllt selbst: **Name, Typ, Adresse, Position**
und die **Dauer** (aus dem Typ). **Kurztext und Langtext** werden
gefüllt, wenn der Kartendienst eine Beschreibung kennt — sonst bleiben
sie leer.

Neben den Textfeldern steht **„Beschreibung vorschlagen"**: Auf
Knopfdruck schreibt die KI Kurz- und Langtext, gestützt auf eine
Websuche zum Namen des Ortes. Der Vorschlag erscheint in den Feldern und
ist dort änderbar; ohne Knopfdruck läuft kein KI-Aufruf. Ist für den
Account kein Zugangsschlüssel für die KI hinterlegt (req-028), erscheint
der Knopf nicht.

Alle selbst gefüllten Felder bleiben änderbar — was der Kartendienst
liefert, ist ein Vorschlag.

Die **Dauer** ist am POI in Schritten von 15 Minuten eintragbar und
freiwillig. Bleibt sie leer, gilt weiterhin die geschätzte Dauer des
POI-Typs (req-011): Sehenswürdigkeit 2,5 h, Stadt & Dorf 3 h, Restaurant
2 h, Strand 3 h, Aktivität 2 h, Hotel 1 h, Weltkulturerbe 2,5 h. Beim
Verplanen (req-039) bestimmt sie die Länge des Programmpunkts.

Die übrige Reihenfolge aus req-044 bleibt: nach der Ortssuche folgen
Name, Typ, Status, Kurztext, Langtext, Adresse, Ort, Position — die
Dauer nach dem Status.

Nach der Umsetzung wird [datenbank.md](../../datenbank.md) auf den
neuen Stand gebracht.

# Änderung gegenüber heute (req-044)

- Die Ortssuche steht heute zwischen Status und Adresse; sie wandert an
  den Anfang.
- Ein Vorschlag füllt heute nur Adresse und Position; künftig auch Name,
  Typ, Dauer sowie die Texte, soweit vorhanden.
- Die Dauer gibt es am POI heute nicht.
- Der Knopf „Beschreibung vorschlagen" ist neu.

# Acceptance Criteria

- [ ] Gegeben ich öffne das Formular zum Anlegen eines POI, wenn ich es
      von oben lese, dann steht die Ortssuche als erstes Feld.
- [ ] Gegeben ich suche „Villa Rufolo Ravello" und wähle den Vorschlag,
      wenn er übernommen ist, dann steht im Namensfeld „Villa Rufolo".
- [ ] Gegeben ich habe einen Ortsvorschlag gewählt, wenn ich das Feld
      Adresse ansehe, dann ist es gefüllt.
- [ ] Gegeben ich habe einen Ortsvorschlag gewählt, wenn ich das Feld
      Position ansehe, dann ist es gefüllt.
- [ ] Gegeben ein Ortsvorschlag, den der Kartendienst als
      Sehenswürdigkeit führt, wenn ich ihn wähle, dann steht als Typ
      „Sehenswürdigkeit".
- [ ] Gegeben ein gewählter Vorschlag vom Typ Sehenswürdigkeit, wenn ich
      das Feld Dauer ansehe, dann steht dort 2,5 h.
- [ ] Gegeben ich habe einen Ortsvorschlag gewählt, wenn ich den Namen
      danach in „Gärten der Villa Rufolo" ändere, dann wird meine
      Änderung übernommen.
- [ ] Gegeben ein Ort, zu dem der Kartendienst keine Beschreibung kennt,
      wenn ich ihn wähle, dann bleiben Kurztext und Langtext leer.
- [ ] Gegeben Kurztext und Langtext sind leer, wenn ich „Beschreibung
      vorschlagen" wähle, dann stehen danach Texte in beiden Feldern.
- [ ] Gegeben ich habe eine vorgeschlagene Beschreibung erhalten, wenn
      ich sie überschreibe und speichere, dann steht mein Text im POI.
- [ ] Gegeben für meinen Account ist kein Zugangsschlüssel für die KI
      hinterlegt, wenn ich das POI-Formular öffne, dann ist der Knopf
      „Beschreibung vorschlagen" NICHT vorhanden.
- [ ] Gegeben ich wähle einen Ortsvorschlag, wenn ich keinen Knopf
      drücke, dann wird KEINE KI-Anfrage ausgelöst.
- [ ] Gegeben ich trage als Dauer 1,5 h ein, wenn ich den POI speichere
      und wieder öffne, dann steht dort weiterhin 1,5 h.
- [ ] Gegeben ein POI vom Typ Restaurant mit eingetragener Dauer 1,5 h,
      wenn ich ihn auf den Zeitstrahl auf 12:00 ziehe, dann endet der
      Programmpunkt um 13:30.
- [ ] Gegeben ein POI vom Typ Restaurant ohne eingetragene Dauer, wenn
      ich ihn auf den Zeitstrahl auf 12:00 ziehe, dann endet der
      Programmpunkt um 14:00.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [datenbank.md](../../datenbank.md) öffne, dann ist die Dauer des
      POI dort beschrieben.

# Constraints

- Die Ortsdaten kommen von OpenStreetMap (siehe
  [stack.md](../../stack.md)); was es nicht kennt, kann nicht gefüllt
  werden.
- Die KI-Beschreibung läuft über den Zugangsschlüssel des Accounts
  (req-028) und kostet je Aufruf — deshalb nur auf Knopfdruck, nie von
  selbst.
- Der Zugriff auf die KI bleibt hinter der austauschbaren Schnittstelle
  in `lib/ai/` (siehe [stack.md](../../stack.md)); die Websuche wird
  Teil dieser Schnittstelle, kein Aufruf daran vorbei.
- Die Dauer folgt dem 15-Minuten-Raster des Zeitstrahls (req-039).

# Out of Scope

- Animierte Vorschau und die Kanten des Programmpunkts — das ist
  req-046.
- Beschreibungen für bestehende POIs nachträglich erzeugen.
- Beschreibungen bei der KI-Suche (req-014) oder beim Google-Import
  (req-026) automatisch erzeugen.
- Übersetzen der Beschreibung in andere Sprachen.
