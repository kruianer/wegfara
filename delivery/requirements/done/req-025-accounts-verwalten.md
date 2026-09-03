---
id: req-025
title: Accounts verwalten
app: wegfara
area: Planung
priority: normal
created: 2026-09-03
---

# Ziel (Warum)

Ein paar Freunde wollen wegfara ebenfalls nutzen — jeder mit seinem
eigenen Kreis und seinen eigenen Reisen, ohne meine zu sehen. Ich will
für sie einen Bereich anlegen und ihnen den Zugang schicken. Eine
Selbstregistrierung soll es nicht geben.

# Funktion (Was)

**Der Gesamt-Admin.** Genau eine Person trägt die Kennzeichnung
„Gesamt-Admin". Nur sie sieht die Account-Verwaltung. Die
Kennzeichnung lässt sich innerhalb der Anwendung weder vergeben noch
entziehen — sie wird ausschließlich direkt in der Datenbank gesetzt.

**Accounts anlegen.** Der Gesamt-Admin legt einen neuen Account mit
einem Namen an. Zu jedem neuen Account gehört genau eine erste Person,
für die er Name und E-Mail-Adresse erfasst.

**Einladen.** Für diese erste Person erzeugt er einen Zugangslink —
nach demselben Verfahren wie bei den Reiseteilnehmern (siehe req-023):
an die Person gebunden, sieben Tage gültig, genau einmal verwendbar,
beim Einlösen entsteht ein Passkey.

Ab dem Einlösen verwaltet diese Person ihren Account selbst: eigene
Reisen, eigene Teilnehmer, eigene POIs. Sie sieht keine Daten anderer
Accounts.

**Wechseln.** Der Gesamt-Admin kann in einen fremden Account wechseln
und arbeitet dort mit denselben Rechten wie dessen Personen. Er sieht
immer nur den Account, in dem er sich gerade befindet — nie mehrere
gleichzeitig.

Solange er in einem fremden Account arbeitet, weist ein deutlich
sichtbarer Balken am oberen Rand darauf hin, in wessen Account er sich
befindet, samt einer Schaltfläche zur Rückkehr in den eigenen.

**Nachvollziehbarkeit.** Jeder Wechsel in einen fremden Account wird
festgehalten: wer, in welchen Account, wann.

**Keine Selbstregistrierung.** Ein Account entsteht ausschließlich
durch den Gesamt-Admin.

# GUI

- Die Account-Verwaltung ist ein eigener Bereich im Kopfbereich des
  Planers. Er erscheint nur beim Gesamt-Admin.
- Der Bereich listet alle Accounts mit Namen, der Anzahl ihrer
  Personen und dem Zugangsstatus der ersten Person. Je Account eine
  Schaltfläche zum Wechseln.
- Der Hinweisbalken bei fremdem Account liegt über dem Kopfbereich, in
  der Warnfarbe des Planer-Themas, und ist auf jeder Seite sichtbar.
- Erscheinungsbild wie der übrige Planer.

# Akzeptanzkriterien

- [x] Gegeben ich bin als Gesamt-Admin angemeldet, wenn ich den
      Kopfbereich betrachte, dann sehe ich den Bereich
      „Account-Verwaltung".
- [x] Gegeben ich bin als gewöhnliche Person angemeldet, wenn ich den
      Kopfbereich betrachte, dann erscheint dort KEIN Bereich
      „Account-Verwaltung".
- [x] Gegeben ich bin als gewöhnliche Person angemeldet, wenn ich die
      Adresse der Account-Verwaltung direkt aufrufe, dann erhalte ich
      KEINEN Zugriff.
- [x] Gegeben die Account-Verwaltung ist geöffnet, wenn ich einen
      Account „Familie Huber" mit der ersten Person „Anna Huber"
      anlege, dann erscheint „Familie Huber" in der Liste.
- [x] Gegeben der Account „Familie Huber" ist angelegt, wenn ich für
      „Anna Huber" eine Einladung erzeuge, dann erscheint ein
      Zugangslink.
- [x] Gegeben „Anna Huber" hat ihren Zugang eingelöst, wenn sie den
      Planer öffnet, dann erscheinen meine Reisen bei ihr NICHT.
- [x] Gegeben „Anna Huber" hat eine Reise angelegt, wenn ich meinen
      eigenen Planer öffne, dann erscheint ihre Reise bei mir NICHT.
- [x] Gegeben ich bin Gesamt-Admin, wenn ich in den Account „Familie
      Huber" wechsle, dann sehe ich deren Reisen.
- [x] Gegeben ich befinde mich im Account „Familie Huber", wenn ich
      eine beliebige Seite betrachte, dann weist ein Balken darauf hin,
      dass ich in einem fremden Account arbeite.
- [x] Gegeben ich befinde mich im Account „Familie Huber", wenn ich die
      Rückkehr anklicke, dann sehe ich wieder meine eigenen Reisen.
- [x] Gegeben ich habe in den Account „Familie Huber" gewechselt, wenn
      der Vorgang festgehalten wurde, dann nennt der Eintrag meinen
      Namen, den Account und den Zeitpunkt.
- [x] Gegeben ich bin nicht angemeldet, wenn ich versuche, einen
      Account anzulegen, dann wird KEINER angelegt.

# Constraints

- Die Kennzeichnung „Gesamt-Admin" wird ausschließlich direkt in der
  Datenbank gesetzt. Es gibt keine Schaltfläche und keine Schnittstelle,
  über die sich jemand selbst oder andere dazu machen kann.
- Der accountübergreifende Zugriff des Gesamt-Admins ist eine bewusste
  Ausnahme von der Mandantentrennung aus
  [security.md](../../security.md). Er wechselt dabei den Kontext und
  sieht nie mehrere Accounts gleichzeitig; die Trennung der Daten
  bleibt technisch bestehen. Die Angabe in security.md ist um diese
  Ausnahme zu ergänzen.
- Ein Account entsteht ausschließlich durch den Gesamt-Admin. Es gibt
  keine Selbstregistrierung.
- Zugangslinks werden ausschließlich als Prüfsumme gespeichert und
  serverseitig entwertet (siehe req-023).

# Nicht Teil dieses Requirements

- Löschen eines Accounts samt seiner Daten
- Übertragen von Reisen zwischen Accounts
- Mehrere Gesamt-Admins
- Abrechnung oder Nutzungsgrenzen je Account
- Einsicht in fremde Accounts ohne Wechsel
- Ansicht des Protokolls in der Oberfläche
