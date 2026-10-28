---
id: req-101
title: Die Gegend ist ein Kürzel
app: wegfara
area: Planung
priority: normal
changes: req-095, req-097, req-098, req-099
created: 2026-10-28
---

# Goal (Why)

Die Gegend am POI (req-095) ist heute ein freier Name: „Bilbao", „San
Sebastián", „Rioja Alavesa". In der schmalen POI-Liste (req-097) und in
der POI-Auswahl der Planung (req-099) steht dafür kein Platz — „San
Sebastián" braucht rund 74 px, und der Name ist beliebig lang.

Die Gegend ist aber **keine Beschreibung, sondern eine Gruppierung**: Sie
sagt, welche POIs zusammengehören. Dafür genügt ein Kürzel.

Ein zweites Feld neben dem Namen wäre der naheliegende Weg gewesen, ist
aber unnötig: Wer die Gegend selbst vergibt, kann sie gleich kurz
benennen. **Die Gegend ist das Kürzel** — es gibt keinen Langnamen
dazu.

# Function (What)

## Die Gegend wird auf wenige Zeichen begrenzt

Das Feld „Gegend" in den POI-Details nimmt **höchstens 6 Zeichen**. Damit
passt es in jede Spalte, und die Liste bleibt fest breit.

Die Beschriftung sagt, was gemeint ist: ein kurzes Kennzeichen wie `BIO`,
`SSE`, `RIO` — nicht der Name einer Stadt.

Alles andere aus req-095 bleibt:

- Die Gegend gilt **je Reise**.
- Sie existiert, **solange ein POI sie trägt**; keine Tabelle, keine
  Verwaltung, kein Aufräumen.
- Die vorhandenen Gegenden stehen als **Vorschlagsliste** am Feld — damit
  schreibt man ein Kürzel zweimal und wählt es danach.
- Groß- und Kleinschreibung entscheidet nicht: `bio` kommt zu `BIO` dazu.

## Was sich zusätzlich ändert

**Keine Vorschläge, keine Ableitung.** Das Kürzel kommt vom Reiseleiter,
nicht aus den ersten Buchstaben eines Orts. Ein automatisches `SAN` für
„San Sebastián" *und* „Santander" wäre eine Kollision, die niemand kommen
sieht.

**Der volle Name entfällt** — es gibt keinen. Wo heute der Name im
`title` beim Überfahren erscheinen sollte (so stand es im Entwurf zu
req-097), steht künftig nichts weiter: Das Kürzel ist der Name.

## Bestehende Gegenden

POIs, die schon eine längere Gegend tragen, behalten sie. Sie wird
**nicht automatisch gekürzt** — „Bilbao" auf „Bil" zu schneiden würde
raten, und der Reiseleiter sieht es ohnehin beim nächsten Öffnen.

In der Liste wird eine zu lange Gegend abgeschnitten dargestellt, wie
heute. Beim nächsten Speichern des POI verlangt das Feld die 6 Zeichen.

# GUI

- Das Feld bleibt, wo es ist (POI-Details, unter dem Ort), und bleibt ein
  Textfeld mit Vorschlagsliste.
- Es wird **schmal**: Sechs Zeichen brauchen keine volle Feldbreite.
- Der Hinweis darunter nennt den Zweck in einem Satz und ein Beispiel.
- In der POI-Liste und der POI-Auswahl steht das Kürzel in einer Pille
  fester Breite (req-097, req-099).

# Acceptance Criteria

- [ ] Gegeben ich öffne die Details eines POI, wenn ich das Feld „Gegend"
      ansehe, dann nimmt es höchstens 6 Zeichen.
- [ ] Gegeben ich tippe „BIO" und speichere, wenn ich den POI erneut
      öffne, dann steht „BIO" da.
- [ ] Gegeben ich versuche „San Sebastián" einzugeben, wenn ich das Feld
      ansehe, dann sind nur die ersten 6 Zeichen angenommen.
- [ ] Gegeben ein POI der Reise trägt „BIO", wenn ich einen anderen POI
      öffne, dann steht „BIO" als Vorschlag am Feld.
- [ ] Gegeben ein POI trägt „BIO" und ich tippe bei einem zweiten „bio",
      wenn ich die Liste der Gegenden ansehe, dann steht dort eine
      Gegend.
- [ ] Gegeben ich lasse das Feld leer, wenn ich speichere, dann trägt der
      POI keine Gegend.
- [ ] Gegeben ich tippe „  BIO  ", wenn ich speichere, dann steht „BIO"
      da.
- [ ] Gegeben POIs mit den Gegenden „BIO" und „SSE", wenn ich nach „BIO"
      filtere, dann stehen nur diese POIs da.
- [ ] Gegeben ein POI, der vor dieser Änderung die Gegend „Bilbao"
      erhielt, wenn ich ihn öffne, dann steht sie weiterhin da.
- [ ] Gegeben eine Gegend wird beim letzten POI entfernt, wenn ich die
      Vorschlagsliste ansehe, dann steht sie nicht mehr darin.
- [ ] Gegeben das Feld „Gegend", wenn ich den Hinweis darunter lese, dann
      nennt er ein Beispiel für ein Kürzel.

# Constraints

- Die Höchstlänge steht als benannter Wert an **einer** Stelle, bei den
  übrigen Regeln zur Gegend (`lib/pois/gegenden.ts`), und gilt für
  Formular, Datenzugriff und Datenbank-Bedingung gleichermassen.
- `normalisiereGegend` bleibt die einzige Stelle, die aufräumt (req-095).
  Sie kürzt **nicht** — eine zu lange Eingabe wird abgewiesen, nicht
  stillschweigend beschnitten.
- Bestehende Werte bleiben unverändert. **Keine Migration**, die kürzt:
  Sie würde raten, und ein abgeschnittenes „Bilb" wäre schlechter als der
  alte Wert.
- Die Datenbank-Bedingung aus Migration 0053
  (`poi_gegend_nicht_leer`) bleibt; eine Längenbedingung kommt dazu, aber
  so, dass vorhandene längere Werte nicht ungültig werden. Falls das
  nicht geht, trägt die Länge allein die Anwendungsschicht — dann steht
  der Grund im Quelltext.
- Es entsteht **keine Tabelle** für Gegenden und keine Stelle zum
  Verwalten. Das war die Entscheidung in req-095 und bleibt sie.

# Out of Scope

- Ein zweites Feld für einen Langnamen der Gegend.
- Kürzel vorschlagen oder aus dem Ort ableiten.
- Gegenden umbenennen oder zusammenführen. Umbenennen heisst weiter: an
  jedem POI ändern.
- Bestehende Gegenden automatisch kürzen.
- Einen POI mehreren Gegenden zuordnen.
- Die Gegend im Begleiter oder auf der Karte zeigen.
- Das Aussehen der Gegend-Pille — das sind req-097 und req-099.
