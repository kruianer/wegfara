---
id: bug-019
app: wegfara
req: req-033
priority: normal
created: 2026-09-05
---

# Observed

In den Reisedetails überlappen sich die Spalten „von" und „bis".

# Expected

Beginn und Ende der Reise stehen nebeneinander, ohne sich zu
überlappen — beide Felder sind vollständig lesbar und bedienbar.

# Steps

1. Planer öffnen, Reisedetails einer Reise aufrufen
2. Die Eckdaten mit Beginn und Ende ansehen

# Ursache

Die Karte „Eckdaten der Reise" (req-033) legt ihre Felder in ein
zweispaltiges Raster; „Beginn" steht links, „Ende" rechts daneben. Jedes
Feld füllt seine Spalte über `width: 100%` bei `box-sizing: border-box`
(`components/cards.module.css`, `.input`).

Bei einem Datumsfeld reicht das nicht. WebKit — Safari am Mac wie am
iPad — setzt `input[type="date"]` als `inline-flex` mit dem eingebauten
Bedienteil darin und leitet die Breite des Felds daraus ab: `width: 100%`
wird dabei übergangen. Dazu trägt ein Formularelement von Haus aus
`min-width: auto` und kann deshalb nicht unter die Breite seines Inhalts
schrumpfen. Ist das eingebaute Bedienteil breiter als die Spalte — was
mit größerer Schrift oder einer Mindestschriftgröße im Browser schnell
der Fall ist —, wächst das Feld „Beginn" über seine Spalte hinaus und
legt sich über „Ende". Die Spalten selbst wachsen nicht mit
(`minmax(0, 1fr)`), also überlappen sie sich. Blink (Chrome, Edge) hält
sich an `width` und zeigt das Problem nicht — der Fehler ist auf den
ersten Blick browserabhängig.

Dieselbe Ursache macht das Datumsfeld in WebKit auch höher als die
Textfelder daneben, weil die inneren Teile eigene Innenabstände
mitbringen.

# Behebung

Das Datumsfeld bekommt seine Breite jetzt von der Spalte, nicht von
seinem Bedienteil (`components/cards.module.css`):

- `appearance: none` (samt `-webkit-appearance`) nimmt dem Feld die
  eingebaute Größe, sodass `width: 100%` wieder gilt.
- `min-width: 0` hebt die Sperre gegen das Schrumpfen auf,
  `max-width: 100%` deckelt es nach oben. Damit kann es seine Spalte
  unter keinen Umständen verlassen.
- `line-height: 1.25` gleicht seine Höhe an die Textfelder daneben an.
- Die inneren Teile (`::-webkit-datetime-edit` und der Wrapper darum)
  bekommen keinen eigenen Innenabstand mehr; sonst käme er zu dem des
  Felds hinzu und schöbe den Wert über dessen Rand.

Der Kalender bleibt bedienbar — er hängt am Feldtyp, nicht an seiner
Darstellung. In Blink ändert sich am Bild nichts, die Schaltfläche für
den Kalender bleibt sichtbar.

Geändert: `components/cards.module.css`.

# Prüfung

Neuer Test, der ohne die Behebung fehlschlägt:
`app/plan/components/eckdaten-card.layout.test.ts`. jsdom führt kein CSS
aus, deshalb wird wie bei bug-014 und bug-016 direkt am Blatt geprüft:
dass das Datumsfeld die eingebaute Breite abgelegt hat, auf die Breite
seiner Spalte schrumpfen darf, dieselbe Zeilenhöhe hat wie die Felder
daneben, seine inneren Teile keinen eigenen Innenabstand tragen — und
dass die Spalten des Rasters weiterhin nicht mitwachsen.

# Akzeptanzkriterien der Behebung

- [x] Gegeben die Reisedetails einer Reise, wenn ich die Eckdaten
      ansehe, dann stehen „Beginn" und „Ende" nebeneinander, ohne sich
      zu überlappen.
- [x] Gegeben dieselbe Ansicht, wenn ich beide Felder ansehe, dann ist
      ihr Datum vollständig lesbar.
- [x] Gegeben dieselbe Ansicht, wenn ich ein Datumsfeld antippe, dann
      lässt es sich weiterhin bedienen.
- [x] Gegeben dieselbe Ansicht, wenn ich die Höhe der Datumsfelder mit
      der von „Titel" und „Hauptort" vergleiche, dann ist sie dieselbe.
