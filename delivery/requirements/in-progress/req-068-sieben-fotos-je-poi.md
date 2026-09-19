---
id: req-068
title: Sieben Fotos je POI statt drei
app: wegfara
area: Planung
priority: normal
created: 2026-09-19
---

# Goal (Why)

Als Reiseleiter sehe ich mir einen POI an, um zu entscheiden, ob er auf
die Liste kommt. Drei Fotos reichen dafür oft nicht: Bei einem Weingut
zeigen sie die Fassade, den Hof und ein Glas — ob es drinnen einladend
ist oder die Terrasse den Blick auf die Mosel hat, bleibt offen. Google
hat diese Bilder meist, wir holen sie nur nicht ab.

Sieben Fotos geben ein Bild vom Ort, ohne dass die Ansicht zur Galerie
wird.

# Function (What)

Beim Anlegen eines POI aus Google Places werden **bis zu sieben Fotos**
übernommen statt bisher drei (req-026). Liefert Google weniger, sind es
eben weniger.

Die Obergrenze steht an **einer** Stelle im Quelltext und gilt für beide
Wege, auf denen Fotos hereinkommen: die Abfrage bei Google und das
Anlegen des POI.

Sonst ändert sich nichts: Die Fotos werden wie bisher heruntergeladen und
abgelegt (req-026), das erste bleibt das Bild der POI-Zeile, und beim
Entfernen eines POI gehen seine Fotos mit.

# Acceptance Criteria

- [x] Gegeben ein Ort, zu dem Google sieben oder mehr Fotos hat, wenn ich
      ihn als POI anlege, dann liegen sieben Fotos in der Bildablage.
- [x] Gegeben ein Ort, zu dem Google nur zwei Fotos hat, wenn ich ihn als
      POI anlege, dann liegen zwei Fotos in der Bildablage und es
      erscheint keine Fehlermeldung.
- [x] Gegeben ein POI mit sieben Fotos, wenn ich ihn in der Liste
      betrachte, dann zeigt die Zeile weiterhin genau ein Bild.
- [ ] Gegeben ich entferne einen POI mit sieben Fotos, wenn ich die
      Bildablage betrachte, dann sind alle sieben mitentfernt.
- [ ] Gegeben die Obergrenze soll geändert werden, wenn ich den Quelltext
      durchsehe, dann steht sie an genau einer Stelle.

# Constraints

- Jedes Foto ist ein eigener Abruf bei Google und kostet. Sieben ist die
  Obergrenze, kein Sollwert — es wird nicht aufgefüllt.
- Die Fotos werden nach der Regel aus [stack.md](../../stack.md)
  abgelegt, wie in req-026 festgelegt.
- Die Breite der abgeholten Bilder bleibt bei 1200 px: ein Listenbild,
  kein Poster.
- Bestehende POIs werden nicht nachträglich um Fotos ergänzt.

# Out of Scope

- Eine Galerie-Ansicht für die Fotos eines POI.
- Fotos von Hand hinzufügen oder einzelne entfernen.
- Die Reihenfolge der Fotos ändern.
- Fotos zu Programmpunkten übernehmen.
