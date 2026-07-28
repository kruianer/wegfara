---
id: req-002
title: Wetter im Kopfbereich
app: wegfara
area: Reise
priority: normal
created: 2026-07-28
---

# Ziel (Warum)

Als Reisender will ich beim Öffnen des Begleiters auf einen Blick
sehen, wie das Wetter am Reiseort ist. Es entscheidet unterwegs
darüber, ob ein Programmpunkt überhaupt Sinn ergibt — und ist damit der
erste Hinweis darauf, dass der Plan angepasst werden sollte.

# Funktion (Was)

Im Kopfbereich erscheint neben dem Reisezeitraum die Wetterlage am
Hauptort der geöffneten Reise: Temperatur in Grad Celsius und
Regenwahrscheinlichkeit in Prozent, jeweils mit dem im Design
vorgesehenen Symbol.

Welcher Zeitpunkt gilt, hängt vom gewählten Reisetag ab:
- Liegt der gewählte Tag innerhalb der nächsten 16 Tage, gilt die
  Vorhersage für diesen Tag: Tageshöchsttemperatur und höchste
  Regenwahrscheinlichkeit des Tages.
- Liegt er weiter in der Zukunft oder in der Vergangenheit, gilt das
  aktuelle Wetter am Hauptort.
- Liefert die Wetterquelle für den gewählten Tag keine Vorhersage, gilt
  ebenfalls das aktuelle Wetter.

Ist das Wetter nicht abrufbar, bleibt der Wetterbereich leer. Titel und
Zeitraum bleiben unverändert sichtbar; es erscheint weder eine
Fehlermeldung noch ein Platzhalterwert.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt Header — Untertitel-Zeile mit Sonnen-Symbol, Temperatur,
  Tropfen-Symbol (#4a90d9) und Prozentwert.
- Verbindlichkeit: eng folgen.

# Akzeptanzkriterien

- [ ] Gegeben die geöffnete Reise „Süditalien Rundreise" mit Hauptort
      Amalfi und der gewählte Tag ist heute, wenn ich den Kopfbereich
      betrachte, dann steht dort eine Temperatur in Grad Celsius.
- [ ] Gegeben derselbe Zustand, wenn ich den Kopfbereich betrachte, dann
      steht dort eine Regenwahrscheinlichkeit in Prozent.
- [ ] Gegeben die geöffnete Reise „Süditalien Rundreise" und ich wechsle
      in der Tagesauswahl auf einen anderen Reisetag innerhalb der
      nächsten 16 Tage, wenn ich den Kopfbereich betrachte, dann
      entspricht die Temperatur der Vorhersage für diesen Tag.
- [ ] Gegeben die geöffnete Reise „Alpen-Adria-Radtour" (25.–31.05.2026,
      Zeitraum liegt in der Vergangenheit), wenn ich den Kopfbereich
      betrachte, dann steht dort das aktuelle Wetter für Villach.
- [ ] Gegeben die Wetterquelle ist nicht erreichbar, wenn ich den
      Begleiter öffne, dann erscheint im Kopfbereich KEINE
      Wetterangabe.
- [ ] Gegeben die Wetterquelle ist nicht erreichbar, wenn ich den
      Kopfbereich betrachte, dann sind Reisetitel und Zeitraum
      unverändert sichtbar.
- [ ] Gegeben ich habe soeben das Wetter für den 20.07.2026 abgerufen,
      wenn ich innerhalb von 15 Minuten erneut auf denselben Tag
      wechsle, dann erfolgt KEIN erneuter Abruf bei der Wetterquelle.

# Constraints

- Wetterquelle ist Open-Meteo (open-meteo.com). Sie erfordert keinen
  API-Schlüssel und erlaubt das Speichern der Daten (CC-BY). Ein
  Wechsel auf einen Dienst, der das Speichern untersagt oder Kosten
  verursacht, ist nicht zulässig.
- Der Ortsbezug ist vorläufig: Das Wetter gilt für den Hauptort der
  Reise. Zielbild ist ein anderes — während der Reise soll die
  tatsächliche GPS-Position gelten, davor der Ort des ersten
  Programmpunkts. Beides ist heute nicht möglich, weil weder
  Standortermittlung noch Programmpunkte existieren. Diese Anzeige ist
  daher ausdrücklich als Zwischenschritt zu bauen und wird später
  ersetzt.

# Nicht Teil dieses Requirements

- Standortermittlung per GPS und Wetter an der tatsächlichen Position
- Wetter am Ort einzelner Programmpunkte
- Wettervorhersage über mehrere Tage als eigene Ansicht
- Warnungen oder Umplanungsvorschläge aufgrund des Wetters
- Wetterangaben an anderer Stelle als im Kopfbereich
