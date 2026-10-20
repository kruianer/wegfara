---
id: bug-063
app: wegfara
req: req-055
priority: normal
created: 2026-10-19
---

# Observed

Die Kopfzeile des Begleiters trägt zu viel: die Reise, „Zum Planer", die
Themenwahl, „Mein Bereich" und „Abmelden". Das hat keinen Platz — der
Begleiter läuft am Handy.

# Expected

**Im Kopf nur die Reise.** Alles andere wandert in die untere Leiste,
hinter einen Menüpunkt **„Mehr"**, der sich als Auswahl öffnet.

Unter „Mehr" stehen:

- Zum Planer
- Themenwahl
- Mein Bereich
- Abmelden
- die noch nicht gebauten Bereiche **Meldungen** und **Concierge**,
  abgeschaltet erkennbar

Damit hat die untere Leiste fünf Einträge: Plan, Karte, Kosten,
Dokumente, Mehr.

# Steps

1. Begleiter am Handy öffnen (375 px)
2. Auf die Kopfzeile sehen: Reisename, vier weitere Bedienelemente
3. Für den Reisenamen bleibt kaum Raum

# Ursache

Die Kopfzeile sammelt fünf Dinge
([header.tsx](../../../app/go/components/header.tsx)):

| Zeile | Element |
|---|---|
| 104 | Reise-Umschalter mit Wetter |
| 146 | „Zum Planer" (Symbol **und** Text, bug-035/bug-056) |
| 151 | `ThemeButton` |
| 152 | `MeinBereichLeiste` — darin **zwei** Elemente: „Mein Bereich" und „Abmelden" |

Der Wechsel in den Planer trägt seit bug-035 bewusst eine Beschriftung,
weil er zwischen Symbolen unterging; bug-056 hat ihn danach wieder
zurückgenommen. Beide Bugs haben am falschen Ort gezogen — das Problem
ist nicht die Größe eines Elements, sondern ihre Zahl.

Die untere Leiste
([bottom-nav.tsx](../../../app/go/components/bottom-nav.tsx), Zeilen
27–33) hat heute sechs Einträge, davon zwei mit `enabled: false`
(Meldungen, Concierge) — noch nicht gebaut. Wandern sie unter „Mehr",
bleibt die Leiste bei fünf Einträgen und behält auf 375 px genug
Trefferfläche.

# Erwartete Behebung

- Im Kopf **nur** der Reise-Umschalter (mit Wetter, wie heute).
- In der unteren Leiste ein fünfter Eintrag **„Mehr"**, der eine Auswahl
  öffnet.
- Darin die vier Wege aus dem Kopf plus die zwei abgeschalteten
  Bereiche; abgeschaltete bleiben als solche erkennbar und sind nicht
  auslösbar (`NOCH_NICHT_HINWEIS`-Gedanke aus bug-033).
- „Zum Planer" erscheint unter „Mehr" weiterhin nur, wenn die Person den
  Planer überhaupt darf und der Bildschirm breit genug ist
  (`zeigtWechsel`, bug-035) — sonst führte der Weg ins Leere.
- Die Auswahl schließt sich beim Wählen eines Eintrags, bei einem Tipp
  daneben und mit Escape (wie die Seitenleiste des Planers, req-077).
- Jede Trefferfläche bleibt bei mindestens 44 × 44 px (siehe
  [stack.md](../../stack.md)).

Wie die Auswahl aussieht — als Blatt von unten, als Liste über der Leiste
—, entscheidet die Umsetzung.

# Notes

Die Themenwahl öffnet heute ein eigenes Blatt (`onOpenThemeSheet`). Unter
„Mehr" wäre das ein Blatt aus einem Blatt; beim Beheben ist zu prüfen, ob
die Themenwahl stattdessen in die Auswahl selbst gehört.

Der Begleiter ist die Sicht für unterwegs: Geprüft wird vor allem bei
375 px, dazu bei 768 px und 1280 px (siehe [stack.md](../../stack.md)).
