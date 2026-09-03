---
id: req-030
title: Salden und Ausgleich
app: wegfara
area: Reise
priority: high
created: 2026-09-03
---

# Ziel (Warum)

Am Ende einer Reise stehen zwanzig Ausgaben in der Liste, und niemand
weiß, wer wem was schuldet. Ich will das ausgerechnet sehen — und vor
allem: mit möglichst wenigen Überweisungen erledigt bekommen, statt
dass jeder mit jedem abrechnet.

# Funktion (Was)

Der Bereich „Kosten" zeigt über der Ausgabenliste eine Zusammenfassung
mit der Zahl der Teilnehmer, der Zahl der Ausgaben, der Gesamtsumme
aller Ausgaben und dem eigenen Saldo.

Ein Umschalter führt zwischen zwei Ansichten: **Übersicht** und **Alle
Ausgaben**. Die Ausgabenliste aus req-029 bleibt unverändert.

**Übersicht** zeigt zweierlei:

*Die Salden.* Je Teilnehmer, wie viel er ausgelegt hat und wie viel auf
ihn entfällt. Die Differenz ist sein Saldo — positiv, wenn er Geld
bekommt, negativ, wenn er schuldet. Die Summe aller Salden ist null.

*Den Ausgleich.* Eine Liste konkreter Zahlungen der Form „Clara zahlt
Uwe 40,00 €", die alle Salden auf null bringt — mit der kleinstmöglichen
Zahl an Zahlungen. Bei sechs Personen sind das höchstens fünf statt
fünfzehn.

Jede vorgeschlagene Zahlung lässt sich als erledigt abhaken. Dabei wird
sie als Ausgabe erfasst: Zahler ist der Zahlende, beteiligt ist allein
der Empfänger. Der Saldo gleicht sich dadurch aus, und der Vorschlag
verschwindet aus der Liste. Rückgängig geht es über die Ausgabenliste,
wo diese Rückzahlung wie jede andere Ausgabe entfernbar ist.

Sind alle Salden ausgeglichen, erscheint anstelle der Ausgleichsliste
der Hinweis „Alle Salden ausgeglichen". Die Salden-Liste bleibt
sichtbar, alle Werte bei 0,00 €.

Hat eine Reise keine Ausgaben, zeigt die Übersicht alle Teilnehmer mit
einem Saldo von 0,00 €.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt „3. Kosten (Gruppenkasse)" — Zusammenfassung, Umschalter
  „Übersicht | Alle Ausgaben", Salden-Liste mit beidseitigem Balken um
  eine Mittellinie (grün rechts = bekommt, warnfarben links = schuldet)
  und die Ausgleichsliste auf getöntem Grund.
- Verbindlichkeit: eng folgen.
- Ergänzung zur Vorlage: je Zahlung eine Schaltfläche zum Abhaken.

# Akzeptanzkriterien

- [ ] Gegeben eine Reise mit drei Teilnehmern und einer Ausgabe über
      60,00 €, die Uwe gezahlt hat und an der alle drei gleichmäßig
      beteiligt sind, wenn ich die Übersicht betrachte, dann hat Uwe
      einen Saldo von +40,00 €.
- [ ] Gegeben derselbe Zustand, wenn ich die Übersicht betrachte, dann
      hat jede der beiden anderen Personen einen Saldo von −20,00 €.
- [ ] Gegeben derselbe Zustand, wenn ich die Zusammenfassung betrachte,
      dann steht dort eine Gesamtsumme von 60,00 €.
- [ ] Gegeben derselbe Zustand, wenn ich die Ausgleichsliste betrachte,
      dann enthält sie genau zwei Zahlungen.
- [ ] Gegeben eine Reise mit sechs Teilnehmern und mehreren Ausgaben,
      wenn ich die Ausgleichsliste betrachte, dann enthält sie höchstens
      fünf Zahlungen.
- [ ] Gegeben eine beliebige Reise mit Ausgaben, wenn ich alle Salden
      zusammenzähle, dann ergeben sie 0,00 €.
- [ ] Gegeben die vorgeschlagene Zahlung „Clara zahlt Uwe 20,00 €",
      wenn ich sie abhake, dann erscheint eine entsprechende Ausgabe in
      der Ausgabenliste.
- [ ] Gegeben dieselbe abgehakte Zahlung, wenn ich die Übersicht
      betrachte, dann erscheint sie NICHT mehr in der Ausgleichsliste.
- [ ] Gegeben dieselbe abgehakte Zahlung, wenn ich die daraus
      entstandene Ausgabe entferne, dann erscheint die Zahlung wieder
      in der Ausgleichsliste.
- [ ] Gegeben alle Salden sind ausgeglichen, wenn ich die Übersicht
      betrachte, dann steht dort „Alle Salden ausgeglichen".
- [ ] Gegeben eine Reise ohne Ausgaben, wenn ich die Übersicht
      betrachte, dann hat jeder Teilnehmer einen Saldo von 0,00 €.

# Constraints

- Der Saldo einer Person ist die Differenz zwischen dem, was sie
  ausgelegt hat, und dem, was auf sie entfällt. Er wird aus den
  Ausgaben berechnet und nicht getrennt gespeichert — sonst könnten
  beide auseinanderlaufen.
- Eine abgehakte Zahlung wird als gewöhnliche Ausgabe abgelegt (siehe
  req-029). Es gibt keine zweite Ablage für Zahlungen zwischen
  Teilnehmern.
- Alle Beträge in Euro.

# Nicht Teil dieses Requirements

- Tatsächliches Überweisen von Geld
- Erinnerungen an offene Zahlungen
- Salden über mehrere Reisen hinweg
- Budget je Person und Budgetauslastung
- Ausgaben nach Kostengruppen (Unterkunft, Transport, …)
- Ansicht der Kosten im Planer
- Ausgabe der Abrechnung als Datei
