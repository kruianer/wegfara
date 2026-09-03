---
id: req-028
title: Zugangsschlüssel je Account
app: wegfara
area: Planung
priority: normal
created: 2026-09-03
---

# Ziel (Warum)

Die KI-Suche und der Import aus Google verursachen Kosten. Solange alle
Accounts über meinen Zugang laufen, zahle ich für fremde Nutzung.
Jeder Account soll seine eigenen Schlüssel hinterlegen und damit seine
eigenen Kosten tragen.

# Funktion (Was)

Im Bereich „Einstellungen" gibt es eine Karte „Zugangsschlüssel". Dort
lassen sich je Account zwei Schlüssel hinterlegen: einer für die
KI-Suche, einer für den Import aus Google.

Nur ein Account-Admin (siehe req-027) sieht diese Karte und kann die
Schlüssel setzen oder ersetzen.

Ein hinterlegter Schlüssel wird **nie wieder angezeigt**. Sichtbar ist
nur, dass er gesetzt ist, sowie seine letzten vier Zeichen zur
Unterscheidung. Ersetzen ist möglich, Auslesen nicht.

Ein Schlüssel lässt sich entfernen. Danach sind die zugehörigen
Funktionen für diesen Account nicht mehr verfügbar.

**Ohne hinterlegten Schlüssel ist die zugehörige Funktion gesperrt.**
Die Schaltfläche zur KI-Suche beziehungsweise das Eingabefeld für den
Google-Link sind nicht bedienbar; ein Hinweis nennt den Grund und
verweist auf die Einstellungen. Es wird nicht auf einen anderen
Schlüssel zurückgegriffen.

Schlüssel werden **verschlüsselt gespeichert**. Wer die Datenbank oder
ein Backup liest, kann sie nicht verwenden.

# GUI

- Die Karte „Zugangsschlüssel" liegt im Bereich „Einstellungen" unter
  den vorhandenen Karten.
- Je Schlüssel eine Zeile mit Bezeichnung, Zustand („Nicht gesetzt"
  oder „Gesetzt (…a3f9)") und einer Schaltfläche zum Setzen oder
  Ersetzen.
- Das Eingabefeld verbirgt die Eingabe wie ein Kennwortfeld.
- Erscheinungsbild wie der übrige Planer.

# Akzeptanzkriterien

- [ ] Gegeben ich bin Account-Admin, wenn ich den Bereich
      „Einstellungen" öffne, dann sehe ich die Karte
      „Zugangsschlüssel".
- [ ] Gegeben ich bin kein Account-Admin, wenn ich den Bereich öffne,
      dann erscheint die Karte „Zugangsschlüssel" NICHT.
- [ ] Gegeben kein Schlüssel für die KI-Suche ist hinterlegt, wenn ich
      die Karte betrachte, dann steht dort „Nicht gesetzt".
- [ ] Gegeben ich hinterlege einen Schlüssel für die KI-Suche, wenn ich
      die Karte danach betrachte, dann steht dort „Gesetzt" mit seinen
      letzten vier Zeichen.
- [ ] Gegeben ein hinterlegter Schlüssel, wenn ich die Karte
      betrachte, dann erscheint er NICHT vollständig.
- [ ] Gegeben ein hinterlegter Schlüssel, wenn ich ihn entferne, dann
      steht dort wieder „Nicht gesetzt".
- [ ] Gegeben kein Schlüssel für die KI-Suche ist hinterlegt, wenn ich
      den Bereich „POIs" öffne, dann ist die Schaltfläche zur KI-Suche
      nicht bedienbar.
- [ ] Gegeben derselbe Zustand, wenn ich die Schaltfläche betrachte,
      dann nennt ein Hinweis den fehlenden Schlüssel als Grund.
- [ ] Gegeben kein Schlüssel für Google ist hinterlegt, wenn ich einen
      Google-Maps-Link einfüge, dann wird KEIN POI angelegt.
- [ ] Gegeben ein hinterlegter Schlüssel für die KI-Suche, wenn ich
      eine Suche auslöse, dann werden POIs angelegt.
- [ ] Gegeben ein hinterlegter Schlüssel, wenn ich seinen Eintrag in
      der Datenbank betrachte, dann steht er dort NICHT im Klartext.
- [ ] Gegeben Account A hat einen Schlüssel hinterlegt, wenn ich als
      Person des Accounts B die KI-Suche auslöse, dann wird NICHT der
      Schlüssel des Accounts A verwendet.

# Constraints

- Schlüssel werden verschlüsselt abgelegt. Der zum Entschlüsseln nötige
  Wert stammt aus den Umgebungsvariablen der Umgebung, nicht aus der
  Datenbank — sonst ließe sich ein Backup allein auswerten.
- Ein gesetzter Schlüssel wird nach dem Speichern nie wieder
  ausgegeben, weder in der Oberfläche noch über eine Schnittstelle.
- Die Prüfung, wer Schlüssel setzen darf, erfolgt serverseitig.
- Der bisher in den Umgebungsvariablen hinterlegte Schlüssel für die
  KI-Suche dient weiterhin dem Betrieb von Diensten ohne Account-Bezug.
  Für die Funktionen aus req-014 und req-026 wird ausschließlich der
  Schlüssel des jeweiligen Accounts verwendet.

# Nicht Teil dieses Requirements

- Prüfung, ob ein hinterlegter Schlüssel gültig ist
- Anzeige der verursachten Kosten je Account
- Obergrenze für Abfragen je Account
- Weitere Schlüssel über die beiden genannten hinaus
- Hinterlegen von Schlüsseln durch den Gesamt-Admin für fremde Accounts
