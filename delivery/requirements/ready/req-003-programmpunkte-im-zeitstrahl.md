---
id: req-003
title: Programmpunkte im Zeitstrahl
app: wegfara
area: Reise
priority: high
created: 2026-07-28
---

# Ziel (Warum)

Als Reisender will ich sehen, was an einem Reisetag ansteht — in der
Reihenfolge, in der es passiert. Das ist der eigentliche Inhalt des
Begleiters: ohne den Tagesablauf ist die Reise nur ein Titel mit einem
Zeitraum.

# Funktion (Was)

Unter der Tagesauswahl erscheinen die Programmpunkte des gewählten
Reisetages untereinander, aufsteigend nach Beginnzeit. Links begleitet
sie eine senkrechte Linie mit einem nummerierten Kreis je Punkt; die
Nummerierung beginnt an jedem Reisetag wieder bei 1.

Jeder Programmpunkt zeigt: Beginn- und Endzeit, seinen Typ mit Symbol
und Farbe, den Titel und einen Kurztext. Ein ausführlicher Text ist
zunächst verborgen und lässt sich auf- und wieder zuklappen.

Jeder Programmpunkt trägt außerdem seine geografische Position. Sie
wird in dieser Ansicht nicht angezeigt, dient aber als Ortsbezug für
darauf aufbauende Anzeigen.

Es gibt fünf Typen mit fest zugeordneten Farben: Sehenswürdigkeit,
Restaurant, Hotel, Aktivität, Weltkulturerbe.

Ein Programmpunkt gehört zu dem Reisetag, an dem er beginnt — auch wenn
er über Mitternacht hinausreicht.

Hat ein Reisetag keine Programmpunkte, erscheint an ihrer Stelle der
Hinweis „Noch nichts geplant".

Alle drei Reisen haben zur Erprobung ausgearbeitete Programmpunkte;
mindestens ein Reisetag bleibt bewusst ohne, damit der Hinweis prüfbar
ist.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt „1. Plan (Tages-Zeitstrahl)" — Zeitstrahl mit Rail und
  nummerierten Kreisen, POI-Karte mit Typ-Chip, Zeit-Pille, Titel,
  Kurztext und aufklappbarem Langtext.
- Verbindlichkeit: eng folgen.
- Abweichung zur Vorlage: Anstelle des Fotos erscheint eine einfarbige
  Fläche in der Farbe des jeweiligen Typs, in derselben Höhe wie das
  Foto in der Vorlage. Echte Bilder folgen später.
- Typfarben und Symbole nach Abschnitt „Design Tokens" der Vorlage:
  Sehenswürdigkeit #8a63d2, Restaurant #e0603e, Hotel #2b7cc7,
  Aktivität #1f9d63, Weltkulturerbe #c9a227.

# Akzeptanzkriterien

- [ ] Gegeben die geöffnete Reise „Süditalien Rundreise" und ein
      gewählter Tag mit vier Programmpunkten, wenn ich den Zeitstrahl
      betrachte, dann sehe ich genau vier Programmpunkte.
- [ ] Gegeben derselbe Tag, wenn ich den Zeitstrahl von oben nach unten
      lese, dann steht der Programmpunkt mit der frühesten Beginnzeit
      an erster Stelle.
- [ ] Gegeben derselbe Tag, wenn ich den ersten Programmpunkt
      betrachte, dann trägt sein Kreis die Ziffer 1.
- [ ] Gegeben ich wechsle auf den zweiten Reisetag, wenn ich den ersten
      Programmpunkt dieses Tages betrachte, dann trägt sein Kreis
      ebenfalls die Ziffer 1.
- [ ] Gegeben ein Programmpunkt vom Typ Restaurant, wenn ich ihn
      betrachte, dann ist sein Typ-Chip in der Farbe #e0603e.
- [ ] Gegeben ein Programmpunkt mit Beginn 10:00 und Ende 12:30, wenn
      ich ihn betrachte, dann steht dort „10:00 – 12:30".
- [ ] Gegeben ein Programmpunkt mit ausführlichem Text, wenn ich „Mehr
      lesen" anklicke, dann erscheint der ausführliche Text.
- [ ] Gegeben ein aufgeklappter ausführlicher Text, wenn ich „Weniger
      anzeigen" anklicke, dann ist der ausführliche Text verborgen.
- [ ] Gegeben ein Reisetag ohne Programmpunkte, wenn ich ihn wähle,
      dann steht dort „Noch nichts geplant".
- [ ] Gegeben ein Programmpunkt, der um 22:00 beginnt und um 00:30
      endet, wenn ich den Folgetag wähle, dann erscheint dieser
      Programmpunkt dort NICHT.
- [ ] Gegeben ein Programmpunkt, wenn ich ihn betrachte, dann erscheint
      dort KEIN Foto.

# Constraints

- Beginn- und Endzeit sind bei jedem Programmpunkt gesetzt; es gibt
  keine Programmpunkte ohne Zeitangabe.

# Nicht Teil dieses Requirements

- Transfers zwischen den Programmpunkten (Wege, Dauer, Distanz)
- Live-Status, Soll-Ist-Abgleich per GPS und der „Jetzt"-Marker
- Zeitgleiche Programmpunkte als wählbare Optionen zum Durchwischen
- Buchungsstatus und die Schaltflächen Buchen, Anfragen, Anrufen,
  Unterlagen
- Navigation zu einem Programmpunkt und Verweise auf Google Maps
- Echte Fotos zu Programmpunkten
- Anlegen, Ändern oder Löschen von Programmpunkten durch den Nutzer
- Das Gold-Abzeichen für Weltkulturerbe mit Schimmer-Effekt
