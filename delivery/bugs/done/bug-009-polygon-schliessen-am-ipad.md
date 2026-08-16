---
id: bug-009
title: Suchgebiet lässt sich am iPad nicht schließen
app: wegfara
area: Planung
severity: high
created: 2026-08-06
relates: req-012, bug-005, bug-007
---

# Beobachtung

Auf dem iPad lässt sich das Suchgebiet zeichnen, aber nicht schließen.
Ein Tippen auf den ersten Punkt setzt einen weiteren Eckpunkt, statt
die Fläche zu schließen. Zudem ist nicht erkennbar, welcher der Punkte
der erste ist — alle sehen gleich aus.

# Ursache

Zwei Punkte, beide in `app/plan/components/poi-map.tsx` und
`poi-map.module.css`.

**1. Der Griff reagierte nur auf `click`.** Auf einem Touchscreen
deutet die Kartenbibliothek eine Berührung zuerst als mögliche Geste;
ein Tippen erzeugt dabei oft kein `click`-Ereignis. Stattdessen griff
die Klick-Behandlung der Karte und setzte einen weiteren Punkt. Das
ist derselbe Mechanismus wie in bug-005, dort für das Setzen von
Punkten behoben — für den schließenden Griff blieb er bestehen.

**2. Die Trefferfläche war 14 Pixel groß.** Die Design-Vorlage nennt
mindestens 44 Pixel als Mindestmaß für Berührungen. Selbst mit
korrektem Ereignis wäre der Punkt kaum zu treffen gewesen.

Dazu die fehlende Unterscheidung: Alle Eckpunkte trugen dieselbe
Farbe, der Hinweistext sprach vom „ersten Punkt" — welcher das ist,
war nach ein paar Punkten nicht mehr erkennbar.

# Behebung

- Der erste Griff reagiert auf `pointerup` statt `click` und
  unterbindet, dass die Berührung als Kartenklick durchschlägt.
- Die sichtbare Größe bleibt klein, die Trefferfläche wächst per
  Pseudo-Element auf 44 × 44 Pixel.
- Der erste Punkt ist grün (`--pos`), etwas größer und trägt einen
  Ring — deutlich unterscheidbar von den übrigen in Akzentfarbe.
- Der Hinweistext nennt jetzt den grünen Punkt und die Bedingung „ab
  drei Punkten".

# Prüfung

- Neuer Test: Schließen über `pointerdown`/`pointerup` ohne
  `click`-Ereignis.
- Neuer Test: Der erste Griff trägt eine andere Klasse als die
  übrigen.
- Der bestehende Test aus bug-007 wurde von `click` auf `pointerup`
  umgestellt — er prüfte den Weg, der auf dem Touchscreen gerade nicht
  zustande kommt.

731 Tests grün, Typen sauber.
