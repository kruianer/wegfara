---
id: bug-064
app: wegfara
req: req-055
priority: normal
created: 2026-10-19
---

# Observed

Im Begleiter zeigt der Mauszeiger über dem Menüpunkt **Karte** ein
„Durchfahrt verboten"-Schild. Anklicken lässt sich der Eintrag trotzdem —
er funktioniert.

# Expected

Der Zeiger sagt, was möglich ist: über einem Eintrag, der sich wählen
lässt, die Hand (`pointer`). Das Verbotsschild gehört allein zu den
Einträgen, die wirklich abgeschaltet sind.

# Steps

1. Begleiter auf einem Gerät mit Maus öffnen
2. Mit dem Zeiger über **Karte**, **Kosten** oder **Dokumente** fahren
3. Der Zeiger zeigt `not-allowed`
4. Klicken funktioniert dennoch

# Ursache

`cursor: not-allowed` steht auf **`.item`**
([bottom-nav.module.css](../../../app/go/components/bottom-nav.module.css),
Zeile 34) — der Grundklasse **jedes** Eintrags der unteren Leiste, nicht
nur der abgeschalteten.

Betroffen sind damit alle wählbaren Einträge außer dem gerade aktiven:
Dort überschreibt `.active` (Zeile 60) den Zeiger mit `default`. Der
aktive Eintrag sah deshalb richtig aus, und der Fehler fiel nur an den
übrigen auf.

Die Regel gehört an die Klasse der abgeschalteten Einträge — in
[bottom-nav.tsx](../../../app/go/components/bottom-nav.tsx) sind das die
mit `enabled: false` (heute Meldungen und Concierge).

# Erwartete Behebung

- Ein wählbarer Eintrag zeigt `cursor: pointer`.
- Der aktive Eintrag zeigt weiterhin `default` — er führt nirgendwo hin.
- Ein abgeschalteter Eintrag zeigt `not-allowed` und ist auch wirklich
  nicht auslösbar.

# Notes

Am Finger fällt das nicht auf — der Begleiter läuft meist am Handy.
Sichtbar wird es auf dem iPad mit Tastatur und am Laptop.

Beim Beheben ist zu prüfen, ob dieselbe Verwechslung — Zeiger auf der
Grundklasse statt auf der abgeschalteten — in der Bereichsleiste und der
Seitenleiste des Planers steckt (req-077, bug-051 betraf dort die Farbe
abgeschalteter Einträge).

Berührt bug-063: Wandern die abgeschalteten Bereiche unter „Mehr", bleibt
in der Leiste selbst kein abgeschalteter Eintrag übrig — die Regel wird
dort dann gar nicht mehr gebraucht, sondern nur noch in der Auswahl.
