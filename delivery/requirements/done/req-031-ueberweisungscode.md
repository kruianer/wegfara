---
id: req-031
title: Überweisungscode für den Ausgleich
app: wegfara
area: Reise
priority: normal
created: 2026-09-03
---

# Ziel (Warum)

Wenn mir die App sagt, dass ich Uwe 40 Euro schulde, will ich das mit
zwei Klicks erledigen — nicht IBAN, Name und Betrag von Hand in die
Banking-App tippen, wo jeder Zahlendreher Geld an die falsche Stelle
schickt.

# Funktion (Was)

Zu jeder vorgeschlagenen Zahlung in der Ausgleichsliste (siehe
req-030) lässt sich ein Überweisungscode anzeigen. Er enthält die
Bankverbindung des Empfängers, seinen vollen Namen und den Betrag der
Zahlung — Banking-Apps lesen daraus eine fertige Überweisung ein.

Der Code erscheint auf Anforderung, nicht dauerhaft in der Liste.

**Auf demselben Gerät.** Wer den Code auf dem Handy sieht, auf dem auch
die Banking-App läuft, kann ihn nicht abscannen. Dafür gibt es neben
dem Code eine Schaltfläche zum Teilen: Der Code wird als Bild an eine
andere App weitergereicht oder gespeichert, sodass die Banking-App ihn
aus der Galerie einlesen kann.

Zusätzlich stehen Bankverbindung, Name und Betrag als Text daneben,
jeweils einzeln zum Kopieren.

Hat der Empfänger keine Bankverbindung hinterlegt, erscheint statt des
Codes der Hinweis, dass für ihn keine hinterlegt ist. Die Zahlung
bleibt in der Liste und lässt sich weiterhin abhaken.

Im Code steht der volle Name des Empfängers, nicht sein Nickname —
er muss zum Kontoinhaber passen (siehe req-020).

# GUI

- Je Zahlung in der Ausgleichsliste eine Schaltfläche, die eine Fläche
  mit dem Code öffnet.
- Die Fläche zeigt den Code, darunter Empfänger, Bankverbindung und
  Betrag als Text mit je einer Schaltfläche zum Kopieren, dazu die
  Schaltfläche zum Teilen.
- Der Code ist groß genug, um von einem zweiten Gerät aus etwa 20 cm
  Entfernung gelesen zu werden.
- Erscheinungsbild wie der übrige Begleiter.

# Akzeptanzkriterien

- [ ] Gegeben die vorgeschlagene Zahlung „Clara zahlt Uwe 40,00 €" und
      Uwe hat eine Bankverbindung hinterlegt, wenn ich den
      Überweisungscode anfordere, dann erscheint ein Code.
- [ ] Gegeben derselbe Zustand, wenn ich die Fläche betrachte, dann
      steht dort der Betrag 40,00 €.
- [ ] Gegeben derselbe Zustand, wenn ich die Fläche betrachte, dann
      steht dort Uwes Bankverbindung.
- [ ] Gegeben Uwe hat den Nicknamen „Uwi" und den Namen „Uwe
      Kremmel", wenn ich die Fläche betrachte, dann steht dort „Uwe
      Kremmel".
- [ ] Gegeben die Fläche ist geöffnet, wenn ich die Bankverbindung
      kopiere, dann liegt sie in der Zwischenablage.
- [ ] Gegeben die Fläche ist geöffnet, wenn ich das Teilen auslöse,
      dann wird der Code als Bild angeboten.
- [ ] Gegeben der Empfänger hat keine Bankverbindung hinterlegt, wenn
      ich den Überweisungscode anfordere, dann erscheint KEIN Code.
- [ ] Gegeben derselbe Fall, wenn ich die Fläche betrachte, dann nennt
      ein Hinweis die fehlende Bankverbindung als Grund.
- [ ] Gegeben derselbe Fall, wenn ich die Ausgleichsliste betrachte,
      dann lässt sich die Zahlung weiterhin abhaken.
- [ ] Gegeben die Ausgleichsliste, wenn ich sie betrachte, ohne einen
      Code anzufordern, dann erscheint dort KEIN Code.

# Constraints

- Der Code folgt dem in Europa gebräuchlichen Format für
  Überweisungen, das Banking-Apps einlesen können. Er wird in der
  Anwendung selbst erzeugt; es wird kein fremder Dienst aufgerufen und
  keine Bankverbindung nach außen gegeben.
- Im Code steht der volle Name des Empfängers, damit er zum
  Kontoinhaber passt.
- Der Code enthält keine Angaben über die Reise oder die Ausgaben,
  nur Empfänger, Bankverbindung und Betrag.

# Nicht Teil dieses Requirements

- Auslösen einer Überweisung aus der App heraus
- Prüfung, ob eine Überweisung tatsächlich erfolgt ist
- Verwendungszweck mit Bezug zur Reise
- Überweisungscode außerhalb der Ausgleichsliste
- Bankverbindungen anderer Länder außerhalb des europäischen
  Zahlungsraums
