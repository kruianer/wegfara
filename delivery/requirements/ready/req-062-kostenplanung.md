---
id: req-062
title: Kostenplanung — was die Reise kosten wird
app: wegfara
area: Planung
priority: normal
created: 2026-09-11
---

# Goal (Why)

Als Reiseleiter will ich vor der Reise wissen, was sie kostet — insgesamt
und je Person. Die Preise stehen längst an den POIs, aber nirgends
zusammen; und was kein POI ist (Maut, Parkgebühren), lässt sich gar nicht
erfassen.

# Function (What)

Der Bereich **Kosten** des Planers zeigt eine Tabelle je Reise.

**Je Programmpunkt eine Zeile**, automatisch aus dem Zeitstrahl. Liegt
derselbe POI an zwei Tagen, entstehen zwei Zeilen — zweimal essen kostet
zweimal. Je Zeile:

| Spalte | Herkunft |
|---|---|
| Bezeichnung | Name des POI, dazu der Reisetag |
| Preis je Person | vom POI (req-061), in der Tabelle änderbar |
| Anzahl | vorbelegt mit der Teilnehmerzahl, änderbar |
| Gesamt | Preis mal Anzahl |
| Buchung | der Buchungsstatus des POI (req-061), hier änderbar |
| Dokument | ein verknüpftes Dokument (req-034), ein Klick öffnet es |

**Preis und Buchungsstatus fließen in den POI zurück** — es gibt eine
Wahrheit, an zwei Stellen bedienbar.

**Die Anzahl** zieht mit der Teilnehmerzahl nach, solange sie nicht von
Hand geändert wurde. Wer beim Mietauto 1 eingetragen hat, behält 1, auch
wenn jemand zur Reise dazukommt.

**Manuelle Zeilen** für alles ohne POI — Maut, Parkgebühren, Sprit: mit
Bezeichnung, Preis, Anzahl, Buchungsstatus und Dokument. Sie lassen sich
anlegen, ändern und löschen. **POI-Zeilen lassen sich nicht löschen** —
sie kommen aus dem Plan und verschwinden, sobald der Programmpunkt
entfernt wird. Der Preis bleibt dabei am POI gespeichert.

**Unten stehen zwei Summen:** Gesamtkosten der Reise und Kosten je
Person — die Gesamtkosten geteilt durch die Teilnehmerzahl, damit sich
ein Mietauto auf alle verteilt.

Die Kostenplanung ist die **Kalkulation vorher**; die Ausgaben (req-029)
bleiben davon getrennt — sie erfassen, was unterwegs tatsächlich gezahlt
wurde.

Der Begriff **Kostenplanung** wird ins Glossar der
[stack.md](../../stack.md) aufgenommen, und
[datenbank.md](../../datenbank.md) wird nachgezogen.

# Acceptance Criteria

- [ ] Gegeben eine Reise mit drei Programmpunkten, wenn ich den Bereich
      Kosten öffne, dann sehe ich drei Zeilen.
- [ ] Gegeben ein POI mit 12,50 Euro je Person, wenn ich seine Zeile
      ansehe, dann steht dort 12,50.
- [ ] Gegeben eine Reise mit 4 Teilnehmern, wenn ich eine neue Zeile
      ansehe, dann steht als Anzahl 4.
- [ ] Gegeben eine Zeile mit 12,50 Euro und Anzahl 4, wenn ich sie
      ansehe, dann steht als Gesamt 50,00.
- [ ] Gegeben ich ändere in der Tabelle den Preis auf 15,00, wenn ich
      danach den POI im Bereich POIs öffne, dann steht dort 15,00.
- [ ] Gegeben ich setze in der Tabelle den Buchungsstatus auf „Gebucht",
      wenn ich danach den POI öffne, dann steht dort „Gebucht".
- [ ] Gegeben ich habe beim Mietauto die Anzahl auf 1 gesetzt, wenn ein
      fünfter Teilnehmer zur Reise kommt, dann steht dort weiterhin 1.
- [ ] Gegeben eine Zeile, deren Anzahl ich nie geändert habe, wenn ein
      fünfter Teilnehmer zur Reise kommt, dann steht dort 5.
- [ ] Gegeben ich lege eine manuelle Zeile „Maut" mit 30,00 und Anzahl 1
      an, wenn ich die Tabelle ansehe, dann steht sie darin.
- [ ] Gegeben eine manuelle Zeile, wenn ich sie lösche, dann ist sie
      verschwunden.
- [ ] Gegeben eine Zeile, die aus einem Programmpunkt stammt, wenn ich
      sie ansehe, dann gibt es dafür KEINE Möglichkeit zu löschen.
- [ ] Gegeben ein Programmpunkt mit einer Kostenzeile, wenn ich ihn aus
      dem Zeitstrahl entferne, dann ist seine Zeile verschwunden.
- [ ] Gegeben ein POI mit 12,50 Euro, den ich aus dem Plan entfernt habe,
      wenn ich ihn erneut verplane, dann steht in seiner Zeile wieder
      12,50.
- [ ] Gegeben derselbe POI liegt an zwei Reisetagen im Plan, wenn ich die
      Tabelle ansehe, dann sehe ich zwei Zeilen.
- [ ] Gegeben Zeilen über zusammen 400,00 Euro und 4 Teilnehmer, wenn ich
      die Summen ansehe, dann stehen dort 400,00 gesamt und 100,00 je
      Person.
- [ ] Gegeben eine Zeile mit Buchungsstatus „Gebucht", wenn ich ein
      Dokument verknüpfe, dann öffnet ein Klick darauf dieses Dokument.
- [ ] Gegeben eine Reise ohne Programmpunkte und ohne manuelle Zeilen,
      wenn ich den Bereich Kosten öffne, dann steht dort, dass noch keine
      Kosten erfasst sind.
- [ ] Gegeben ich erfasse eine Kostenzeile, wenn ich danach den Bereich
      Ausgaben im Begleiter ansehe, dann ist dort KEINE Ausgabe
      entstanden.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich das Glossar in
      [stack.md](../../stack.md) öffne, dann steht dort „Kostenplanung".

# Constraints

- Beträge in Euro; die Umrechnung fremder Währungen gehört zu den
  Ausgaben (req-029), nicht zur Kalkulation.
- Der Preis je Person und der Buchungsstatus stehen am POI (req-061) —
  die Tabelle zeigt und ändert sie, hält aber keine zweite Kopie.
- Verknüpfbar sind nur Dokumente derselben Reise (req-034).

# Out of Scope

- Kostenzeilen in Ausgaben überführen oder mit ihnen abgleichen.
- Ein Soll-Ist-Vergleich zwischen Kalkulation und tatsächlichen Ausgaben.
- Kosten je Reisetag oder je Kategorie summieren.
- Kosten unverplanter POIs anzeigen.
- Andere Währungen als Euro.
- Die Kostenplanung im Begleiter anzeigen.
