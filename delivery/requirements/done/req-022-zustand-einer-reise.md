---
id: req-022
title: Zustand einer Reise
app: wegfara
area: Planung
priority: normal
created: 2026-09-03
---

# Ziel (Warum)

Als Reiseleiter will ich selbst bestimmen, ab wann die Mitreisenden
eine Reise sehen und ab wann sie erledigt ist. Der Zeitraum sagt nur,
wann das Programm stattfindet — er sagt nicht, ob ich noch plane oder
ob nach der Rückkehr noch abgerechnet wird.

# Funktion (Was)

Jede Reise trägt einen Zustand, den ich setze: **In Planung**,
**Freigegeben** oder **Abgeschlossen**.

- *In Planung* — ich arbeite noch daran, die Mitreisenden sollen sie
  noch nicht sehen.
- *Freigegeben* — die zugeordneten Personen dürfen darauf zugreifen.
  Das ist unabhängig vom Zeitraum: eine Reise kann Wochen vor ihrem
  Beginn freigegeben sein, damit sich alle vorbereiten können.
- *Abgeschlossen* — die Reise ist erledigt, auch die Abrechnung. Das
  ist nicht der letzte Reisetag: nach der Rückkehr wird oft noch
  Wochen an den Kosten gearbeitet.

Der Zustand lässt sich jederzeit in beide Richtungen wechseln. Eine
Freigabe kann zurückgenommen, eine abgeschlossene Reise wieder geöffnet
werden.

Er wird im Aufklappmenü am Reisenamen gesetzt, dort wo die Reisen zur
Auswahl stehen.

Eine neu angelegte Reise steht auf *In Planung*.

Der Zustand ist unabhängig vom Zeitraum. Der bisher aus dem Zeitraum
berechnete Zeitstatus — Aktiv, Geplant, Beendet — bleibt bestehen und
erscheint weiterhin; beide werden nebeneinander angezeigt.

In diesem Requirement schränkt der Zustand noch nichts ein: Alle
angemeldeten Personen sehen weiterhin alle Reisen.

# GUI

- Im Aufklappmenü am Reisenamen trägt jede Reise zwei Kennzeichnungen
  nebeneinander: den Zeitstatus wie bisher und den neuen Zustand.
- Die beiden sind optisch unterscheidbar, damit sie nicht verwechselt
  werden.
- Der Zustand der geöffneten Reise lässt sich dort umstellen.

# Akzeptanzkriterien

- [ ] Gegeben ich öffne das Aufklappmenü am Reisenamen, wenn ich die
      Reise „Süditalien Rundreise" betrachte, dann sehe ich ihren
      Zustand.
- [ ] Gegeben die Reise „Süditalien Rundreise" steht auf „In Planung",
      wenn ich sie auf „Freigegeben" setze, dann steht dort
      „Freigegeben".
- [ ] Gegeben die Reise steht auf „Freigegeben", wenn ich die Seite neu
      lade, dann steht sie weiterhin auf „Freigegeben".
- [ ] Gegeben die Reise steht auf „Freigegeben", wenn ich sie zurück
      auf „In Planung" setze, dann steht dort „In Planung".
- [ ] Gegeben die Reise steht auf „Abgeschlossen", wenn ich sie auf
      „Freigegeben" setze, dann steht dort „Freigegeben".
- [ ] Gegeben ich lege eine neue Reise an, wenn ich ihren Zustand
      betrachte, dann steht dort „In Planung".
- [ ] Gegeben heute ist der 20.07.2026 und die Reise „Süditalien
      Rundreise" läuft vom 18. bis 23.07.2026 und steht auf „In
      Planung", wenn ich das Aufklappmenü betrachte, dann erscheint bei
      ihr sowohl „Aktiv" als auch „In Planung".
- [ ] Gegeben die Reise „Wien Städtereise" steht auf „In Planung", wenn
      ich sie im Aufklappmenü betrachte, dann ist sie weiterhin
      auswählbar.
- [ ] Gegeben eine Reise steht auf „Abgeschlossen", wenn ich sie öffne,
      dann lassen sich ihre Programmpunkte weiterhin betrachten.

# Constraints

- Der Zustand wird gesetzt, nicht berechnet. Er darf sich nicht aus dem
  Zeitraum ableiten — sonst wäre „freigegeben vor Reisebeginn" oder
  „nach der Rückkehr noch offen" nicht abbildbar.
- Der aus dem Zeitraum berechnete Zeitstatus (Aktiv, Geplant, Beendet)
  bleibt unverändert erhalten. Es entsteht keine zweite, widersprechende
  Quelle für dieselbe Aussage.
- Die drei Zustände sind fest vorgegeben.

# Nicht Teil dieses Requirements

- Einschränkung des Zugriffs anhand des Zustands
- Schreibschutz für abgeschlossene Reisen
- Benachrichtigung der Teilnehmer bei einer Freigabe
- Automatischer Wechsel des Zustands, etwa nach dem Enddatum
- Anzeige des Zustands im Begleiter
- Festhalten, wann und durch wen ein Zustand gewechselt wurde
