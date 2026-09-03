---
id: req-029
title: Ausgabe erfassen und aufteilen
app: wegfara
area: Reise
priority: high
created: 2026-09-03
---

# Ziel (Warum)

Unterwegs zahlt mal der eine das Abendessen, mal der andere den
Sprit. Ich will das gleich im Moment festhalten und angeben, für wen
gezahlt wurde — sonst weiß am Ende der Reise niemand mehr, wer wem was
schuldet.

# Funktion (Was)

Der Bereich „Kosten" des Begleiters zeigt die Ausgaben der geöffneten
Reise, die neueste zuerst. Jeder Teilnehmer der Reise kann eine
Ausgabe erfassen, ändern und entfernen.

Eine Ausgabe hat: einen Titel, einen Betrag, eine Währung, einen
Zahler und die Personen, für die gezahlt wurde. Zahler und Beteiligte
sind Teilnehmer dieser Reise.

**Aufteilen** geschieht auf eine von zwei Arten:

- *Gleichmäßig* — der Betrag wird durch die Zahl der ausgewählten
  Personen geteilt. Ein durch die Teilung entstehender Rest von
  wenigen Cent trägt der Zahler.
- *Individuell* — je beteiligter Person wird ein Betrag eingetragen.
  Die Summe muss dem Gesamtbetrag entsprechen; weicht sie ab, wird
  nicht gespeichert und die Abweichung genannt.

Der Zahler ist zunächst als beteiligt vorausgewählt, lässt sich aber
abwählen — dann hat er nur ausgelegt.

**Fremde Währung.** Neben Euro sind Schweizer Franken, US-Dollar und
Britische Pfund möglich. Beim Erfassen wird der Wechselkurs des Tages
ermittelt und **mit der Ausgabe gespeichert**; alle Beträge werden in
Euro geführt. Der ursprüngliche Betrag samt Währung bleibt sichtbar.

Ist die Kursquelle beim Erfassen nicht erreichbar, wird eine Ausgabe
in fremder Währung nicht gespeichert; ein Hinweis nennt den Grund.
Ausgaben in Euro sind davon nicht betroffen.

**Prüfungen.** Ein Titel ist erforderlich und höchstens 80 Zeichen
lang. Der Betrag muss größer als null sein. Mindestens eine Person
muss beteiligt sein.

Vor dem Entfernen erscheint eine Rückfrage mit Titel und Betrag.

Hat eine Reise noch keine Ausgaben, erscheint der Hinweis „Noch keine
Ausgaben erfasst".

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt „3. Kosten (Gruppenkasse)" — Liste „Alle Ausgaben", die
  Schaltfläche „+ Neue Ausgabe erfassen" und das Blatt „Neue Ausgabe".
- Verbindlichkeit: eng folgen, soweit die Vorlage trägt.
- Abweichung zur Vorlage: Der Beleg-Scan mit KI-Erkennung entfällt;
  ein Beleg lässt sich in diesem Requirement nicht anhängen.
- Ergänzung zur Vorlage: Ein Umschalter zwischen gleichmäßiger und
  individueller Aufteilung. Bei individueller Aufteilung erscheint je
  beteiligter Person ein Betragsfeld, dazu die verbleibende Differenz
  zum Gesamtbetrag.
- Die Zusammenfassung oben, der Umschalter „Übersicht | Alle Ausgaben"
  und die Salden sind nicht Teil dieses Requirements; der Bereich zeigt
  die Ausgabenliste.

# Akzeptanzkriterien

- [ ] Gegeben eine Reise ohne Ausgaben, wenn ich den Bereich „Kosten"
      öffne, dann steht dort „Noch keine Ausgaben erfasst".
- [ ] Gegeben der Bereich „Kosten", wenn ich eine Ausgabe „Abendessen"
      über 60,00 € erfasse, für die drei Personen gleichmäßig
      beteiligt sind, dann erscheint „Abendessen" in der Liste.
- [ ] Gegeben dieselbe Ausgabe, wenn ich sie aufklappe, dann entfallen
      auf jede der drei Personen 20,00 €.
- [ ] Gegeben eine Ausgabe über 10,00 € gleichmäßig auf drei Personen,
      wenn ich die Anteile betrachte, dann ergeben sie in der Summe
      genau 10,00 €.
- [ ] Gegeben der Erfassungsdialog mit individueller Aufteilung und
      einem Gesamtbetrag von 60,00 €, wenn ich Anteile von 20,00 €,
      20,00 € und 15,00 € eintrage und speichern will, dann wird die
      Ausgabe NICHT gespeichert.
- [ ] Gegeben derselbe Fall, wenn ich den Dialog betrachte, dann wird
      die Abweichung von 5,00 € genannt.
- [ ] Gegeben der Erfassungsdialog, wenn ich einen Betrag von 95,00 CHF
      erfasse, dann erscheint die Ausgabe mit ihrem Euro-Betrag in der
      Liste.
- [ ] Gegeben dieselbe Ausgabe, wenn ich sie betrachte, dann ist auch
      der ursprüngliche Betrag „95,00 CHF" sichtbar.
- [ ] Gegeben der Erfassungsdialog, wenn ich eine Ausgabe ohne Titel
      zu speichern versuche, dann wird sie NICHT gespeichert.
- [ ] Gegeben der Erfassungsdialog, wenn ich keine beteiligte Person
      auswähle, dann wird die Ausgabe NICHT gespeichert.
- [ ] Gegeben eine erfasste Ausgabe, wenn ich sie zu entfernen
      versuche, dann nennt die Rückfrage ihren Titel.
- [ ] Gegeben eine Ausgabe, bei der der Zahler nicht beteiligt ist,
      wenn ich die Anteile betrachte, dann entfällt auf ihn KEIN
      Anteil.

# Constraints

- Wechselkurse stammen aus einer Quelle, die die Referenzkurse der
  Europäischen Zentralbank ausgibt und ohne Zugangsschlüssel
  auskommt.
- Der beim Erfassen ermittelte Kurs wird mit der Ausgabe gespeichert
  und danach nicht mehr geändert. Andernfalls verschöben sich bereits
  abgerechnete Beträge nachträglich.
- Alle Beträge werden in Euro geführt; Euro ist die Währung der
  Abrechnung.
- Zahler und Beteiligte sind Teilnehmer der Reise (siehe req-021).

# Nicht Teil dieses Requirements

- Salden je Person und Vorschläge zum Ausgleich
- Zusammenfassung mit Gesamtsumme und eigenem Saldo
- Belege fotografieren, anhängen oder per KI auslesen
- Verknüpfung einer Ausgabe mit einem Programmpunkt oder Transfer
- Budget je Person und Budgetauslastung
- Ausgaben im Planer
- Weitere Währungen über die vier genannten hinaus
- Tatsächliche Zahlungen zwischen Teilnehmern
