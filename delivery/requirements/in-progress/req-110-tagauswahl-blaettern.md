---
id: req-110
title: Zwei Knöpfe zum Blättern in der Tagauswahl
app: wegfara
area: Planung
priority: normal
changes: req-011, req-040
created: 2026-11-16
---

# Goal (Why)

Die Tagauswahl über dem Zeitstrahl (`day-tabs.tsx`) ist eine waagerechte
Leiste. Hat die Spalte nicht genug Platz für alle Reisetage, lässt sie
sich rollen — aber **nichts zeigt das an und nichts lässt sich
greifen**:

```css
.row {
  overflow-x: auto;
  scrollbar-width: none;        /* Firefox */
}
.row::-webkit-scrollbar {
  display: none;                /* WebKit, Chromium */
}
```

Die Leiste ist absichtlich ausgeblendet, und das soll sie bleiben — ein
Balken quer über den Reitern sähe schlecht aus. Übrig bleibt damit
heute: die Tastatur, oder mit dem Finger wischen. Mit der Maus am
Laptop ist der Tag, der rechts hinausragt, **nicht erreichbar**.

Dass es auffällt, liegt an der festen Spaltenbreite des Zeitstrahls
(412 px, siehe req-109): Dort passen rund sechs Reiter. Eine
dreiwöchige Reise hat 21.

**Die Bildschirmprüfung konnte das nicht finden.** Sie erkennt
abgeschnittene Bedienelemente und fragt, ob der Nutzer dort rollen kann
(`lib/design/bildschirm-regeln.ts:95`) — bei `overflow-x: auto` lautet
die Antwort „ja", und damit gilt es als in Ordnung. Dass es keine
sichtbare Handhabe gibt, prüft sie nicht.

# Scope (What)

## Links und rechts je ein Knopf

Ein Knopf an jedem Ende der Leiste, zum Blättern nach hinten und nach
vorn. Beide tragen ein Pfeilsymbol und einen Titel, den Vorlesehilfen
ansagen.

**Ein Klick verschiebt um genau einen Reiter.** Vorhersehbar und
feinfühlig; wer weiter will, klickt oder hält. (Tastatur und Wischen
bleiben, wie sie sind.)

## Sie erscheinen nur, wenn es etwas zu blättern gibt

Passen alle Reisetage in die Leiste, stehen die Knöpfe **nicht** da —
bei einer Reise über ein Wochenende nehmen sie keinen Platz weg.

Ragt etwas hinaus, erscheinen sie. Jeder einzelne wird dabei
**unbenutzbar und blass, wenn es in seine Richtung nicht weitergeht**:
am linken Ende der linke, am rechten der rechte.

Das richtet sich nicht nach der Zahl der Tage, sondern nach dem
tatsächlichen Platz: Dieselbe Reise braucht die Knöpfe in einer schmalen
Spalte und in einer breiten nicht. Maßgeblich ist, ob die Leiste mehr
Inhalt hat als Breite — und das ändert sich auch beim Ziehen am Trenner
(req-109) und beim Drehen des iPads.

## Der gewählte Tag bleibt sichtbar

Wird ein Tag zum gewählten — durch einen Klick, durch Blättern des Plans
oder weil die Ansicht neu aufgeht —, rollt die Leiste ihn ins Bild,
falls er draussen steht. Sonst stünde der gewählte Tag unsichtbar neben
der Leiste.

## Die Reiter nehmen weiter Programmpunkte an

Ein Reiter ist auch ein Ablageziel: Ein Programmpunkt, der darauf fällt,
wandert auf diesen Tag (req-040, mit dem Finger seit bug-017). Die
Knöpfe dürfen das nicht beeinträchtigen:

- Sie sind **selbst kein Ablageziel**. Fällt ein Programmpunkt auf einen
  Knopf, geschieht nichts — er wandert nicht auf einen zufälligen Tag.
- Sie verdecken keinen Reiter, der gerade Ziel sein könnte.

Beim Ziehen an den Rand automatisch weiterzurollen gehört **nicht**
hierher (siehe Out of Scope) — das wäre eine eigene Überlegung mit
eigenen Fallen.

# Acceptance Criteria

- [x] Gegeben eine Reise, deren Tage alle in die Leiste passen, dann
      stehen **keine** Blätterknöpfe da.
- [x] Gegeben eine Reise mit mehr Tagen als Platz, dann stehen links und
      rechts je ein Knopf.
- [x] Gegeben die Leiste steht ganz links, dann ist der linke Knopf
      unbenutzbar und blass, der rechte benutzbar.
- [x] Gegeben die Leiste steht ganz rechts, dann ist es umgekehrt.
- [x] Gegeben ich klicke den rechten Knopf, dann verschiebt sich die
      Leiste um genau einen Reiter nach vorn.
- [x] Gegeben ich klicke den linken Knopf, dann um einen nach hinten.
- [x] Gegeben ich klicke so oft nach vorn, wie es Tage gibt, dann steht
      der letzte Tag ganz rechts und der rechte Knopf ist blass.
- [x] Gegeben ein gewählter Tag steht ausserhalb der Leiste, wenn die
      Ansicht aufgeht, dann ist er ins Bild gerollt.
- [x] Gegeben ich wähle einen Tag am Rand der Leiste, dann ist er danach
      ganz zu sehen und nicht halb abgeschnitten.
- [ ] Gegeben die Knöpfe stehen da, wenn ich die Spalte breiter ziehe
      (req-109), bis alle Tage passen, dann verschwinden sie.
- [x] Gegeben ich ziehe einen Programmpunkt auf einen Reiter, dann
      wandert er auf diesen Tag — wie bisher (req-040).
- [x] Gegeben ich lasse einen Programmpunkt auf einem Blätterknopf
      fallen, dann geschieht **nichts**: Er wandert auf keinen Tag.
- [x] Gegeben eine Vorlesehilfe liest einen Knopf, dann nennt er seine
      Richtung — nicht nur „Knopf".
- [x] Gegeben die Reiter bleiben erreichbar: Tastatur und Wischen
      funktionieren weiter wie bisher.
- [ ] Gegeben die Bildschirmprüfung bei 375, 768, 1280 und 1920 px, dann
      ist sie grün und das Tippziel jedes Knopfs mindestens 44 × 44 px
      (stack.md, Regel 4).

# Constraints

- Die Bildlaufleiste bleibt **ausgeblendet**. Die Knöpfe ersetzen sie,
  sie kommen nicht dazu.
- Die Knöpfe sind **kein Ablageziel** (req-040, bug-017).
- Ob geblättert werden kann, entscheidet der **gemessene Platz**
  (`scrollWidth` gegen `clientWidth`), nie die Zahl der Reisetage. Die
  Spaltenbreite ändert sich beim Ziehen am Trenner (req-109) und beim
  Drehen des Geräts.
- Die Reiter behalten ihr Mass und ihr Tippziel von 44 px (req-099).
  Die Knöpfe nehmen Platz von der Leiste, nicht von den Reitern.
- Gerollt wird so, dass ein Reiter **ganz** zu sehen ist — kein halb
  abgeschnittener am Rand.
- Dieselbe Leiste gibt es im Begleiter (`app/go/components/day-selector`)
  und bei den Options-Karten (`activity-option-group`), beide ebenfalls
  mit ausgeblendeter Leiste. Entsteht hier ein Baustein, ist er so zu
  bauen, dass sie ihn später benutzen können — **ohne** sie jetzt
  umzustellen (vgl. bug-048 gegen bug-065: der Fix an einer Stelle und
  nicht an der Schwester).

# Out of Scope

- **Beim Ziehen eines Programmpunkts automatisch weiterrollen**, wenn er
  an den Rand kommt. Nützlich, aber eine eigene Überlegung: Wie schnell,
  ab welchem Abstand, und was passiert beim Loslassen über dem
  rollenden Rand.
- Die Bildlaufleiste wieder einzublenden.
- Dieselben Knöpfe im Begleiter oder an den Options-Karten. Dort fällt
  es nicht auf: die Leiste steht über die ganze Breite.
- Die Tagauswahl umzubauen — etwa zu einer Liste mit Auswahlfeld oder
  einem Kalender.
- Eine Tastenkürzel-Belegung zum Blättern.
- Die Bildschirmprüfung um eine Regel zu erweitern, die eine fehlende
  Handhabe bei waagerechtem Überlauf findet. Wäre folgerichtig, ist aber
  ein eigenes Thema — und müsste erst entscheiden, was als Handhabe
  gilt.
